ALTER TABLE "ExternalFailoverEvent" ADD CONSTRAINT "external_switch_from_tenant_fk" FOREIGN KEY ("tenantId","channelId","fromSourceId") REFERENCES "ChannelSource"("tenantId","channelId",id);
ALTER TABLE "ExternalFailoverEvent" ADD CONSTRAINT "external_switch_to_tenant_fk" FOREIGN KEY ("tenantId","channelId","toSourceId") REFERENCES "ChannelSource"("tenantId","channelId",id);
