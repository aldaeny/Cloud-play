import {
  orderServers, selectServer, failoverCandidates, statusFromProbe,
  isValidPriority, normalizeStatus, type SelectableServer,
} from './xtream-selection';

function server(overrides: Partial<SelectableServer> & { id: string }): SelectableServer {
  return {
    name: overrides.id,
    enabled: true,
    priority: 100,
    isDefault: false,
    connectionStatus: 'unknown',
    ...overrides,
  };
}

describe('xtream server selection', () => {
  describe('eligibility', () => {
    it('never selects a disabled server', () => {
      const disabled = server({ id: 'a', enabled: false, priority: 1, isDefault: true });
      expect(orderServers([disabled])).toEqual([]);
      expect(selectServer([disabled])).toBeNull();
    });

    it('ignores a disabled default and falls back to an enabled server', () => {
      const disabledDefault = server({ id: 'a', enabled: false, isDefault: true, priority: 1 });
      const enabled = server({ id: 'b', priority: 50 });
      expect(selectServer([disabledDefault, enabled])?.id).toBe('b');
    });

    it('returns null for an empty list', () => {
      expect(selectServer([])).toBeNull();
      expect(orderServers([])).toEqual([]);
      expect(failoverCandidates([], 3)).toEqual([]);
    });
  });

  describe('ordering', () => {
    it('prefers the explicit default over a better priority', () => {
      const preferred = server({ id: 'd', isDefault: true, priority: 900 });
      const better = server({ id: 'p', priority: 1 });
      expect(orderServers([better, preferred]).map(s => s.id)).toEqual(['d', 'p']);
    });

    it('orders by ascending priority (1 is best)', () => {
      const list = [server({ id: 'c', priority: 30 }), server({ id: 'a', priority: 10 }), server({ id: 'b', priority: 20 })];
      expect(orderServers(list).map(s => s.id)).toEqual(['a', 'b', 'c']);
    });

    it('breaks priority ties by health: healthy > unknown > unhealthy', () => {
      const list = [
        server({ id: 'bad', connectionStatus: 'unhealthy' }),
        server({ id: 'new', connectionStatus: 'unknown' }),
        server({ id: 'good', connectionStatus: 'healthy' }),
      ];
      expect(orderServers(list).map(s => s.id)).toEqual(['good', 'new', 'bad']);
    });

    it('still allows a never-probed server so a fresh install can play', () => {
      expect(selectServer([server({ id: 'fresh', connectionStatus: 'unknown' })])?.id).toBe('fresh');
    });

    it('prefers a healthy server over an unhealthy one at equal priority', () => {
      const list = [server({ id: 'down', connectionStatus: 'unhealthy' }), server({ id: 'up', connectionStatus: 'healthy' })];
      expect(selectServer(list)?.id).toBe('up');
    });

    it('treats an unrecognised status as unknown, never as healthy', () => {
      expect(normalizeStatus('weird')).toBe('unknown');
      expect(normalizeStatus(null)).toBe('unknown');
      expect(normalizeStatus('healthy')).toBe('healthy');
      const list = [server({ id: 'weird', connectionStatus: 'weird' }), server({ id: 'good', connectionStatus: 'healthy' })];
      expect(selectServer(list)?.id).toBe('good');
    });

    it('is deterministic and does not mutate the input', () => {
      const list = [server({ id: 'b', name: 'same' }), server({ id: 'a', name: 'same' })];
      const snapshot = list.map(s => s.id);
      expect(orderServers(list).map(s => s.id)).toEqual(['a', 'b']);
      expect(orderServers(list).map(s => s.id)).toEqual(['a', 'b']);
      expect(list.map(s => s.id)).toEqual(snapshot);
    });
  });

  describe('bounded failover', () => {
    const many = Array.from({ length: 12 }, (_, i) => server({ id: `s${i}`, priority: i + 1 }));

    it('caps attempts so a dead origin is never retried without limit', () => {
      expect(failoverCandidates(many, 3)).toHaveLength(3);
      expect(failoverCandidates(many)).toHaveLength(3);
      expect(failoverCandidates(many, 100)).toHaveLength(10);
    });

    it('always tries at least one server, even for a nonsensical budget', () => {
      for (const budget of [0, -5, NaN, Infinity]) {
        expect(failoverCandidates(many, budget as number).length).toBeGreaterThanOrEqual(1);
      }
    });

    it('returns candidates in preference order', () => {
      expect(failoverCandidates(many, 2).map(s => s.id)).toEqual(['s0', 's1']);
    });

    it('excludes disabled servers from the failover plan', () => {
      const list = [server({ id: 'off', enabled: false, priority: 1 }), server({ id: 'on', priority: 2 })];
      expect(failoverCandidates(list, 5).map(s => s.id)).toEqual(['on']);
    });
  });

  describe('probe results', () => {
    it('is healthy only when the probe succeeded AND authenticated', () => {
      expect(statusFromProbe({ ok: true, authenticated: true })).toBe('healthy');
    });

    it('never reports an auth rejection as healthy', () => {
      expect(statusFromProbe({ ok: true, authenticated: false })).toBe('unhealthy');
      expect(statusFromProbe({ ok: false, authenticated: true })).toBe('unhealthy');
      expect(statusFromProbe({ ok: false, authenticated: false })).toBe('unhealthy');
    });
  });

  describe('priority validation', () => {
    it('accepts integers within range', () => {
      for (const value of [1, 10, 500, 1000]) expect(isValidPriority(value)).toBe(true);
    });

    it('rejects out-of-range, fractional and non-numeric values', () => {
      for (const value of [0, -1, 1001, 1.5, NaN, Infinity, '1', null, undefined]) {
        expect(isValidPriority(value)).toBe(false);
      }
    });
  });
});
