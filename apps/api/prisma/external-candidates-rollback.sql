-- Destructive only to NEW feature tables; explicit approval/backup required.
BEGIN;
DROP TABLE "ServerHealthCheck";
DROP TABLE "LicenseReview";
DROP TABLE "ServerAuditLog";
DROP TABLE "ExternalServer";
DROP TABLE "ContentLicense";
COMMIT;
