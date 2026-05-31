ALTER TABLE "workflows" DROP CONSTRAINT "workflows_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "workflows" DROP COLUMN "tenant_id";