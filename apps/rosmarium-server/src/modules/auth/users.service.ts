import { db } from "../../db/index.js";
import { users, auditLog } from "../../db/schema/index.js";
import { eq, desc } from "drizzle-orm";
import { AuthError, AUTH_ERRORS, type UserRole } from "./auth.service.js";
import { hashPassword } from "./password.js";

// Safe user projection (never expose passwordHash)
export function safeUser(user: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...safe } = user as { passwordHash?: unknown };
    return safe;
}

export const usersService = {
    /**
     * List all users
     */
    async list() {
        const allUsers = await db
            .select()
            .from(users)
            .orderBy(desc(users.createdAt));
        return allUsers.map((u) => safeUser(u as Record<string, unknown>));
    },

    /**
     * Create a user (Admin invite).
     */
    async create(
        adminId: string,
        input: {
            email: string;
            firstName?: string;
            lastName?: string;
            role: UserRole;
        }
    ) {
        const existing = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, input.email.toLowerCase()))
            .limit(1);

        if (existing.length > 0) {
            throw new AuthError(AUTH_ERRORS.EMAIL_TAKEN, "Email already registered");
        }

        // Generate a random high-entropy password since they are invited by admin
        // They should use the forgot password flow later (if implemented) to set their own.
        const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        
        const passwordHash = await hashPassword(randomPassword);

        const [user] = await db
            .insert(users)
            .values({
                email: input.email.toLowerCase(),
                passwordHash,
                firstName: input.firstName,
                lastName: input.lastName,
                role: input.role,
                isActive: true,
            })
            .returning();

        if (!user) {
            throw new Error("Failed to create user");
        }

        await db.insert(auditLog).values({
            userId: adminId,
            action: "user.invited",
            resourceType: "user",
            resourceId: user.id,
            metadata: { role: input.role },
        });

        return safeUser(user as Record<string, unknown>);
    },

    /**
     * Update user role or active status.
     */
    async update(
        adminId: string,
        userId: string,
        input: { role?: UserRole; isActive?: boolean }
    ) {
        if (input.role === undefined && input.isActive === undefined) {
            return;
        }

        const [updatedUser] = await db
            .update(users)
            .set(input)
            .where(eq(users.id, userId))
            .returning();

        if (!updatedUser) {
            throw new Error("User not found");
        }

        await db.insert(auditLog).values({
            userId: adminId,
            action: "user.updated",
            resourceType: "user",
            resourceId: userId,
            metadata: input,
        });

        return safeUser(updatedUser as Record<string, unknown>);
    },
};
