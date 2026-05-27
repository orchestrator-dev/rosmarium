# Rosmarium CMS: Multi-Tenancy Model

Rosmarium CMS v0.10.0 introduces PostgreSQL namespace-based multi-tenancy.

## Data Isolation Strategy

Instead of relying heavily on Row-Level Security (RLS) which can degrade performance in deeply nested graph queries, Rosmarium utilizes **Schema-based Isolation**:
- **`public` schema**: Contains the global `tenants` catalog.
- **`tenant_{slug}` schemas**: Each tenant gets an isolated schema containing `users`, `content_entries`, `graph_edges`, and configuration.

## How it works

1. **Provisioning**: When a tenant is created via `POST /api/admin/tenants`, the `tenantService` executes a `CREATE SCHEMA` command and runs all Drizzle migrations using a connection scoped to that schema.
2. **Runtime Routing**: Fastify reads the `X-Tenant-ID` header (or resolves via subdomain lookup).
3. **Async Context**: The `tenantStorage` (an `AsyncLocalStorage` instance) captures the resolved tenant slug.
4. **Proxy Querying**: The globally exported `db` is a `Proxy` that dynamically routes queries to a `postgres` connection pool scoped to `search_path=tenant_{slug},public`.

## Tenant Provisioning API

```http
POST /api/admin/tenants
Headers:
  Authorization: Bearer <super_admin_token>

{
  "slug": "acme-corp",
  "name": "Acme Corp",
  "plan": "pro",
  "adminEmail": "admin@acme.com",
  "adminPassword": "SecurePassword123!"
}
```

This creates the schema `tenant_acme-corp`, runs all database migrations, and provisions the initial `super_admin` user inside that tenant's space.
