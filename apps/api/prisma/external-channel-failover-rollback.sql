-- Explicit approval/backup required. New feature state only; never run automatically.
BEGIN;
ALTER TABLE "ExternalChannel" DROP CONSTRAINT "ExternalChannel_tenantId_id_activeSourceId_fkey";
DROP TABLE "ExternalReportDelivery", "ExternalReportSchedule", "ExternalFailoverEvent", "ChannelSource", "ExternalChannel", "ProviderGroup";
COMMIT;
