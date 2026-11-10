-- Rollback for 20261108000000_xtream_server_priority.
--
-- Safe because the migration is purely additive: dropping these objects returns
-- the table to its previous shape. The only loss is the operator's priority and
-- default preferences, which are configuration, not user content. No user,
-- subscription or media row is touched.
--
-- Run inside a transaction. If the forward migration was never applied, this
-- script is a no-op thanks to IF EXISTS.

BEGIN;

DROP INDEX IF EXISTS "XtreamServer_one_default_per_tenant";
DROP INDEX IF EXISTS "XtreamServer_tenantId_enabled_priority_idx";
ALTER TABLE "XtreamServer" DROP CONSTRAINT IF EXISTS "XtreamServer_priority_range";
ALTER TABLE "XtreamServer"
  DROP COLUMN IF EXISTS "isDefault",
  DROP COLUMN IF EXISTS "priority";

COMMIT;
