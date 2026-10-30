import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Power } from 'lucide-react';
import {
  Badge,
  type BadgeTone,
  Button,
  EmptyState,
  InlineAlert,
  PageHeader,
  ProgressBar,
  Spinner,
} from '@/components/ui';
import type { ApiRequestError } from '../services/apiClient';
import {
  canStartTestEnv,
  isTestEnvConfigured,
  isTestEnvSlow,
  testEnvPhase,
  testEnvService,
  type TestEnvPhase,
  type TestEnvStatus,
} from '../services/testEnvService';

const TEST_APP_URL = 'https://test.djobuqft2lzci.amplifyapp.com';
const TEST_DASHBOARD_URL = 'https://dashboard.medicalstudent.ai';

/** Set only on the site that runs on the test environment. */
const RUNS_ON_TEST_ENV = Boolean(import.meta.env.VITE_TEST_ENV_PAGE_URL);

const POLL_WHILE_CHANGING_MS = 15_000;
const POLL_WHILE_STEADY_MS = 30_000;

const PHASES: Record<TestEnvPhase, { badge: string; tone: BadgeTone; title: string }> = {
  off: { badge: 'Off', tone: 'neutral', title: 'The test environment is off' },
  starting: { badge: 'Starting', tone: 'amber', title: 'The test environment is starting' },
  ready: { badge: 'On', tone: 'green', title: 'The test environment is ready' },
  stopping: { badge: 'Turning off', tone: 'neutral', title: 'The test environment is turning off' },
};

const clockTime = (when: number | string) =>
  new Date(when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const messageOf = (error: unknown): string => {
  const { status, message } = error as ApiRequestError;
  if (status === 401) return 'Your sign-in has expired. Sign out and sign in again.';
  if (status === 403) return 'Only superadmins can use this page.';
  return status ? message : 'Could not reach the switch. Check your connection and try again.';
};

const StartStep: React.FC<{ label: string; ready: number; total: number }> = ({
  label,
  ready,
  total,
}) => (
  <div>
    <div className="mb-1.5 flex items-baseline justify-between gap-4 text-[13px]">
      <span className="font-medium text-stone-700">{label}</span>
      <span className="tabular-nums text-stone-500">
        {total > 0 ? `${ready} of ${total}` : 'Waiting'}
      </span>
    </div>
    <ProgressBar value={ready} max={total} label={label} />
  </div>
);

const OpenLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-stone-200 bg-white px-3.5 text-sm font-medium text-stone-800 shadow-card transition-colors hover:border-stone-300 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
  >
    {children}
    <ExternalLink size={14} aria-hidden="true" />
  </a>
);

const TestEnvironmentView: React.FC = () => {
  const [status, setStatus] = useState<TestEnvStatus | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  // Only the newest call may change the page: a status that left before Start
  // was pressed could otherwise land after it and put "Off" back.
  const latestCall = useRef(0);
  const statusRef = useRef<TestEnvStatus | null>(null);

  const track = useCallback(async (call: () => Promise<TestEnvStatus>) => {
    latestCall.current += 1;
    const thisCall = latestCall.current;
    try {
      const next = await call();
      if (thisCall !== latestCall.current) return;
      statusRef.current = next;
      setStatus(next);
      setCheckedAt(Date.now());
      setError('');
    } catch (err) {
      if (thisCall === latestCall.current) setError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    if (!isTestEnvConfigured()) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      if (document.visibilityState === 'visible') await track(testEnvService.getStatus);
      if (stopped) return;
      const phase = statusRef.current && testEnvPhase(statusRef.current);
      const changing = phase === 'starting' || phase === 'stopping';
      timer = setTimeout(poll, changing ? POLL_WHILE_CHANGING_MS : POLL_WHILE_STEADY_MS);
    };
    const checkOnReturn = () => {
      if (document.visibilityState === 'visible') void track(testEnvService.getStatus);
    };

    void poll();
    document.addEventListener('visibilitychange', checkOnReturn);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', checkOnReturn);
    };
  }, [track]);

  const handleStart = async () => {
    setIsStarting(true);
    await track(testEnvService.start);
    setIsStarting(false);
  };

  const header = (
    <PageHeader
      title="Test environment"
      description="The test copy of the app and this dashboard. It turns itself off when nobody uses it, to save money, and anyone here can turn it back on."
    />
  );

  if (!isTestEnvConfigured()) {
    return (
      <div>
        {header}
        <EmptyState
          icon={Power}
          title="Not connected on this site yet"
          description="This site has no address for the test environment switch. Ask an engineer to set it up."
        />
      </div>
    );
  }

  if (!status) {
    return (
      <div>
        {header}
        {error ? (
          <InlineAlert className="mt-6 max-w-2xl">{error}</InlineAlert>
        ) : (
          <Spinner className="mt-10" label="Checking the test environment…" />
        )}
      </div>
    );
  }

  const phase = testEnvPhase(status);
  const { badge, tone, title } = PHASES[phase];
  const keptAwakeUntil =
    status.keepAwakeUntil && Date.parse(status.keepAwakeUntil) > Date.now()
      ? clockTime(status.keepAwakeUntil)
      : null;

  return (
    <div>
      {header}

      <div className="mt-6 max-w-2xl space-y-4">
        {error && <InlineAlert onDismiss={() => setError('')}>{error}</InlineAlert>}

        {RUNS_ON_TEST_ENV && phase !== 'ready' && (
          <InlineAlert tone="info">
            This site runs on the test environment, so its other pages will not work until it is
            on.
          </InlineAlert>
        )}

        {isTestEnvSlow(status, Date.now()) && (
          <InlineAlert tone="warning" title="This is taking longer than it should">
            Ask an engineer to look at it. There is no need to press anything.
          </InlineAlert>
        )}

        <section
          aria-label="Test environment status"
          className="rounded-xl border border-stone-200 bg-white p-5 shadow-card sm:p-6"
        >
          <Badge tone={tone} dot>
            {badge}
          </Badge>
          <h2 className="mt-3 text-[17px] font-semibold leading-7 text-stone-900">{title}</h2>

          {phase === 'off' && (
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Start it when you need it. It takes about 15 minutes, and it keeps going if you leave
              this page.
            </p>
          )}

          {phase === 'stopping' && (
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Nobody has used it for a while. You can start it again now; it takes a little longer
              than usual.
            </p>
          )}

          {phase === 'starting' && (
            <>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                This usually takes about 15 minutes, and it keeps going if you leave this page.
                {status.startedBy && ` Started by ${status.startedBy}.`}
              </p>
              <div className="mt-5 space-y-4">
                <StartStep label="Databases" {...status.databases} />
                <StartStep label="Services" {...status.services} />
              </div>
            </>
          )}

          {phase === 'ready' && (
            <>
              <p className="mt-1 text-sm leading-6 text-stone-500">
                {keptAwakeUntil
                  ? `It stays on at least until ${keptAwakeUntil}, then turns off after ${status.sleepsAfterIdleMinutes} minutes without use.`
                  : `It turns off by itself after ${status.sleepsAfterIdleMinutes} minutes without use.`}
                {status.startedBy && ` Started by ${status.startedBy}.`}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <OpenLink href={TEST_APP_URL}>Open test app</OpenLink>
                <OpenLink href={TEST_DASHBOARD_URL}>Open test dashboard</OpenLink>
              </div>
            </>
          )}

          {canStartTestEnv(phase) && (
            <Button
              variant="primary"
              icon={Power}
              loading={isStarting}
              onClick={handleStart}
              className="mt-5"
            >
              Start test environment
            </Button>
          )}
        </section>

        {checkedAt && (
          <p className="text-xs text-stone-500">
            Updates by itself. Last checked at {clockTime(checkedAt)}.
          </p>
        )}
      </div>
    </div>
  );
};

export default TestEnvironmentView;
