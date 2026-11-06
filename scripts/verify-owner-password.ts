import { verifyPassword } from "../src/server/auth/password";
import { runD1Query } from "./d1";

async function main(): Promise<void> {
  const password = process.env.OWNER_PASSWORD ?? "";
  if (!password) {
    console.error("Set OWNER_PASSWORD to the password to verify (never logged).");
    process.exitCode = 1;
    return;
  }
  const rows = runD1Query<{ email: string; password_hash: string; is_active: number }>(
    "SELECT email, password_hash, is_active FROM users WHERE role = 'owner' LIMIT 1;",
    { local: false },
  );
  const owner = rows[0];
  if (!owner) {
    console.error("No owner found.");
    process.exitCode = 1;
    return;
  }
  const valid = await verifyPassword(password, owner.password_hash);
  console.log(`owner=${owner.email} active=${owner.is_active} verify=${valid}`);
  if (!valid) {
    const parts = owner.password_hash.split("$");
    console.log(
      `hash_parts=${parts.length} algo=${parts[0]} iter=${parts[1]} salt_len=${parts[2]?.length ?? 0} key_len=${parts[3]?.length ?? 0}`,
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});