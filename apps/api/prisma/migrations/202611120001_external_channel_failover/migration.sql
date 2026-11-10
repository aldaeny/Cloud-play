-- Additive, disabled-by-default channels and reports. Never promotes existing servers.
CREATE TABLE "ProviderGroup" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ProviderGroup_u0" UNIQUE ("tenantId","id"),
  CONSTRAINT "ProviderGroup_u1" UNIQUE ("tenantId","name")
);
CREATE TABLE "ExternalChannel" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "autoFailover" BOOLEAN NOT NULL DEFAULT false,
  "failureThreshold" INTEGER NOT NULL DEFAULT 2,
  "retrySeconds" INTEGER NOT NULL DEFAULT 60,
  "holdDownSeconds" INTEGER NOT NULL DEFAULT 120,
  "stabilitySeconds" INTEGER NOT NULL DEFAULT 180,
  "freshnessSeconds" INTEGER NOT NULL DEFAULT 900,
  "activeSourceId" UUID,
  "lastSwitchAt" TIMESTAMPTZ,
  "lastEvaluationAt" TIMESTAMPTZ,
  "outageStartedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ExternalChannel_u0" UNIQUE ("tenantId","id"),
  CONSTRAINT "ExternalChannel_u1" UNIQUE ("tenantId","groupId","name")
);
CREATE TABLE "ChannelSource" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "channelId" UUID NOT NULL,
  "serverId" UUID NOT NULL,
  "priority" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "healthySince" TIMESTAMPTZ,
  "lastObservedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ChannelSource_u0" UNIQUE ("tenantId","channelId","id"),
  CONSTRAINT "ChannelSource_u1" UNIQUE ("tenantId","channelId","serverId"),
  CONSTRAINT "ChannelSource_u2" UNIQUE ("tenantId","channelId","priority")
);
CREATE TABLE "ExternalFailoverEvent" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "channelId" UUID NOT NULL,
  "fromSourceId" UUID,
  "toSourceId" UUID,
  "reason" TEXT NOT NULL,
  "outageDurationMs" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ExternalReportSchedule" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "period" TEXT NOT NULL DEFAULT 'weekly',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "deliveryApproved" BOOLEAN NOT NULL DEFAULT false,
  "nextRunAt" TIMESTAMPTZ NOT NULL,
  "leaseUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ExternalReportSchedule_u0" UNIQUE ("tenantId","id"),
  CONSTRAINT "ExternalReportSchedule_u1" UNIQUE ("tenantId","period")
);
CREATE TABLE "ExternalReportDelivery" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "scheduleId" UUID NOT NULL,
  "periodStart" TIMESTAMPTZ NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ NOT NULL,
  "leaseUntil" TIMESTAMPTZ,
  "lastError" TEXT,
  "deliveredAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ExternalReportDelivery_u0" UNIQUE ("scheduleId","periodStart")
);
ALTER TABLE "ProviderGroup" ADD FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id");
ALTER TABLE "ProviderGroup" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ProviderGroup" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "ProviderGroup" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "ProviderGroup" FROM authenticated; END IF; END $$;
ALTER TABLE "ExternalChannel" ADD FOREIGN KEY ("tenantId","groupId") REFERENCES "ProviderGroup" ("tenantId","id");
ALTER TABLE "ExternalChannel" ADD FOREIGN KEY ("tenantId","id","activeSourceId") REFERENCES "ChannelSource" ("tenantId","channelId","id");
ALTER TABLE "ExternalChannel" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ExternalChannel" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "ExternalChannel" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "ExternalChannel" FROM authenticated; END IF; END $$;
ALTER TABLE "ChannelSource" ADD FOREIGN KEY ("tenantId","channelId") REFERENCES "ExternalChannel" ("tenantId","id");
ALTER TABLE "ChannelSource" ADD FOREIGN KEY ("tenantId","serverId") REFERENCES "ExternalServer" ("tenantId","id");
ALTER TABLE "ChannelSource" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ChannelSource" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "ChannelSource" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "ChannelSource" FROM authenticated; END IF; END $$;
ALTER TABLE "ExternalFailoverEvent" ADD FOREIGN KEY ("tenantId","channelId") REFERENCES "ExternalChannel" ("tenantId","id");
ALTER TABLE "ExternalFailoverEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ExternalFailoverEvent" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "ExternalFailoverEvent" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "ExternalFailoverEvent" FROM authenticated; END IF; END $$;
ALTER TABLE "ExternalReportSchedule" ADD FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id");
ALTER TABLE "ExternalReportSchedule" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ExternalReportSchedule" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "ExternalReportSchedule" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "ExternalReportSchedule" FROM authenticated; END IF; END $$;
ALTER TABLE "ExternalReportDelivery" ADD FOREIGN KEY ("tenantId","scheduleId") REFERENCES "ExternalReportSchedule" ("tenantId","id");
ALTER TABLE "ExternalReportDelivery" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ExternalReportDelivery" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON "ExternalReportDelivery" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON "ExternalReportDelivery" FROM authenticated; END IF; END $$;
CREATE UNIQUE INDEX "ChannelSource_one_primary" ON "ChannelSource"("tenantId","channelId") WHERE role='primary';
ALTER TABLE "ChannelSource" ADD CHECK (priority BETWEEN 1 AND 20000), ADD CHECK (role IN ('primary','secondary'));
ALTER TABLE "ExternalChannel" ADD CHECK ("failureThreshold" BETWEEN 1 AND 10), ADD CHECK ("retrySeconds" BETWEEN 5 AND 3600), ADD CHECK ("holdDownSeconds" BETWEEN 0 AND 86400), ADD CHECK ("stabilitySeconds" BETWEEN 0 AND 86400), ADD CHECK ("freshnessSeconds" BETWEEN 60 AND 3600);
ALTER TABLE "ExternalReportSchedule" ADD CHECK (period IN ('daily','weekly'));
CREATE INDEX "ExternalChannel_tenantId_enabled_idx" ON "ExternalChannel"("tenantId",enabled);
CREATE INDEX "ExternalFailoverEvent_history_idx" ON "ExternalFailoverEvent"("tenantId","channelId","createdAt");
CREATE INDEX "ExternalReportSchedule_due_idx" ON "ExternalReportSchedule"(enabled,"nextRunAt");
CREATE INDEX "ExternalReportDelivery_due_idx" ON "ExternalReportDelivery"(status,"nextAttemptAt");
