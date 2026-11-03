// Disposable PostgreSQL and local API only; never use production credentials or data.
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const db = new PrismaClient();
const base = process.env.API_URL || 'http://127.0.0.1:3100';
if (!process.env.DATABASE_URL || !process.env.JWT_ACCESS_SECRET) throw Error('Test settings required');
async function req(path, token, method = 'GET', body) {
  const res = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? {'content-type':'application/json'} : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
function expectStatus(result, expected, label) {
  if (result.status !== expected) throw Error(`${label}: expected ${expected}, got ${result.status} ${JSON.stringify(result.data)}`);
  console.log('PASS', label, expected); return result.data;
}
function noHashes(value, label) {
  if (/"(passwordHash|pinHash)"/.test(JSON.stringify(value))) throw Error(`${label} leaked a hash`);
  console.log('PASS', label, 'does not expose hashes');
}
(async () => {
 const a=randomUUID(), b=randomUUID(), tenants=[a,b], password='TestPasswordOnly-123';
 try {
  await db.tenant.createMany({data:tenants.map(id=>({id}))});
  const permissions=JSON.stringify(['titles:create','titles:edit','titles:delete','rights:manage','home:manage','staff:manage']);
  const ra=await db.role.create({data:{tenantId:a,name:'editor',permissions}});
  const rb=await db.role.create({data:{tenantId:b,name:'editor',permissions}});
  const hash=await argon2.hash(password,{type:argon2.argon2id});
  const admin=await db.staffUser.create({data:{tenantId:a,roleId:ra.id,email:`${randomUUID()}@example.invalid`,passwordHash:hash}});
  await db.staffUser.create({data:{tenantId:b,roleId:rb.id,email:`${randomUUID()}@example.invalid`,passwordHash:hash}});
  const user=await db.appUser.create({data:{tenantId:a,email:`${randomUUID()}@example.invalid`,passwordHash:hash}});
  const planA=await db.plan.create({data:{tenantId:a,code:`plan-${randomUUID()}`,interval:'month',priceCents:999,currency:'USD',maxStreams:1,maxDevices:2}});
  const planB=await db.plan.create({data:{tenantId:b,code:`plan-${randomUUID()}`,interval:'month',priceCents:999,currency:'USD',maxStreams:1,maxDevices:2}});
  const sub=await db.subscription.create({data:{userId:user.id,planId:planA.id,status:'ACTIVE',currentPeriodEnd:new Date(Date.now()+86400000),provider:'test',providerRef:`test-${randomUUID()}`}});
  const profile=await db.profile.create({data:{userId:user.id,name:'PIN test',pinHash:await argon2.hash('1234')}});
  const titleA=await db.title.create({data:{tenantId:a,kind:'SERIES',titleAr:'أ',titleEn:'A',maturityRating:'PG',state:'PUBLISHED',genres:['action'],originalLanguage:'ar'}});
  const titleB=await db.title.create({data:{tenantId:b,kind:'SERIES',titleAr:'ب',titleEn:'B',maturityRating:'PG',state:'PUBLISHED',genres:['action'],originalLanguage:'ar'}});
  const seasonA=await db.season.create({data:{titleId:titleA.id,number:1}});
  const seasonB=await db.season.create({data:{titleId:titleB.id,number:1}});
  await db.episode.create({data:{seasonId:seasonA.id,titleId:titleA.id,number:9,titleAr:'مسودة',titleEn:'Draft',state:'DRAFT'}});
  await db.rightsWindow.create({data:{titleId:titleA.id,contractRef:'private-contract',territories:'["IQ"]',startsAt:new Date(),endsAt:new Date(Date.now()+86400000)}});
  const epB=await db.episode.create({data:{seasonId:seasonB.id,titleId:titleB.id,number:1,titleAr:'حلقة',titleEn:'Episode'}});
  const rightB=await db.rightsWindow.create({data:{titleId:titleB.id,contractRef:'contract',territories:'["IQ"]',startsAt:new Date(),endsAt:new Date(Date.now()+86400000)}});
  const rowA=await db.homeRow.create({data:{tenantId:a,name:'A',order:0}});
  const rowB=await db.homeRow.create({data:{tenantId:b,name:'B',order:0}});
  const login=expectStatus(await req('/auth/admin/login',null,'POST',{email:admin.email,password}),200,'admin login');
  const token=login.accessToken;
  expectStatus(await req(`/admin/titles/${titleA.id}`,token),200,'own title readable');
  expectStatus(await req(`/admin/titles/${titleB.id}`,token),404,'foreign title unreadable');
  expectStatus(await req(`/admin/titles/${titleB.id}`,token,'PUT',{titleEn:'changed'}),404,'foreign title not updated');
  expectStatus(await req(`/admin/titles/${titleB.id}`,token,'DELETE'),404,'foreign title not deleted');
  expectStatus(await req(`/admin/titles/${titleB.id}/seasons`,token,'POST',{number:2}),404,'foreign season creation denied');
  expectStatus(await req(`/admin/seasons/${seasonB.id}`,token,'DELETE'),404,'foreign season deletion denied');
  expectStatus(await req(`/admin/titles/${titleB.id}/episodes`,token),404,'foreign episodes unreadable');
  expectStatus(await req(`/admin/titles/${titleA.id}/episodes`,token,'POST',{seasonId:seasonB.id,number:3,titleAr:'س',titleEn:'X'}),404,'cross-title season denied');
  expectStatus(await req(`/admin/episodes/${epB.id}`,token,'PUT',{titleEn:'changed'}),404,'foreign episode update denied');
  expectStatus(await req(`/admin/episodes/${epB.id}`,token,'DELETE'),404,'foreign episode delete denied');
  expectStatus(await req(`/admin/rights/${rightB.id}`,token,'PUT',{contractRef:'changed'}),404,'foreign rights update denied');
  expectStatus(await req(`/admin/titles/${titleB.id}/rights`,token,'POST',{contractRef:'x',territories:['IQ'],startsAt:new Date(),endsAt:new Date()}),404,'foreign rights creation denied');
  expectStatus(await req(`/admin/home/rows/${rowB.id}/items`,token,'POST',{titleId:titleA.id,order:1}),404,'foreign row denied');
  expectStatus(await req(`/admin/home/rows/${rowA.id}/items`,token,'POST',{titleId:titleB.id,order:1}),404,'foreign row title denied');
  expectStatus(await req(`/admin/home/rows/${rowB.id}`,token,'DELETE'),404,'foreign row delete denied');
  expectStatus(await req('/admin/staff',token,'POST',{email:`${randomUUID()}@example.invalid`,password,roleId:rb.id}),404,'foreign role denied');
  noHashes(expectStatus(await req('/admin/staff',token),200,'staff list'),'staff list');
  noHashes(expectStatus(await req('/admin/roles',token),200,'roles list'),'roles list');
  noHashes(expectStatus(await req(`/admin/users/${user.id}`,token),200,'admin user'),'admin user');
  expectStatus(await req('/auth/logout',null,'POST'),503,'logout does not falsely claim token revocation');
  const userLogin=expectStatus(await req('/auth/login',null,'POST',{email:user.email,password}),200,'user login'); noHashes(userLogin,'login');
  const u=jwt.sign({sub:user.id},process.env.JWT_ACCESS_SECRET,{expiresIn:'5m'});
  expectStatus(await req(`/titles/${titleB.id}`,u),404,'foreign public title denied');
  expectStatus(await req(`/titles/${titleB.id}/episodes`,u),404,'foreign public episodes denied');
  const details=expectStatus(await req(`/titles/${titleA.id}`,u),200,'own published title');
  if (details.rightsWindows || details.mediaAssets || details.seasons.some(s=>s.episodes.some(e=>e.state!=='PUBLISHED'))) throw Error('public title exposes internal records or draft episodes');
  console.log('PASS public title excludes rights, assets and drafts');
  const search=expectStatus(await req('/search?genre=action&lang=ar',u),200,'typed genre and language search');
  if (!search.some(t=>t.id===titleA.id) || search.some(t=>t.id===titleB.id)) throw Error('catalog search tenant filter failed');
  const noMatch=expectStatus(await req('/search?q=nonexistent_xyz&lang=ar',u),200,'search query AND language');
  if (noMatch.length) throw Error('language incorrectly broadens search');
  expectStatus(await req('/billing/checkout',u,'POST',{plan_id:planA.id}),503,'checkout fails closed without provider');
  expectStatus(await req('/billing/checkout',u,'POST',{plan_id:planB.id}),404,'foreign tenant plan denied');
  expectStatus(await req(`/billing/subscription/${sub.id}/cancel`,u,'POST'),503,'cancellation fails closed without provider');
  if ((await db.subscription.findUnique({where:{id:sub.id}})).status !== 'ACTIVE') throw Error('failed cancellation changed subscription');
  console.log('PASS failed cancellation preserves subscription');
  expectStatus(await req('/billing/coupons/redeem',u,'POST',{code:'TEST'}),503,'coupon redemption fails closed');
  noHashes(expectStatus(await req('/profiles',u),200,'profile list'),'profile list');
  noHashes(expectStatus(await req(`/profiles/${profile.id}`,u,'PUT',{name:'updated'}),200,'profile update'),'profile update');
  noHashes(expectStatus(await req('/profiles',u,'POST',{name:'New profile',pin:'5678'}),201,'profile create'),'profile create');
  expectStatus(await req(`/admin/titles/${titleA.id}/episodes`,token,'POST',{seasonId:seasonA.id,number:1,titleAr:'حلقة',titleEn:'Episode'}),201,'own episode creation');
 } finally {
  await db.homeRowItem.deleteMany({where:{homeRow:{tenantId:{in:tenants}}}});
  await db.homeRow.deleteMany({where:{tenantId:{in:tenants}}});
  await db.rightsWindow.deleteMany({where:{title:{tenantId:{in:tenants}}}});
  await db.episode.deleteMany({where:{title:{tenantId:{in:tenants}}}});
  await db.season.deleteMany({where:{title:{tenantId:{in:tenants}}}});
  await db.title.deleteMany({where:{tenantId:{in:tenants}}});
  await db.profile.deleteMany({where:{user:{tenantId:{in:tenants}}}});
  await db.subscription.deleteMany({where:{user:{tenantId:{in:tenants}}}});
  await db.plan.deleteMany({where:{tenantId:{in:tenants}}});
  await db.appUser.deleteMany({where:{tenantId:{in:tenants}}});
  await db.staffUser.deleteMany({where:{tenantId:{in:tenants}}});
  await db.role.deleteMany({where:{tenantId:{in:tenants}}});
  await db.tenant.deleteMany({where:{id:{in:tenants}}}); await db.$disconnect();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
