import { BoundedRateLimiter } from './rate-limiter';

describe('BoundedRateLimiter', () => {
  it('limits each key and resets after its fixed window', () => {
    const limit = new BoundedRateLimiter(1000, 10);
    expect(limit.check('a', 2, 100).allowed).toBe(true);
    expect(limit.check('a', 2, 101).allowed).toBe(true);
    expect(limit.check('a', 2, 102)).toEqual({ allowed: false, retryAfter: 1 });
    expect(limit.check('b', 2, 102).allowed).toBe(true);
    expect(limit.check('a', 2, 1100).allowed).toBe(true);
  });
  it('bounds memory, fails closed at capacity, and reclaims expired entries', () => {
    const limit = new BoundedRateLimiter(1000, 1);
    expect(limit.check('first', 10, 100).allowed).toBe(true);
    expect(limit.check('second', 10, 101).allowed).toBe(false);
    expect(limit.check('second', 10, 1100).allowed).toBe(true);
  });
});

describe('actual HTTP limiter ignores forged forwarding headers',()=>{
 it('cannot reset the auth budget by changing X-Forwarded-For',async()=>{
  const express=(await import('express')).default;
  const request=(await import('supertest')).default;
  const {rateLimiter}=await import('./rate-limiter');
  const app=express();app.use(rateLimiter);app.post('/auth/login',(_req,res)=>res.sendStatus(204));
  for(let i=0;i<10;i++)await request(app).post('/auth/login').set('X-Forwarded-For',`203.0.113.${i}`).expect(204);
  const denied=await request(app).post('/auth/login').set('X-Forwarded-For','198.51.100.99').expect(429);
  expect(denied.headers['retry-after']).toBeDefined();expect(denied.body.code).toBe('RATE_LIMITED');
 });
});
