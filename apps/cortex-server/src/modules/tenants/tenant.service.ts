import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { tenants } from "../../db/schema/index.js";
import { users } from "../../db/schema/users.js";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { config } from "../../config.js";
import { hashPassword } from "../auth/password.js";
import { createId } from "@paralleldrive/cuid2";

export type TenantPlan = "free" | "starter" | "pro" | "enterprise";

export const tenantService = {
    async provision(input: {
        slug: string;
        name: string;
        plan: TenantPlan;
        adminEmail: string;
        adminPassword: string;
        storageBucket?: string;
    }) {
        if (!/^[a-z0-9-]+$/.test(input.slug)) {
            throw new Error("Invalid slug format. Use lowercase, alphanumeric, and hyphens only.");
        }

        const schemaName = `tenant_${input.slug}`;

        // 1. Create tenant record in public schema
        const [tenant] = await db.insert(tenants).values({
            slug: input.slug,
            name: input.name,
            plan: input.plan,
            storageBucket: input.storageBucket,
        }).returning();

        // 2. Create PostgreSQL schema
        const adminClient = postgres(config.DATABASE_URL, { max: 1 });
        await adminClient.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
        await adminClient.end();

        // 3. Run all migrations against new schema using search_path
        const tenantClient = postgres(config.DATABASE_URL, {
            max: 1,
            connection: { search_path: schemaName }
        });
        const tenantDb = drizzle(tenantClient);
        
        await migrate(tenantDb, { migrationsFolder: "src/db/migrations" });

        // 4. Create admin user in tenant schema
        const passwordHash = await hashPassword(input.adminPassword);

        const [adminUser] = await tenantDb.insert(users).values({
            email: input.adminEmail,
            passwordHash,
            firstName: "Admin",
            lastName: "User",
            role: "super_admin",
            isActive: true,
        }).returning();

        await tenantClient.end();

        return { tenant, adminUser };
    },

    async deprovision(id: string) {
        await db.update(tenants).set({ isActive: false }).where(eq(tenants.id, id));
    },

    async getTenant(slug: string) {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
        return tenant || null;
    },

    async listTenants() {
        return await db.select().from(tenants);
    }
};
