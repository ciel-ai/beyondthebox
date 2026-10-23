import { execSync } from "node:child_process";

/** Applies migrations to the isolated test database (non-destructive) and seeds it. Tests truncate their own data. */
export default function setup() {
  const env = { ...process.env, DATABASE_URL: "postgresql://btl:btl_local_only@localhost:5544/btl_test" };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });
}
