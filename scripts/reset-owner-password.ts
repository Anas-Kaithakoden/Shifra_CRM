import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  PASSWORD_HASH_ITERATIONS,
  hashPassword,
} from "../src/server/auth/password";
import { passwordSchema } from "../src/server/schemas/common.schema";
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
      "Reset the existing owner password for Shifra Nuha CRM.",
      "",
      "Usage:",
      "  npx tsx scripts/reset-owner-password.ts --local",
      "  npx tsx scripts/reset-owner-password.ts --remote --yes",
      "",
      "Options:",
      "  --local    Target the local D1 database (default).",
      "  --remote   Target the deployed D1 database. Requires Cloudflare auth.",
      "  --yes, -y  Skip the remote confirmation prompt.",
      "",
      "Password must be supplied via OWNER_PASSWORD (never logged).",
      "The script updates only the single existing owner row.",
    ].join("\n"),
  );
}

function validatePassword(value: string): string {
  const result = passwordSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Password: ${result.error.issues.map((issue) => issue.message).join(" ")}`,
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
        "Remote reset requires --yes when running non-interactively.",
      );
    }
    const rl = createInterface({ input, output });
    const answer = await rl.question(
      "You are about to reset the OWNER password in the REMOTE D1 database.\nType 'yes' to continue: ",
    );
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("Aborted. No changes were made.");
      return;
    }
  }

  assertUsersTableExists(local);
  const owner = findExistingOwner(local);
  if (!owner) {
    throw new Error(
      "No owner account exists in the target database. Run auth:bootstrap first.",
    );
  }

  let password = process.env.OWNER_PASSWORD ?? "";
  if (!password) {
    password = await readHidden("New owner password: ");
    const confirmation = await readHidden("Confirm password: ");
    if (password !== confirmation) {
      throw new Error("Passwords do not match.");
    }
  }

  const validatedPassword = validatePassword(password);
  console.log(
    `Hashing password (PBKDF2-HMAC-SHA256, ${PASSWORD_HASH_ITERATIONS.toLocaleString(
      "en-US",
    )} iterations) for ${owner.email}...`,
  );
  const passwordHash = await hashPassword(validatedPassword);
  const now = new Date().toISOString();
  const auditId = randomUUID();

  const sql = [
    `UPDATE users SET password_hash = ${sqlString(passwordHash)}, updated_at = ${sqlString(now)}, must_change_password = 0 WHERE id = ${sqlString(owner.id)} AND role = 'owner';`,
    "INSERT INTO audit_logs (",
    "  id, user_id, action, entity_type, entity_id, metadata, ip_address, created_at",
    ") VALUES (",
    [
      sqlString(auditId),
      "NULL",
      "'auth.password_changed'",
      "'user'",
      sqlString(owner.id),
      sqlJson({ email: owner.email, target: local ? "local" : "remote", via: "owner_reset_script" }),
      "NULL",
      sqlString(now),
    ].join(", "),
    ");",
  ].join("\n");

  runD1File(sql, { local });

  console.log("");
  console.log("Owner password reset successfully.");
  console.log(`  Email:  ${owner.email}`);
  console.log(`  Target: ${local ? "local D1 database" : "remote D1 database"}`);
  console.log("The password was not logged or stored anywhere except as a hash.");
  console.log("Sign in again; if you had sessions, invalidate them by logging in/out as needed.");
}

main().catch((error: unknown) => {
  console.error("");
  console.error(
    error instanceof Error ? error.message : "Owner password reset failed.",
  );
  process.exitCode = 1;
});