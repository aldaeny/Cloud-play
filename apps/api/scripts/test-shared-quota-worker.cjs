// Disposable test subprocess only: actual production middleware, own native
// Prisma pool and HTTP server. No production environment is inherited by CI.
require('reflect-metadata');
const express=require('express');
const {PrismaClient}=require(process.env.QUOTA_FIXTURE_CLIENT);
const {PostgresRateLimiter,sharedRateLimiter}=require('../dist/common/shared-rate-limiter');
const db=new PrismaClient(),app=express();
app.use(sharedRateLimiter(new PostgresRateLimiter(db,Number(process.env.QUOTA_FIXTURE_WINDOW_MS))));
app.post('/auth/login',(_req,res)=>res.sendStatus(204));
app.get('/fixture',(_req,res)=>res.sendStatus(204));
const server=app.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
process.on('message',async m=>{if(m==='stop'){server.closeAllConnections();server.close();await db.$disconnect();process.exit(0);}});
