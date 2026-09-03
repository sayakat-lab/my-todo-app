import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Prisma CLI (db push / migrate) must use the DIRECT connection to Supabase,
    // not the pooled one. The app runtime uses DATABASE_URL via a driver adapter.
    url: env("DIRECT_URL"),
  },
});
