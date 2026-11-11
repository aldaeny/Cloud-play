CREATE TABLE "ServerSchedule" (
"serverId" UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "actorId" UUID NOT NULL,
"intervalSeconds" INTEGER NOT NULL CHECK ("intervalSeconds" IN (900,3600,86400,604800)),
timezone TEXT NOT NULL DEFAULT 'Asia/Baghdad', enabled BOOLEAN NOT NULL DEFAULT false,
"nextRunAt" TIMESTAMPTZ NOT NULL, "leaseUntil" TIMESTAMPTZ, "lastError" TEXT,
"createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL,
FOREIGN KEY ("tenantId","serverId") REFERENCES "ExternalServer"("tenantId",id));
CREATE UNIQUE INDEX "ServerSchedule_tenantId_serverId_key" ON "ServerSchedule"("tenantId","serverId");
CREATE INDEX "ServerSchedule_enabled_nextRunAt_idx" ON "ServerSchedule"(enabled,"nextRunAt");
ALTER TABLE "ServerSchedule" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ServerSchedule" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "ServerSchedule" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "ServerSchedule" FROM authenticated; END IF; END $$;
