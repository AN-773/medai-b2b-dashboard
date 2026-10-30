import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClient = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../apiClient', () => ({ apiClient }));

import {
  canStartTestEnv,
  isTestEnvSlow,
  testEnvPhase,
  testEnvService,
  type TestEnvStatus,
} from '../testEnvService';

const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);

const status = (over: Partial<TestEnvStatus> = {}): TestEnvStatus => ({
  state: 'asleep',
  since: '2026-10-30T11:50:00Z',
  ready: false,
  startedBy: null,
  databases: { ready: 0, total: 4 },
  services: { ready: 0, total: 0 },
  idleMinutes: null,
  sleepsAfterIdleMinutes: null,
  keepAwakeUntil: null,
  ...over,
});

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.post.mockReset();
});

describe('testEnvPhase', () => {
  it.each([
    ['asleep', false, 'off'],
    ['sleeping', false, 'stopping'],
    ['waking', false, 'starting'],
    ['awake', false, 'starting'], // the services are still coming up
    ['awake', true, 'ready'],
  ] as const)('%s, ready %s, reads as %s', (state, ready, phase) => {
    expect(testEnvPhase(status({ state, ready }))).toBe(phase);
  });
});

describe('canStartTestEnv', () => {
  it('offers Start only when the environment is off or turning off', () => {
    expect(canStartTestEnv('off')).toBe(true);
    expect(canStartTestEnv('stopping')).toBe(true);
    expect(canStartTestEnv('starting')).toBe(false);
    expect(canStartTestEnv('ready')).toBe(false);
  });
});

describe('isTestEnvSlow', () => {
  it('stays quiet through a normal start', () => {
    expect(isTestEnvSlow(status({ state: 'waking', since: '2026-10-30T11:40:00Z' }), NOW)).toBe(false);
  });

  it('speaks up once a start has run 30 minutes', () => {
    expect(isTestEnvSlow(status({ state: 'waking', since: '2026-10-30T11:30:00Z' }), NOW)).toBe(true);
    expect(isTestEnvSlow(status({ state: 'awake', since: '2026-10-30T11:30:00Z' }), NOW)).toBe(true);
  });

  it('says nothing about an environment that is simply off or on', () => {
    const long = '2026-10-01T00:00:00Z';
    expect(isTestEnvSlow(status({ since: long }), NOW)).toBe(false);
    expect(isTestEnvSlow(status({ state: 'awake', ready: true, since: long }), NOW)).toBe(false);
  });
});

describe('testEnvService', () => {
  it('reads the status and starts, on the switch API', async () => {
    apiClient.get.mockResolvedValue(status());
    apiClient.post.mockResolvedValue(status({ state: 'waking' }));

    await testEnvService.getStatus();
    await testEnvService.start();

    expect(apiClient.get).toHaveBeenCalledWith('TEST_ENV', '/status');
    expect(apiClient.post).toHaveBeenCalledWith('TEST_ENV', '/start', undefined);
  });

  it('has no way to stop the environment', () => {
    expect(Object.keys(testEnvService).sort()).toEqual(['getStatus', 'start']);
  });
});
