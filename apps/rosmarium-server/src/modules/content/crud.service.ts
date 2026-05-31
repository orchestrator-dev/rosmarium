import { and, eq, count, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
    contentEntries,
    branchEntries,
    auditLog,
    type ContentEntry,
} from "../../db/schema/index.js";
import { registry } from "./registry.js";
import {
    buildWhereClause,
    buildOrderBy,
    buildPagination,
    encodeCursor,
    type ParsedFilters,
    type SortInput,
} from "./query.builder.js";
import { rosmariumEvents } from "../../lib/events.js";
import { branchStorage } from "../../db/index.js";
import { branchService } from "../branches/branch.service.js";
import { createId } from "@paralleldrive/cuid2";
import { hookEngine } from "../../plugins/hook-engine.js";

export interface ContentVersion {
    id: string;
    version: number;
    data: Record<string, unknown>;
    createdBy: string | null;
    createdAt: Date;
}

export interface FindManyOpts {
    contentTypeName: string;
    filters?: ParsedFilters;
    sort?: SortInput;
    pagination?: { limit: number; cursor?: string };
    locale?: string;
    localeFallbackChain?: string[];
    status?: "draft" | "published" | "archived";
}

export interface FindManyUnifiedOpts {
    contentTypeNames?: string[];
    filters?: ParsedFilters;
    sort?: SortInput;
    pagination?: { limit: number; cursor?: string };
    locale?: string;
    localeFallbackChain?: string[];
    status?: "draft" | "published" | "archived";
    localizationGroupId?: string;
}

export interface FindOneOpts {
    contentTypeName: string;
    id: string;
    locale?: string;
}

/** Generate a URL-friendly slug from a string. */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 200);
}

export const contentCrudService = {
    async findMany(opts: FindManyOpts): Promise<{
        entries: ContentEntry[];
        nextCursor: string | null;
        total: number;
    }> {
        const contentType = registry.get(opts.contentTypeName);
        if (!contentType) {
            throw new Error(`Unknown content type: '${opts.contentTypeName}'`);
        }

        const limit = opts.pagination?.limit ?? 20;
        const { where: cursorWhere, limit: fetchLimit } = buildPagination(
            opts.pagination?.cursor,
            limit,
        );

        // Base conditions
        const conditions = [
            eq(contentEntries.contentTypeId, contentType.id),
        ];

        if (opts.localeFallbackChain && opts.localeFallbackChain.length > 0) {
            conditions.push(sql`${contentEntries.locale} = ANY(ARRAY[${sql.join(opts.localeFallbackChain, sql`, `)}]::text[])`);
        } else if (opts.locale) {
            conditions.push(eq(contentEntries.locale, opts.locale));
        }
        if (opts.status) conditions.push(eq(contentEntries.status, opts.status));
        if (cursorWhere) conditions.push(cursorWhere);

        // User-supplied filters
        if (opts.filters) {
            const filterClauses = buildWhereClause(opts.filters, contentType);
            conditions.push(...filterClauses);
        }

        const orderBy =
            opts.sort && opts.sort.length > 0
                ? buildOrderBy(opts.sort)
                : [sql`${contentEntries.createdAt} DESC`];

        const [rows, totalResult] = await Promise.all([
            db
                .select()
                .from(contentEntries)
                .where(and(...conditions))
                .orderBy(...orderBy)
                .limit(fetchLimit),
            db
                .select({ value: count() })
                .from(contentEntries)
                .where(
                    and(
                        eq(contentEntries.contentTypeId, contentType.id),
                        opts.localeFallbackChain && opts.localeFallbackChain.length > 0
                            ? sql`${contentEntries.locale} = ANY(ARRAY[${sql.join(opts.localeFallbackChain, sql`, `)}]::text[])`
                            : opts.locale ? eq(contentEntries.locale, opts.locale) : undefined,
                        opts.status ? eq(contentEntries.status, opts.status) : undefined,
                        opts.filters
                            ? and(...buildWhereClause(opts.filters, contentType))
                            : undefined,
                    ),
                ),
        ]);

        let resolvedRows = rows;
        if (opts.localeFallbackChain && opts.localeFallbackChain.length > 1) {
            const groupMap = new Map<string, ContentEntry>();
            for (const row of rows) {
                const groupId = row.localizationGroupId || row.id;
                const existing = groupMap.get(groupId);
                if (!existing) {
                    groupMap.set(groupId, row);
                } else {
                    const existingIdx = opts.localeFallbackChain.indexOf(existing.locale);
                    const currentIdx = opts.localeFallbackChain.indexOf(row.locale);
                    if (currentIdx !== -1 && (existingIdx === -1 || currentIdx < existingIdx)) {
                        groupMap.set(groupId, row);
                    }
                }
            }
            resolvedRows = Array.from(groupMap.values());
            resolvedRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        const hasMore = resolvedRows.length > limit;
        let entries = hasMore ? resolvedRows.slice(0, limit) : resolvedRows;
        const lastEntry = entries.at(-1);
        const nextCursor =
            hasMore && lastEntry ? encodeCursor(lastEntry.id) : null;

        const branchId = branchStorage.getStore();
        if (branchId && entries.length > 0) {
            const entryIds = entries.map(e => e.id);
            const bEntries = await db.query.branchEntries.findMany({
                where: and(
                    eq(branchEntries.branchId, branchId),
                    sql`${branchEntries.entryId} = ANY(ARRAY[${sql.join(entryIds, sql`, `)}]::text[])`
                )
            });
            if (bEntries.length > 0) {
                entries = entries.map(entry => {
                    const b = bEntries.find(be => be.entryId === entry.id);
                    if (!b) return entry;
                    if (b.action === "delete") return null;
                    return { ...entry, data: b.data as Record<string, unknown> };
                }).filter(Boolean) as ContentEntry[];
            }
        }

        return {
            entries,
            nextCursor,
            total: totalResult[0]?.value ?? 0,
        };
    },

    async findManyUnified(opts: FindManyUnifiedOpts): Promise<{
        entries: ContentEntry[];
        nextCursor: string | null;
        total: number;
    }> {
        const limit = opts.pagination?.limit ?? 20;
        const { where: cursorWhere, limit: fetchLimit } = buildPagination(
            opts.pagination?.cursor,
            limit,
        );

        const conditions: import('drizzle-orm').SQL[] = [];
        if (opts.contentTypeNames && opts.contentTypeNames.length > 0) {
            const types = opts.contentTypeNames
                .map(name => registry.get(name)?.id)
                .filter(Boolean);
            if (types.length > 0) {
                conditions.push(sql`${contentEntries.contentTypeId} = ANY(ARRAY[${sql.join(types, sql`, `)}]::text[])`);
            } else {
                // If they filtered by types that don't exist, return empty
                conditions.push(sql`1 = 0`);
            }
        }

        if (opts.localeFallbackChain && opts.localeFallbackChain.length > 0) {
            conditions.push(sql`${contentEntries.locale} = ANY(ARRAY[${sql.join(opts.localeFallbackChain, sql`, `)}]::text[])`);
        } else if (opts.locale) {
            conditions.push(eq(contentEntries.locale, opts.locale));
        }
        if (opts.status) conditions.push(eq(contentEntries.status, opts.status));
        if (cursorWhere) conditions.push(cursorWhere);

        if (opts.filters) {
            // We pass undefined for contentType to allow generic JSON filtering
            const filterClauses = buildWhereClause(opts.filters, undefined);
            conditions.push(...filterClauses);
        }

        const orderBy =
            opts.sort && opts.sort.length > 0
                ? buildOrderBy(opts.sort)
                : [sql`${contentEntries.createdAt} DESC`];

        const [rows, totalResult] = await Promise.all([
            db
                .select()
                .from(contentEntries)
                .where(conditions.length > 0 ? and(...conditions) : undefined)
                .orderBy(...orderBy)
                .limit(fetchLimit),
            db
                .select({ value: count() })
                .from(contentEntries)
                .where(conditions.length > 0 ? and(...conditions) : undefined),
        ]);

        let resolvedRows = rows;
        if (opts.localeFallbackChain && opts.localeFallbackChain.length > 1) {
            const groupMap = new Map<string, ContentEntry>();
            for (const row of rows) {
                const groupId = row.localizationGroupId || row.id;
                const existing = groupMap.get(groupId);
                if (!existing) {
                    groupMap.set(groupId, row);
                } else {
                    const existingIdx = opts.localeFallbackChain.indexOf(existing.locale);
                    const currentIdx = opts.localeFallbackChain.indexOf(row.locale);
                    if (currentIdx !== -1 && (existingIdx === -1 || currentIdx < existingIdx)) {
                        groupMap.set(groupId, row);
                    }
                }
            }
            resolvedRows = Array.from(groupMap.values());
            resolvedRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        const hasMore = resolvedRows.length > limit;
        let entries = hasMore ? resolvedRows.slice(0, limit) : resolvedRows;
        const lastEntry = entries.at(-1);
        const nextCursor =
            hasMore && lastEntry ? encodeCursor(lastEntry.id) : null;

        const branchId = branchStorage.getStore();
        if (branchId && entries.length > 0) {
            const entryIds = entries.map(e => e.id);
            const bEntries = await db.query.branchEntries.findMany({
                where: and(
                    eq(branchEntries.branchId, branchId),
                    sql`${branchEntries.entryId} = ANY(ARRAY[${sql.join(entryIds, sql`, `)}]::text[])`
                )
            });
            if (bEntries.length > 0) {
                entries = entries.map(entry => {
                    const b = bEntries.find(be => be.entryId === entry.id);
                    if (!b) return entry;
                    if (b.action === "delete") return null;
                    return { ...entry, data: b.data as Record<string, unknown> };
                }).filter(Boolean) as ContentEntry[];
            }
        }

        return {
            entries,
            nextCursor,
            total: totalResult[0]?.value ?? 0,
        };
    },

    async findOne(opts: FindOneOpts): Promise<ContentEntry | null> {
        const contentType = registry.get(opts.contentTypeName);
        if (!contentType) {
            throw new Error(`Unknown content type: '${opts.contentTypeName}'`);
        }

        const conditions = [
            eq(contentEntries.id, opts.id),
            eq(contentEntries.contentTypeId, contentType.id),
        ];
        if (opts.locale) conditions.push(eq(contentEntries.locale, opts.locale));

        let [row] = await db
            .select()
            .from(contentEntries)
            .where(and(...conditions))
            .limit(1);

        const branchId = branchStorage.getStore();
        if (branchId) {
            const bEntry = await db.query.branchEntries.findFirst({
                where: and(
                    eq(branchEntries.branchId, branchId),
                    eq(branchEntries.entryId, opts.id)
                )
            });
            if (bEntry) {
                if (bEntry.action === "delete") return null;
                if (bEntry.action === "create" && !row) {
                    row = {
                        id: bEntry.entryId,
                        contentTypeId: contentType.id,
                        locale: opts.locale || "en",
                        status: "draft",
                        data: bEntry.data,
                        metadata: {},
                        createdBy: null,
                        updatedBy: null,
                        createdAt: bEntry.createdAt,
                        updatedAt: bEntry.updatedAt,
                        publishedAt: null
                    } as ContentEntry;
                } else if (row) {
                    row = { ...row, data: bEntry.data as Record<string, unknown> };
                }
            }
        }

        return row ?? null;
    },

    async create(opts: {
        contentTypeName: string;
        data: Record<string, unknown>;
        locale?: string;
        localizationGroupId?: string;
        createdBy: string;
    }): Promise<ContentEntry> {
        const contentType = registry.get(opts.contentTypeName);
        if (!contentType) {
            throw new Error(`Unknown content type: '${opts.contentTypeName}'`);
        }

        // Auto-generate slug fields
        let data = { ...opts.data };
        for (const field of contentType.fields) {
            if (
                field.type === "slug" &&
                !data[field.name] &&
                field.generatedFrom
            ) {
                const sourceValue = data[field.generatedFrom];
                if (typeof sourceValue === "string") {
                    data = { ...data, [field.name]: slugify(sourceValue) };
                }
            }
        }

        // Validate
        const validation = registry.validateEntry(opts.contentTypeName, data);
        if (!validation.valid) {
            const messages = validation.errors.map((e) => e.message).join("; ");
            throw new Error(`Validation failed: ${messages}`);
        }

        // Get workflow initial state if any
        let status = "draft";
        try {
            const { workflowService } = await import("../workflow/workflow.service.js");
            const wf = await workflowService.getWorkflowForContentType(contentType.id);
            if (wf) {
                status = wf.definition.initialState || "draft";
            }
        } catch {
            // Workflow module not loaded or similar
        }

        await hookEngine.execute('content:beforeCreate', {
            entry: data,
            contentType: opts.contentTypeName,
            action: 'create',
            user: opts.createdBy
        });

        const branchId = branchStorage.getStore();
        if (branchId) {
            const newId = createId();
            await branchService.saveBranchEntry(branchId, newId, "create", data);
            const entry = {
                id: newId,
                contentTypeId: contentType.id,
                locale: opts.locale ?? "en",
                localizationGroupId: opts.localizationGroupId ?? createId(),
                status,
                data,
                metadata: {},
                createdBy: opts.createdBy,
                updatedBy: opts.createdBy,
                createdAt: new Date(),
                updatedAt: new Date(),
                publishedAt: null
            } as ContentEntry;
            rosmariumEvents.emit("content.created", entry);
            return entry;
        }

        const [entry] = await db
            .insert(contentEntries)
            .values({
                contentTypeId: contentType.id,
                locale: opts.locale ?? "en",
                localizationGroupId: opts.localizationGroupId ?? createId(),
                status: status as "draft" | "published" | "archived",
                data,
                createdBy: opts.createdBy,
                updatedBy: opts.createdBy,
            })
            .returning();

        if (!entry) throw new Error("Failed to insert content entry");

        // Audit log
        await db.insert(auditLog).values({
            userId: opts.createdBy,
            action: "content.created",
            resourceId: entry.id,
            resourceType: opts.contentTypeName,
            metadata: { contentTypeName: opts.contentTypeName },
        });

        await hookEngine.execute('content:afterCreate', {
            entry: entry.data as Record<string, unknown>,
            contentType: opts.contentTypeName,
            action: 'create',
            user: opts.createdBy
        });

        rosmariumEvents.emit("content.created", entry);
        return entry;
    },

    async update(opts: {
        id: string;
        contentTypeName: string;
        data: Partial<Record<string, unknown>>;
        updatedBy: string;
    }): Promise<ContentEntry> {
        const existing = await this.findOne({
            contentTypeName: opts.contentTypeName,
            id: opts.id,
        });
        if (!existing) throw new Error(`Entry '${opts.id}' not found`);

        // Merge data — only overwrite specified fields
        const mergedData = {
            ...(existing.data as Record<string, unknown>),
            ...opts.data,
        };

        // Validate merged result
        const validation = registry.validateEntry(opts.contentTypeName, mergedData);
        if (!validation.valid) {
            const messages = validation.errors.map((e) => e.message).join("; ");
            throw new Error(`Validation failed: ${messages}`);
        }

        await hookEngine.execute('content:beforeUpdate', {
            entry: mergedData,
            contentType: opts.contentTypeName,
            action: 'update',
            user: opts.updatedBy
        });

        // Snapshot before update
        await this.createVersion(opts.id);

        const branchId = branchStorage.getStore();
        if (branchId) {
            await branchService.saveBranchEntry(branchId, opts.id, "update", mergedData, existing.data as Record<string, unknown>);
            const entry = { ...existing, data: mergedData, updatedBy: opts.updatedBy, updatedAt: new Date() } as ContentEntry;
            rosmariumEvents.emit("content.updated", entry);
            return entry;
        }

        const [entry] = await db
            .update(contentEntries)
            .set({ data: mergedData, updatedBy: opts.updatedBy, updatedAt: new Date() })
            .where(eq(contentEntries.id, opts.id))
            .returning();

        if (!entry) throw new Error("Failed to update content entry");

        await db.insert(auditLog).values({
            userId: opts.updatedBy,
            action: "content.updated",
            resourceId: entry.id,
            resourceType: opts.contentTypeName,
        });

        await hookEngine.execute('content:afterUpdate', {
            entry: entry.data as Record<string, unknown>,
            contentType: opts.contentTypeName,
            action: 'update',
            user: opts.updatedBy
        });

        rosmariumEvents.emit("content.updated", entry);
        return entry;
    },

    async publish(id: string, updatedBy: string): Promise<ContentEntry> {
        const [existing] = await db.select().from(contentEntries).where(eq(contentEntries.id, id)).limit(1);
        if (!existing) throw new Error(`Entry '${id}' not found`);

        let contentTypeName = "unknown";
        for (const ct of registry.getAll()) {
            if (ct.id === existing.contentTypeId) {
                contentTypeName = ct.name;
                break;
            }
        }

        await hookEngine.execute('content:beforePublish', {
            entry: existing.data as Record<string, unknown>,
            contentType: contentTypeName,
            action: 'publish',
            user: updatedBy
        });

        const [entry] = await db
            .update(contentEntries)
            .set({ status: "published", publishedAt: new Date(), updatedBy, updatedAt: new Date() })
            .where(eq(contentEntries.id, id))
            .returning();

        if (!entry) throw new Error(`Entry '${id}' not found`);

        await db.insert(auditLog).values({
            userId: updatedBy,
            action: "content.published",
            resourceId: entry.id,
            resourceType: "content_entry",
        });

        await hookEngine.execute('content:afterPublish', {
            entry: entry.data as Record<string, unknown>,
            contentType: contentTypeName,
            action: 'publish',
            user: updatedBy
        });

        rosmariumEvents.emit("content.published", entry);
        return entry;
    },

    async unpublish(id: string, updatedBy: string): Promise<ContentEntry> {
        const [entry] = await db
            .update(contentEntries)
            .set({ status: "draft", publishedAt: null, updatedBy, updatedAt: new Date() })
            .where(eq(contentEntries.id, id))
            .returning();

        if (!entry) throw new Error(`Entry '${id}' not found`);

        await db.insert(auditLog).values({
            userId: updatedBy,
            action: "content.unpublished",
            resourceId: entry.id,
            resourceType: "content_entry",
        });

        rosmariumEvents.emit("content.unpublished", entry);
        return entry;
    },

    async delete(
        id: string,
        contentTypeName: string,
        deletedBy: string,
    ): Promise<void> {
        const existingEntry = await this.findOne({ contentTypeName, id });
        if (existingEntry) {
            await hookEngine.execute('content:beforeDelete', {
                entry: existingEntry.data as Record<string, unknown>,
                contentType: contentTypeName,
                action: 'delete',
                user: deletedBy
            });
        }

        const branchId = branchStorage.getStore();
        if (branchId) {
            await branchService.saveBranchEntry(branchId, id, "delete", {}, existingEntry?.data as Record<string, unknown>);
            rosmariumEvents.emit("content.deleted", id, contentTypeName);
            return;
        }

        const [row] = await db
            .delete(contentEntries)
            .where(eq(contentEntries.id, id))
            .returning({ id: contentEntries.id });

        if (!row) throw new Error(`Entry '${id}' not found`);

        await db.insert(auditLog).values({
            userId: deletedBy,
            action: "content.deleted",
            resourceId: id,
            resourceType: contentTypeName,
        });

        if (existingEntry) {
            await hookEngine.execute('content:afterDelete', {
                entry: existingEntry.data as Record<string, unknown>,
                contentType: contentTypeName,
                action: 'delete',
                user: deletedBy
            });
        }

        rosmariumEvents.emit("content.deleted", id, contentTypeName);
    },

    async createVersion(entryId: string): Promise<void> {
        const [entry] = await db
            .select()
            .from(contentEntries)
            .where(eq(contentEntries.id, entryId))
            .limit(1);

        if (!entry) return;

        // Get current version count for this entry
        const versionCountResult = await db
            .select({ value: count() })
            .from(auditLog)
            .where(
                and(
                    eq(auditLog.action, "content.version"),
                    eq(auditLog.resourceId as unknown as typeof auditLog.resourceId, entryId),
                ),
            );

        const versionNum = (versionCountResult[0]?.value ?? 0) + 1;

        await db.insert(auditLog).values({
            userId: entry.updatedBy,
            action: "content.version",
            resourceId: entryId,
            resourceType: "content_entry",
            metadata: {
                version: versionNum,
                data: entry.data,
                status: entry.status,
                locale: entry.locale,
            },
        });
    },

    async getVersions(entryId: string): Promise<ContentVersion[]> {
        const rows = await db
            .select()
            .from(auditLog)
            .where(
                and(
                    eq(auditLog.action, "content.version"),
                    sql`${auditLog.resourceId} = ${entryId}`,
                ),
            )
            .orderBy(sql`${auditLog.createdAt} DESC`);

        return rows.map((row) => {
            const meta = row.metadata as Record<string, unknown>;
            return {
                id: row.id,
                version: typeof meta["version"] === "number" ? meta["version"] : 0,
                data:
                    meta["data"] && typeof meta["data"] === "object"
                        ? (meta["data"] as Record<string, unknown>)
                        : {},
                createdBy: row.userId,
                createdAt: row.createdAt,
            };
        });
    },

    async restoreVersion(
        entryId: string,
        versionId: string,
        restoredBy: string,
    ): Promise<ContentEntry> {
        const [versionRow] = await db
            .select()
            .from(auditLog)
            .where(
                and(
                    eq(auditLog.id, versionId),
                    eq(auditLog.action, "content.version"),
                    sql`${auditLog.resourceId} = ${entryId}`,
                ),
            )
            .limit(1);

        if (!versionRow) throw new Error(`Version '${versionId}' not found`);

        const meta = versionRow.metadata as Record<string, unknown>;
        const restoredData =
            meta["data"] && typeof meta["data"] === "object"
                ? (meta["data"] as Record<string, unknown>)
                : {};

        // Snapshot current state before overwriting
        await this.createVersion(entryId);

        const [entry] = await db
            .update(contentEntries)
            .set({ data: restoredData, updatedBy: restoredBy, updatedAt: new Date() })
            .where(eq(contentEntries.id, entryId))
            .returning();

        if (!entry) throw new Error(`Entry '${entryId}' not found`);

        await db.insert(auditLog).values({
            userId: restoredBy,
            action: "content.restored",
            resourceId: entryId,
            resourceType: "content_entry",
            metadata: { fromVersion: versionId },
        });

        rosmariumEvents.emit("content.updated", entry);
        return entry;
    },
};
