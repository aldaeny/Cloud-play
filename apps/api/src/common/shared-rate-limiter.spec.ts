import {PostgresRateLimiter,sharedRateLimiter} from './shared-rate-limiter';
describe('shared quota error contract (real concurrency proof runs in native CI)',()=>{
 it('fails closed with503 instead of a local fallback on authority failure',async()=>{
  const store={prune:jest.fn(),check:jest.fn().mockRejectedValue(new Error('private database details'))};
  const res={setHeader:jest.fn(),status:jest.fn().mockReturnThis(),json:jest.fn()},next=jest.fn();
  await sharedRateLimiter(store as never)({socket:{remoteAddress:'::1'},method:'GET',path:'/profiles'} as never,res as never,next);
  expect(res.status).toHaveBeenCalledWith(503);expect(res.json).toHaveBeenCalledWith({code:'RATE_LIMIT_AUTHORITY_UNAVAILABLE'});expect(next).not.toHaveBeenCalled();
 });
 it('derives identity from the peer, not forwarded headers or claimed privilege',async()=>{
  const store={prune:jest.fn(),check:jest.fn().mockResolvedValue({allowed:true,retryAfter:0})},next=jest.fn();
  await sharedRateLimiter(store as never)({socket:{remoteAddress:'::1'},method:'POST',path:'/auth/refresh',headers:{'x-forwarded-for':'8.8.8.8',role:'admin'}} as never,{} as never,next);
  expect(store.check).toHaveBeenCalledWith('::1',true);expect(next).toHaveBeenCalled();
 });
 it('rejects invalid test window',()=>{expect(()=>new PostgresRateLimiter({} as never,0)).toThrow('QUOTA_WINDOW_INVALID');});
});
