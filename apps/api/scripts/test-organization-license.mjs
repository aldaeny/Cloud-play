import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function testOrganizationLicense(client, check) {
  const org = await client.tenant.create({data:{licenseEnforced:true,licenseTier:'Starter',licenseStatus:'active',licenseExpiresAt:new Date(Date.now()+86400000),maxUsers:1,maxStaff:1,maxServers:1,maxTitles:1}});
  const other = await client.tenant.create({data:{}});
  try {
    await check('organization user quota is atomic across concurrent native transactions; no tenant reassignment',async()=>{
      const results=await Promise.allSettled([0,1,2,3].map(i=>client.$transaction(tx=>tx.appUser.create({data:{tenantId:org.id,email:`${randomUUID()}-${i}@fixture.invalid`}}))));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      assert.equal(await client.appUser.count({where:{tenantId:org.id}}),1);
      const user=await client.appUser.findFirst({where:{tenantId:org.id}});
      await assert.rejects(client.appUser.update({where:{id:user.id},data:{tenantId:other.id}}));
    });
    await check('organization license expiry, suspension and revocation deny inserts; renewal re-enables within quota',async()=>{
      for(const data of [{licenseStatus:'suspended'},{licenseStatus:'revoked'},{licenseStatus:'active',licenseExpiresAt:new Date(0)}]){
        await client.tenant.update({where:{id:org.id},data});
        await assert.rejects(client.title.create({data:{tenantId:org.id,kind:'MOVIE',maturityRating:'G',genres:[],titleAr:'صناعي',titleEn:'Synthetic'}}));
      }
      await client.tenant.update({where:{id:org.id},data:{licenseStatus:'active',licenseExpiresAt:new Date(Date.now()+86400000)}});
      await client.title.create({data:{tenantId:org.id,kind:'MOVIE',maturityRating:'G',genres:[],titleAr:'صناعي',titleEn:'Synthetic'}});
      await assert.rejects(client.title.create({data:{tenantId:org.id,kind:'MOVIE',maturityRating:'G',genres:[],titleAr:'صناعي',titleEn:'Over limit'}}));
      await client.title.create({data:{tenantId:other.id,kind:'MOVIE',maturityRating:'G',genres:[],titleAr:'صناعي',titleEn:'Other tenant unaffected'}});
    });
    await check('organization server quota spans Xtream and external server tables',async()=>{
      await client.xtreamServer.create({data:{tenantId:org.id,name:'Synthetic',baseUrl:'https://example.invalid',username:'synthetic',passwordEncrypted:'synthetic-not-used'}});
      await assert.rejects(client.externalServer.create({data:{tenantId:org.id,name:'Synthetic',providerName:'Fixture',protocol:'hls',endpointEncrypted:'synthetic-not-used',country:'IQ',category:'test'}}));
    });
    await check('organization transaction rollback does not consume quota',async()=>{
      await assert.rejects(client.$transaction(async tx=>{await tx.staffUser.create({data:{tenantId:org.id,email:'rollback@fixture.invalid',passwordHash:'unused',role:{create:{tenantId:org.id,name:'Fixture',permissions:'[]'}}}});throw new Error('intentional rollback');}));
      assert.equal(await client.staffUser.count({where:{tenantId:org.id}}),0);
    });
  } finally {
    const ids=[org.id,other.id];
    await client.appUser.deleteMany({where:{tenantId:{in:ids}}});
    await client.title.deleteMany({where:{tenantId:{in:ids}}});
    await client.xtreamServer.deleteMany({where:{tenantId:{in:ids}}});
    await client.tenant.deleteMany({where:{id:{in:ids}}});
  }
}
