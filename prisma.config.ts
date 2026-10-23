import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Migrations use the direct (non-pooled) URL on Supabase; the app uses the pooled DATABASE_URL.
  datasource: { url: process.env.DIRECT_URL ?? env("DATABASE_URL") },
});
