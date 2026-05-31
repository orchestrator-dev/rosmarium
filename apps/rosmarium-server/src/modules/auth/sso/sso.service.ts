import { db } from "../../../db/index";
import { users } from "../../../db/schema/users";
import { ssoProviders } from "../../../db/schema/sso-providers";
import { eq } from "drizzle-orm";
import type { UserRole } from "../auth.service";

export interface SSOProfile {
    email: string;
    firstName?: string;
    lastName?: string;
    groups?: string[];
}

export const ssoService = {
    async getProviderById(id: string) {
        const [provider] = await db.select().from(ssoProviders).where(eq(ssoProviders.id, id));
        return provider;
    },

    async getActiveProviders() {
        return db.select().from(ssoProviders).where(eq(ssoProviders.isActive, true));
    },

    async processSSOLogin(provider: typeof ssoProviders.$inferSelect, profile: SSOProfile) {
        if (!profile.email) {
            throw new Error("SSO profile missing email");
        }

        let [user] = await db.select().from(users).where(eq(users.email, profile.email));

        let role: UserRole | undefined = undefined;
        if (provider.roleMapping && profile.groups) {
            const roleMapping = provider.roleMapping as Record<string, string>;
            for (const group of profile.groups) {
                if (roleMapping[group]) {
                    role = roleMapping[group] as UserRole;
                    break;
                }
            }
        }

        if (!user) {
            const [newUser] = await db.insert(users).values({
                email: profile.email,
                firstName: profile.firstName || null,
                lastName: profile.lastName || null,
                role: role || ("viewer" as UserRole), // Default role
                isActive: true,
            }).returning();
            user = newUser;
        } else {
            // Update role and name if changed
            const updateData: any = {};
            if (role && user.role !== role) {
                updateData.role = role;
            }
            if (profile.firstName && user.firstName !== profile.firstName) {
                updateData.firstName = profile.firstName;
            }
            if (profile.lastName && user.lastName !== profile.lastName) {
                updateData.lastName = profile.lastName;
            }
            
            if (Object.keys(updateData).length > 0) {
                const [updatedUser] = await db.update(users)
                    .set(updateData)
                    .where(eq(users.id, user.id))
                    .returning();
                user = updatedUser;
            }
        }

        return user;
    }
};
