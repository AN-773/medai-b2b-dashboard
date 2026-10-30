import { apiClient } from './apiClient';

// The test environment's on/off switch: `contracts/test-env-contract.md`. A
// small API of its own, outside the test environment, because it has to answer
// while the test environment sleeps. Both routes answer only a superadmin's
// token. Stopping is deliberately not here, and not on that API either.

export type TestEnvState = 'asleep' | 'waking' | 'awake' | 'sleeping';

export interface TestEnvStatus {
  state: TestEnvState;
  /** When `state` began. */
  since: string;
  /** Awake, with every service running. */
  ready: boolean;
  /** Who last started it, while it is up because of that; otherwise null. */
  startedBy: string | null;
  databases: { ready: number; total: number };
  /** `total` is 0 until the databases are up and the services are asked to run. */
  services: { ready: number; total: number };
  /** Only while awake. */
  idleMinutes: number | null;
  sleepsAfterIdleMinutes: number | null;
  keepAwakeUntil: string | null;
}

/** The four things a person can see, which are not quite the switch's four states. */
export type TestEnvPhase = 'off' | 'starting' | 'ready' | 'stopping';

/** A start that has run this long has gone wrong. It usually takes 10-15 minutes. */
const SLOW_AFTER_MINUTES = 30;

export const isTestEnvConfigured = (): boolean =>
  Boolean(import.meta.env.VITE_TEST_ENV_API_URL);

export const testEnvPhase = (status: TestEnvStatus): TestEnvPhase => {
  if (status.ready) return 'ready';
  if (status.state === 'asleep') return 'off';
  if (status.state === 'sleeping') return 'stopping';
  return 'starting';
};

/** Starting while it turns off is fine: the switch turns it round. */
export const canStartTestEnv = (phase: TestEnvPhase): boolean =>
  phase === 'off' || phase === 'stopping';

export const isTestEnvSlow = (status: TestEnvStatus, nowMs: number): boolean =>
  testEnvPhase(status) === 'starting' &&
  nowMs - Date.parse(status.since) >= SLOW_AFTER_MINUTES * 60 * 1000;

export const testEnvService = {
  getStatus: (): Promise<TestEnvStatus> => apiClient.get<TestEnvStatus>('TEST_ENV', '/status'),
  start: (): Promise<TestEnvStatus> => apiClient.post<TestEnvStatus>('TEST_ENV', '/start', undefined),
};
