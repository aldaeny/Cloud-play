import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma.service';

describe('analytics resource bounds', () => {
  const query = jest.fn();
  const service = new AnalyticsService({ title: { findMany: query }, playbackSession: { count: query } } as unknown as PrismaService);
  beforeEach(() => query.mockClear());
  it.each([NaN, Infinity, -1, 0, 0.1, 101, 1000000])('rejects invalid/excessive title limit %s before DB access', async value => {
    await expect(service.getTitlesStats('verified-tenant', value)).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
  it.each([NaN, Infinity, -1, 0, 0.1, 366, 1000000])('rejects invalid/excessive playback window %s before DB access', async value => {
    await expect(service.getPlaybackStats('verified-tenant', value)).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});
