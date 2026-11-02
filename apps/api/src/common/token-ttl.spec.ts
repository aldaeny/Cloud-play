import { jwtTtlSeconds } from './token-ttl';

describe('JWT TTL configuration', () => {
  const previous = process.env.JWT_ACCESS_TTL;
  afterEach(() => {
    if (previous === undefined) delete process.env.JWT_ACCESS_TTL;
    else process.env.JWT_ACCESS_TTL = previous;
  });
  it('returns the default as seconds', () => {
    delete process.env.JWT_ACCESS_TTL;
    expect(jwtTtlSeconds('JWT_ACCESS_TTL', 900)).toBe(900);
  });
  it('parses configured seconds as a number', () => {
    process.env.JWT_ACCESS_TTL = '900';
    expect(jwtTtlSeconds('JWT_ACCESS_TTL', 1)).toBe(900);
  });
  it.each(['0', '-1', '15m', '1.5', '90000000000000000'])('rejects invalid TTL %s', value => {
    process.env.JWT_ACCESS_TTL = value;
    expect(() => jwtTtlSeconds('JWT_ACCESS_TTL', 900)).toThrow();
  });
});
