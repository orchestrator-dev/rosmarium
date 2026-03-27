import { sql, isNull, isNotNull, type SQL } from "drizzle-orm";
import { contentEntries } from "../../db/schema/index.js";
import type { ParsedContentType } from "./registry.js";

export type FilterOperator =
    | "eq"
    | "ne"
    | "lt"
    | "lte"
    | "gt"
    | "gte"
    | "in"
    | "nin"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "null"
    | "notNull";

export type ParsedFilters = Record<
    string,
    Partial<Record<FilterOperator, string>>
>;

export type SortInput = Array<{ field: string; direction: "asc" | "desc" }>;

const SYSTEM_FIELDS = new Set([
    "id",
    "locale",
    "status",
    "publishedAt",
    "createdBy",
    "updatedBy",
    "createdAt",
    "updatedAt",
]);

/** Maps system field names to Drizzle column references. */
function getSystemColumn(field: string): SQL | null {
    switch (field) {
        case "id": return sql`${contentEntries.id}`;
        case "locale": return sql`${contentEntries.locale}`;
        case "status": return sql`${contentEntries.status}`;
        case "publishedAt": return sql`${contentEntries.publishedAt}`;
        case "createdBy": return sql`${contentEntries.createdBy}`;
        case "updatedBy": return sql`${contentEntries.updatedBy}`;
        case "createdAt": return sql`${contentEntries.createdAt}`;
        case "updatedAt": return sql`${contentEntries.updatedAt}`;
        default: return null;
    }
}

/** Safe field name for JSONB access — must match camelCase pattern from field-types. */
function safeFieldName(name: string): string {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
        throw new Error(`Invalid filter field name: '${name}'`);
    }
    return name;
}

/** Build a JSONB text extraction expression: data->>'fieldName' */
function jsonbText(fieldName: string): SQL {
    const safe = safeFieldName(fieldName);
    return sql.raw(`(${contentEntries.data.name}->>'${safe}')`);
}

function buildCondition(
    field: string,
    operator: FilterOperator,
    value: string,
    contentType: ParsedContentType,
): SQL | null {
    const isSystem = SYSTEM_FIELDS.has(field);

    if (!isSystem) {
        const knownField = contentType.fields.find((f) => f.name === field);
        if (!knownField) {
            throw new Error(`Unknown filter field: '${field}'`);
        }
    }

    // For null/notNull operators, no value needed
    if (operator === "null") {
        return isSystem
            ? isNull(getSystemColumn(field) as SQL)
            : sql`${jsonbText(field)} IS NULL`;
    }
    if (operator === "notNull") {
        return isSystem
            ? isNotNull(getSystemColumn(field) as SQL)
            : sql`${jsonbText(field)} IS NOT NULL`;
    }

    if (isSystem) {
        const col = getSystemColumn(field);
        if (!col) return null;
        switch (operator) {
            case "eq": return sql`${col} = ${value}`;
            case "ne": return sql`${col} != ${value}`;
            case "lt": return sql`${col} < ${value}`;
            case "lte": return sql`${col} <= ${value}`;
            case "gt": return sql`${col} > ${value}`;
            case "gte": return sql`${col} >= ${value}`;
            case "in": return sql`${col} = ANY(${value.split(",")})`;
            case "nin": return sql`NOT (${col} = ANY(${value.split(",")}))`;
            case "contains": return sql`${col}::text ILIKE ${"%" + value + "%"}`;
            case "startsWith": return sql`${col}::text ILIKE ${value + "%"}`;
            case "endsWith": return sql`${col}::text ILIKE ${"%" + value}`;
            default: return null;
        }
    } else {
        // JSONB data field
        const jt = jsonbText(field);
        switch (operator) {
            case "eq": return sql`${jt} = ${value}`;
            case "ne": return sql`${jt} != ${value}`;
            case "lt": return sql`${jt} < ${value}`;
            case "lte": return sql`${jt} <= ${value}`;
            case "gt": return sql`${jt} > ${value}`;
            case "gte": return sql`${jt} >= ${value}`;
            case "in": return sql`${jt} = ANY(${value.split(",")})`;
            case "nin": return sql`NOT (${jt} = ANY(${value.split(",")}))`;
            case "contains": return sql`${jt} ILIKE ${"%" + value + "%"}`;
            case "startsWith": return sql`${jt} ILIKE ${value + "%"}`;
            case "endsWith": return sql`${jt} ILIKE ${"%" + value}`;
            default: return null;
        }
    }
}

const VALID_OPERATORS = new Set<FilterOperator>([
    "eq", "ne", "lt", "lte", "gt", "gte",
    "in", "nin", "contains", "startsWith", "endsWith",
    "null", "notNull",
]);

function isValidOperator(op: string): op is FilterOperator {
    return VALID_OPERATORS.has(op as FilterOperator);
}

/** Build an array of SQL WHERE conditions from parsed filter params. */
export function buildWhereClause(
    filters: ParsedFilters,
    contentType: ParsedContentType,
): SQL[] {
    const conditions: SQL[] = [];

    for (const [field, ops] of Object.entries(filters)) {
        if (!ops) continue;
        for (const [rawOp, value] of Object.entries(ops)) {
            if (!isValidOperator(rawOp)) {
                throw new Error(`Invalid filter operator: '${rawOp}'`);
            }
            if (value === undefined) continue;
            const condition = buildCondition(field, rawOp, value, contentType);
            if (condition) conditions.push(condition);
        }
    }

    return conditions;
}

/** Build Drizzle ORDER BY clauses from sort input. */
export function buildOrderBy(
    sort: SortInput,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    contentType: ParsedContentType,
): SQL[] {
    return sort.map(({ field, direction }) => {
        const isSystem = SYSTEM_FIELDS.has(field);
        const col = isSystem ? getSystemColumn(field) : jsonbText(field);
        if (!col) throw new Error(`Unknown sort field: '${field}'`);

        return direction === "asc"
            ? sql`${col} ASC NULLS LAST`
            : sql`${col} DESC NULLS LAST`;
    });
}

/** Build cursor pagination: decode cursor → extra WHERE clause. */
export function buildPagination(
    cursor: string | undefined,
    limit: number,
): { where: SQL | null; limit: number } {
    if (!cursor) {
        return { where: null, limit: limit + 1 };
    }

    let decodedId: string;
    try {
        decodedId = Buffer.from(cursor, "base64url").toString("utf8");
    } catch {
        throw new Error("Invalid pagination cursor");
    }

    return {
        where: sql`${contentEntries.id} > ${decodedId}`,
        limit: limit + 1,
    };
}

/** Encode an entry ID into an opaque cursor. */
export function encodeCursor(id: string): string {
    return Buffer.from(id, "utf8").toString("base64url");
}
