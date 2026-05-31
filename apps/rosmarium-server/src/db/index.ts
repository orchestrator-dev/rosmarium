import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "../config.js";
import * as schema from "./schema/index.js";
import { AsyncLocalStorage } from "node:async_hooks";

export const tenantStorage = new AsyncLocalStorage<string>();
export const branchStorage = new AsyncLocalStorage<string>();

const client = postgres(config.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
});

const defaultDb = drizzle(client, {
    schema,
    logger: config.NODE_ENV === "development",
});

const tenantPools = new Map<string, postgres.Sql>();

function getTenantDb(slug: string) {
    if (!tenantPools.has(slug)) {
        const tenantClient = postgres(config.DATABASE_URL, {
            max: 5,
            idle_timeout: 20,
            connect_timeout: 10,
            connection: { search_path: `tenant_${slug},public` }
        });
        tenantPools.set(slug, tenantClient);
    }
    return drizzle(tenantPools.get(slug)!, {
        schema,
        logger: config.NODE_ENV === "development",
    });
}

export const db = new Proxy(defaultDb, {
    get(target, prop, receiver) {
        const tenantSlug = tenantStorage.getStore();
        if (tenantSlug) {
            const tenantDb = getTenantDb(tenantSlug);
            return Reflect.get(tenantDb, prop, receiver);
        }
        return Reflect.get(target, prop, receiver);
    }
});

export { client as pool };
