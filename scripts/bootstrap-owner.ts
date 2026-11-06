import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { randomUUID } from "node:crypto";
import {
  emailSchema,
  fullNameSchema,
  passwordSchema,
} from "../src/server/schemas/common.schema";
import {
  PASSWORD_HASH_ITERATIONS,
  hashPassword,
} from "../src/server/auth/password";
import {
  assertUsersTableExists,
  findExistingOwner,
  runD1File,
  sqlJson,
  sqlString,
} from "./d1";

interface Options {
  local: boolean;
  remote: boolean;
  yes: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Options {
  return {
    local: argv.includes("--local"),
    remote: argv.includes("--remote"),
    yes: argv.includes("--yes") || argv.includes("-y"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function printHelp(): void {
  console.log(
    [
      "Create the first owner account for Shifra Nuha CRM.",
      "",
      "Usage:",
      "  npm run auth:bootstrap -- --local",
      "  npm run auth:bootstrap -- --remote",
      "",
      "Options:",
      "  --local    Target the local D1 database (default).",
      "  --remote   Target the deployed D1 database. Requires Cloudflare auth.",
      "  --yes, -y  Skip the remote confirmation prompt.",
      "",
      "Credentials can be supplied non-interactively with:",
      "  OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD",
      "",
      "The script refuses to create a second owner. It never prints the password.",
    ].join("\n"),
  );
}

function validate<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } } },
  value: string,
  label: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `${label}: ${result.error.issues.map((issue) => issue.message).join(" ")}`,
    );
  }
  return result.data;
}

function readHidden(prompt: string): Promise<string> {
  if (!input.isTTY) {
    throw new Error(
      "Password input requires an interactive terminal. Set OWNER_PASSWORD instead.",
    );
  }

  return new Promise((resolve, reject) => {
    output.write(prompt);
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    let value = "";

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(wasRaw ?? false);
      input.pause();
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          cleanup();
          output.write("\n");
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }
        if (char >= " ") {
          value += char;
          output.write("*");
        }
      }
    };

    input.on("data", onData);
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (options.local && options.remote) {
    throw new Error("Choose either --local or --remote, not both.");
  }

  const local = !options.remote;

  if (options.remote && !options.yes) {
    if (!input.isTTY) {
      throw new Error(
        "Remote bootstrap requires --yes when running non-interactively.",
      );
    }
    const rl = createInterface({ input, output });
    const answer = await rl.question(
      "You are about to create the owner account in the REMOTE D1 database.\nType 'yes' to continue: ",
    );
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("Aborted. No changes were made.");
      return;
    }
  }

  assertUsersTableExists(local);

  const existingOwner = findExistingOwner(local);
  if (existingOwner) {
    throw new Error(
      `An owner account already exists (${existingOwner.email}). ` +
        "The bootstrap process will not create a second owner.",
    );
  }

  let fullName = process.env.OWNER_NAME?.trim() ?? "";
  let email = process.env.OWNER_EMAIL?.trim() ?? "";
  let password = process.env.OWNER_PASSWORD ?? "";

  if (!fullName || !email) {
    if (!input.isTTY) {
      throw new Error(
        "Set OWNER_NAME and OWNER_EMAIL (and OWNER_PASSWORD) when running non-interactively.",
      );
    }
    const rl = createInterface({ input, output });
    if (!fullName) {
      fullName = await rl.question("Owner full name: ");
    }
    if (!email) {
      email = await rl.question("Owner email: ");
    }
    rl.close();
  }

  if (!password) {
    password = await readHidden("Owner password: ");
    const confirmation = await readHidden("Confirm password: ");
    if (password !== confirmation) {
      throw new Error("Passwords do not match.");
    }
  }

  const validatedName = validate(fullNameSchema, fullName, "Full name");
  const validatedEmail = validate(emailSchema, email, "Email");
  const validatedPassword = validate(passwordSchema, password, "Password");

  console.log(
    `Hashing password (PBKDF2-HMAC-SHA256, ${PASSWORD_HASH_ITERATIONS.toLocaleString(
      "en-US",
    )} iterations)...`,
  );
  const passwordHash = await hashPassword(validatedPassword);

  const ownerId = randomUUID();
  const auditId = randomUUID();
  const now = new Date().toISOString();

  const sql = [
    "INSERT INTO users (",
    "  id, full_name, email, password_hash, role, is_active,",
    "  must_change_password, created_at, updated_at, last_login_at",
    ") VALUES (",
    [
      sqlString(ownerId),
      sqlString(validatedName),
      sqlString(validatedEmail),
      sqlString(passwordHash),
      "'owner'",
      "1",
      "0",
      sqlString(now),
      sqlString(now),
      "NULL",
    ].join(", "),
    ");",
    "INSERT INTO audit_logs (",
    "  id, user_id, action, entity_type, entity_id, metadata, ip_address, created_at",
    ") VALUES (",
    [
      sqlString(auditId),
      "NULL",
      "'user.bootstrap_owner'",
      "'user'",
      sqlString(ownerId),
      sqlJson({ email: validatedEmail, target: local ? "local" : "remote" }),
      "NULL",
      sqlString(now),
    ].join(", "),
    ");",
  ];

  const defaultSettings: Array<[string, string]> = [
    ["company_name", "Shifra Nuha Technologies"],
    ["company_email", ""],
    ["company_phone", ""],
    ["company_website", "https://shifranuhatech.com"],
    ["timezone", "UTC"],
    ["currency", "USD"],
  ];

  for (const [key, value] of defaultSettings) {
    sql.push(
      `INSERT OR IGNORE INTO app_settings (key, value, updated_at, updated_by) VALUES (${sqlString(
        key,
      )}, ${sqlString(value)}, ${sqlString(now)}, ${sqlString(ownerId)});`,
    );
  }

  runD1File(sql.join("\n"), { local });

  console.log("");
  console.log("Owner account created successfully.");
  console.log(`  Name:  ${validatedName}`);
  console.log(`  Email: ${validatedEmail}`);
  console.log(`  Role:  owner`);
  console.log(
    `  Target: ${local ? "local D1 database" : "remote D1 database"}`,
  );
  console.log("");
  console.log(
    local
      ? "Start the app with `npm run dev`, then sign in at http://localhost:5173/login."
      : "Sign in at https://crm.shifranuhatech.com/login.",
  );
  console.log("The password was not logged or stored anywhere except as a hash.");
}

main().catch((error: unknown) => {
  console.error("");
  console.error(
    error instanceof Error ? error.message : "Owner bootstrap failed.",
  );
  process.exitCode = 1;
});
