import { describe, it, expect, vi, beforeEach } from "vitest";
import { tenantService } from "./tenant.service.js";
import { db } from "../../db/index.js";

// Mock external dependencies
vi.mock("../../db/index.js", () => ({
    db: {
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: "test-id", slug: "test-slug", name: "Test Tenant", plan: "starter" }])
            })
        }),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ id: "test-id", isActive: false }])
            })
        }),
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ id: "test-id", slug: "test-slug", name: "Test Tenant", isActive: true }])
            })
        })
    }
}));

vi.mock("../../config.js", () => ({
    config: {
        DATABASE_URL: "postgres://fake:fake@localhost:5432/cortex",
        NODE_ENV: "test"
    }
}));

vi.mock("postgres", () => {
    return {
        default: vi.fn().mockReturnValue({
            unsafe: vi.fn().mockResolvedValue([]),
            end: vi.fn().mockResolvedValue([])
        })
    };
});

vi.mock("drizzle-orm/postgres-js/migrator", () => ({
    migrate: vi.fn().mockResolvedValue([])
}));

vi.mock("drizzle-orm/postgres-js", () => ({
    drizzle: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: "admin-id", email: "admin@test.com" }])
            })
        })
    })
}));

describe("TenantService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should provision a new tenant and create its schema", async () => {
        const result = await tenantService.provision({
            slug: "test-slug",
            name: "Test Tenant",
            plan: "starter",
            adminEmail: "admin@test.com",
            adminPassword: "Password123!"
        });

        expect(result.tenant.slug).toBe("test-slug");
        expect(result.adminUser.email).toBe("admin@test.com");
    });

    it("should throw error for invalid slugs", async () => {
        await expect(tenantService.provision({
            slug: "Invalid_Slug!",
            name: "Test",
            plan: "free",
            adminEmail: "admin@test.com",
            adminPassword: "Password123!"
        })).rejects.toThrow("Invalid slug format");
    });

    it("should get a tenant by slug", async () => {
        const result = await tenantService.getTenant("test-slug");
        expect(result).toBeDefined();
        expect(result?.slug).toBe("test-slug");
    });

    it("should deprovision a tenant", async () => {
        await tenantService.deprovision("test-id");
        expect(db.update).toHaveBeenCalled();
    });
});
