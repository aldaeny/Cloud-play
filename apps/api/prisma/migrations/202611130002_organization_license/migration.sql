-- Additive opt-in: existing tenants are never silently locked out.
ALTER TABLE "Tenant"
 ADD COLUMN "licenseEnforced" boolean NOT NULL DEFAULT false,
 ADD COLUMN "licenseTier" text,
 ADD COLUMN "licenseStatus" text NOT NULL DEFAULT 'unlicensed',
 ADD COLUMN "licenseExpiresAt" timestamptz,
 ADD COLUMN "maxUsers" integer NOT NULL DEFAULT 0,
 ADD COLUMN "maxStaff" integer NOT NULL DEFAULT 0,
 ADD COLUMN "maxServers" integer NOT NULL DEFAULT 0,
 ADD COLUMN "maxTitles" integer NOT NULL DEFAULT 0,
 ADD CONSTRAINT organization_status CHECK ("licenseStatus" IN ('unlicensed','active','suspended','revoked')),
 ADD CONSTRAINT organization_limits CHECK ("maxUsers">=0 AND "maxStaff">=0 AND "maxServers">=0 AND "maxTitles">=0);

CREATE FUNCTION cloudplay_organization_quota() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org "Tenant"%ROWTYPE; used bigint; lim integer;
BEGIN
 -- Moving objects between tenants would bypass both accounting and ownership.
 IF TG_OP='UPDATE' THEN
  IF NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN RAISE EXCEPTION 'TENANT_REASSIGNMENT_FORBIDDEN' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 -- One lock across every quota table, on every replica, held to commit/rollback.
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW."tenantId"::text, 837201630));
 SELECT * INTO org FROM "Tenant" WHERE id=NEW."tenantId" FOR SHARE;
 IF NOT FOUND THEN RETURN NEW; END IF; -- regular FK reports missing tenant
 IF NOT org."licenseEnforced" THEN RETURN NEW; END IF;
 IF org."licenseStatus" <> 'active' OR org."licenseExpiresAt" IS NULL OR org."licenseExpiresAt" <= now() THEN
  RAISE EXCEPTION 'ORGANIZATION_LICENSE_REQUIRED' USING ERRCODE='23514';
 END IF;
 CASE TG_TABLE_NAME
 WHEN 'AppUser' THEN SELECT count(*) INTO used FROM "AppUser" WHERE "tenantId"=NEW."tenantId"; lim:=org."maxUsers";
 WHEN 'StaffUser' THEN SELECT count(*) INTO used FROM "StaffUser" WHERE "tenantId"=NEW."tenantId"; lim:=org."maxStaff";
 WHEN 'Title' THEN SELECT count(*) INTO used FROM "Title" WHERE "tenantId"=NEW."tenantId"; lim:=org."maxTitles";
 ELSE
  SELECT (SELECT count(*) FROM "XtreamServer" WHERE "tenantId"=NEW."tenantId") +
   (SELECT count(*) FROM "ExternalServer" WHERE "tenantId"=NEW."tenantId" AND "deletedAt" IS NULL) INTO used;
  lim:=org."maxServers";
 END CASE;
 IF used>=lim THEN RAISE EXCEPTION 'ORGANIZATION_QUOTA_EXCEEDED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER organization_users BEFORE INSERT OR UPDATE OF "tenantId" ON "AppUser" FOR EACH ROW EXECUTE FUNCTION cloudplay_organization_quota();
CREATE TRIGGER organization_staff BEFORE INSERT OR UPDATE OF "tenantId" ON "StaffUser" FOR EACH ROW EXECUTE FUNCTION cloudplay_organization_quota();
CREATE TRIGGER organization_titles BEFORE INSERT OR UPDATE OF "tenantId" ON "Title" FOR EACH ROW EXECUTE FUNCTION cloudplay_organization_quota();
CREATE TRIGGER organization_xtream BEFORE INSERT OR UPDATE OF "tenantId" ON "XtreamServer" FOR EACH ROW EXECUTE FUNCTION cloudplay_organization_quota();
CREATE TRIGGER organization_external BEFORE INSERT OR UPDATE OF "tenantId" ON "ExternalServer" FOR EACH ROW EXECUTE FUNCTION cloudplay_organization_quota();
