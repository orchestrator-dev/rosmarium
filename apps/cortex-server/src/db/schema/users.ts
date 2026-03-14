import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const users = pgTable(
    "users",
    {
        id: text("id").primaryKey().$defaultFn(() => createId()),
        email: text("email").notNull().unique(),
        passwordHash: text("password_hash"),
        firstName: text("first_name"),
        lastName: text("last_name"),
        avatarUrl: text("avatar_url"),
        role: text("role", {
            enum: ["super_admin", "admin", "editor", "author", "viewer"],
        })
            .notNull()
            .default("viewer"),
        isActive: boolean("is_active").notNull().default(true),
        lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => ({
        emailIdx: index("users_email_idx").on(table.email),
    })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
