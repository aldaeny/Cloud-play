-- Additive candidate/rights tables. No existing provider is promoted or changed.
CREATE TABLE "ContentLicense" (id UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "provider" TEXT NOT NULL, "contentOwner" TEXT NOT NULL, "authorizedContact" TEXT NOT NULL,
"authorizationType" TEXT NOT NULL, "allowedPlatforms" TEXT[] NOT NULL, "allowedCountries" TEXT[] NOT NULL,
"commercialUse" BOOLEAN NOT NULL DEFAULT false, "redistributionPermission" BOOLEAN NOT NULL DEFAULT false,
"territoryRestrictions" TEXT NOT NULL, "startDate" TIMESTAMPTZ NOT NULL, "expiryDate" TIMESTAMPTZ NOT NULL,
"status" TEXT NOT NULL DEFAULT 'licensing_unverified', "verificationNotes" TEXT NOT NULL DEFAULT '',
"reviewedBy" UUID, "reviewDate" TIMESTAMPTZ, "updatedAt" TIMESTAMPTZ NOT NULL,
FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id), CHECK ("expiryDate" > "startDate"), UNIQUE ("tenantId",id));
ALTER TABLE "ContentLicense" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ContentLicense" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "ContentLicense" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "ContentLicense" FROM authenticated; END IF; END $$;
CREATE TABLE "ExternalServer" (id UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "name" TEXT NOT NULL, "providerName" TEXT NOT NULL, "protocol" TEXT NOT NULL,
"endpointEncrypted" TEXT NOT NULL, "xtreamServerId" UUID, "country" TEXT NOT NULL, "category" TEXT NOT NULL,
"priority" INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 1 AND 1000), "notes" TEXT NOT NULL DEFAULT '',
"status" TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','production_enabled')),
"enabled" BOOLEAN NOT NULL DEFAULT false, "licenseId" UUID, "lastCheckedAt" TIMESTAMPTZ, "lastSuccessfulCheck" TIMESTAMPTZ,
"deletedAt" TIMESTAMPTZ, "updatedAt" TIMESTAMPTZ NOT NULL,
FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id),
FOREIGN KEY ("tenantId","licenseId") REFERENCES "ContentLicense"("tenantId",id),
FOREIGN KEY ("xtreamServerId") REFERENCES "XtreamServer"(id), UNIQUE ("tenantId",id));
CREATE UNIQUE INDEX "ExternalServer_tenantId_name_key" ON "ExternalServer"("tenantId",name);
ALTER TABLE "ExternalServer" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ExternalServer" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "ExternalServer" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "ExternalServer" FROM authenticated; END IF; END $$;
CREATE TABLE "LicenseReview" (id UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "licenseId" UUID NOT NULL, "reviewedBy" UUID NOT NULL, "status" TEXT NOT NULL, "notes" TEXT NOT NULL,
FOREIGN KEY ("tenantId","licenseId") REFERENCES "ContentLicense"("tenantId",id));
ALTER TABLE "LicenseReview" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "LicenseReview" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "LicenseReview" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "LicenseReview" FROM authenticated; END IF; END $$;
CREATE TABLE "ServerHealthCheck" (id UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "serverId" UUID NOT NULL, "startedAt" TIMESTAMPTZ NOT NULL, "finishedAt" TIMESTAMPTZ NOT NULL,
"result" TEXT NOT NULL, "details" JSONB NOT NULL,
FOREIGN KEY ("tenantId","serverId") REFERENCES "ExternalServer"("tenantId",id));
ALTER TABLE "ServerHealthCheck" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ServerHealthCheck" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "ServerHealthCheck" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "ServerHealthCheck" FROM authenticated; END IF; END $$;
CREATE TABLE "ServerAuditLog" (id UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "actorId" UUID NOT NULL, "entityId" UUID NOT NULL, "action" TEXT NOT NULL);
ALTER TABLE "ServerAuditLog" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ServerAuditLog" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "ServerAuditLog" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "ServerAuditLog" FROM authenticated; END IF; END $$;
CREATE INDEX "ExternalServer_lookup" ON "ExternalServer"("tenantId",status,priority);
CREATE INDEX "ContentLicense_lookup" ON "ContentLicense"("tenantId",status,"expiryDate");
CREATE INDEX "LicenseReview_lookup" ON "LicenseReview"("tenantId","licenseId","createdAt");
CREATE INDEX "ServerHealthCheck_lookup" ON "ServerHealthCheck"("tenantId","serverId","startedAt");
CREATE INDEX "ServerAuditLog_lookup" ON "ServerAuditLog"("tenantId","entityId","createdAt");
