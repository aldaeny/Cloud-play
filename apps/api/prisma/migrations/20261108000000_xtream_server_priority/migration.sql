-- Multi-server management: selection priority + explicit default.
--
-- ADDITIVE AND NON-DESTRUCTIVE. Adds two columns with safe defaults, one index,
-- and a partial unique index. No column is dropped, no data is rewritten, and
-- existing rows keep working: priority defaults to 100 and isDefault to false,
-- so current selection behaviour is unchanged until an operator sets a default.
--
-- NOT YET APPLIED to any database. The XtreamServer table does not exist in the
-- Supabase project yet (the whole Prisma schema is unapplied), so this migration
-- runs as part of the initial apply, which is held for explicit approval.
--
-- Rollback: see rollback.sql in this directory.

-- AlterTable
ALTER TABLE "XtreamServer"
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Bound the preference range so a bad value cannot distort ordering.
ALTER TABLE "XtreamServer"
  ADD CONSTRAINT "XtreamServer_priority_range" CHECK ("priority" BETWEEN 1 AND 1000);

-- CreateIndex: supports ordered selection of enabled servers per tenant.
CREATE INDEX "XtreamServer_tenantId_enabled_priority_idx"
  ON "XtreamServer"("tenantId", "enabled", "priority");

-- At most one default server per tenant. A partial unique index is used instead
-- of a plain unique constraint because (tenantId, isDefault) would also forbid
-- more than one NON-default server, which is wrong. Prisma cannot express
-- partial indexes, so this lives here and is intentionally not in schema.prisma.
CREATE UNIQUE INDEX "XtreamServer_one_default_per_tenant"
  ON "XtreamServer"("tenantId") WHERE "isDefault" = true;
