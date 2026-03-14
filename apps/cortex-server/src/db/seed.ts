/**
 * Seed the database with the initial super_admin user.
 *
 * Usage: pnpm db:seed
 *
 * This script is idempotent — it checks for an existing user before creating one.
 * Required env vars: ADMIN_EMAIL, ADMIN_PASSWORD (validated by config.ts).
 */
import { db } from "./index.js";
import { users } from "./schema/index.js";
import { eq } from "drizzle-orm";
import { hashPassword } from "../modules/auth/password.js";
import { config } from "../config.js";

async function seed() {
    console.log("🌱 Running database seed...");

    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, config.ADMIN_EMAIL.toLowerCase()))
        .limit(1);

    if (existing.length > 0) {
        console.log(`✅ Admin user already exists: ${config.ADMIN_EMAIL}`);
        process.exit(0);
    }

    const passwordHash = await hashPassword(config.ADMIN_PASSWORD);

    await db.insert(users).values({
        email: config.ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        firstName: "Admin",
        lastName: "User",
        role: "super_admin",
        isActive: true,
    });

    console.log(`✅ Admin user ready: ${config.ADMIN_EMAIL}`);
    process.exit(0);
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
