import { defineConfig } from "drizzle-kit";

// Load DATABASE_URL directly from process.env (env-file loaded via tsx or dotenv)
const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required for drizzle-kit");
}

export default defineConfig({
    schema: "./src/db/schema/index.ts",
    out: "./src/db/migrations",
    dialect: "postgresql",
    dbCredentials: { url: databaseUrl },
    verbose: true,
    strict: true,
});
