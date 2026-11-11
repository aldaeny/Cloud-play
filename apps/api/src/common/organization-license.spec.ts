import { requireOrganization } from './organization-license';
describe('organization license read enforcement',()=>{
  it('preserves opt-in compatibility but never treats missing org as allowed',async()=>{
    const findUnique=jest.fn().mockResolvedValue({licenseEnforced:false});
    await expect(requireOrganization({tenant:{findUnique}} as never,'tenant-a')).resolves.toBeUndefined();
    findUnique.mockResolvedValue(null);
    await expect(requireOrganization({tenant:{findUnique}} as never,'tenant-a')).rejects.toThrow('ORGANIZATION_UNAVAILABLE');
  });
  it.each(['revoked','suspended','unlicensed'])('denies status %s',async licenseStatus=>{
    await expect(requireOrganization({tenant:{findUnique:async()=>({licenseEnforced:true,licenseStatus,licenseExpiresAt:new Date(Date.now()+100000)})}} as never,'a')).rejects.toThrow('ORGANIZATION_LICENSE_REQUIRED');
  });
  it('denies expired license even when status remains active',async()=>{
    await expect(requireOrganization({tenant:{findUnique:async()=>({licenseEnforced:true,licenseStatus:'active',licenseExpiresAt:new Date(0)})}} as never,'a')).rejects.toThrow('ORGANIZATION_LICENSE_REQUIRED');
  });
});
