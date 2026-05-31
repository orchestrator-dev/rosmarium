import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { contentTypes } from "./content-types";
import { users } from "./users";

export const contentTemplates = pgTable("content_templates", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: text("name").notNull(),
    description: text("description"),
    contentTypeId: text("content_type_id").references(() => contentTypes.id),
    templateData: jsonb("template_data").notNull(),
    isGlobal: boolean("is_global").default(false),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
