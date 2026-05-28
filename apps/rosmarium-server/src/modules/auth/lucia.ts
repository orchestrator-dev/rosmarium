import { Lucia } from "lucia";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { db } from "../../db/index.js";
import { sessions, users } from "../../db/schema/index.js";
import { config } from "../../config.js";

const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
    sessionCookie: {
        attributes: {
            secure: config.NODE_ENV === "production",
            sameSite: "lax",
        },
    },
    getUserAttributes: (attributes) => ({
        email: attributes.email,
        firstName: attributes.firstName,
        lastName: attributes.lastName,
        role: attributes.role,
        isActive: attributes.isActive,
    }),
});

declare module "lucia" {
    interface Register {
        Lucia: typeof lucia;
        DatabaseUserAttributes: typeof users.$inferSelect;
    }
}
