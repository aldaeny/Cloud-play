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
