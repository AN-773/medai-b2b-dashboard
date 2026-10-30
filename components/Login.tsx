import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AUTH_ERROR_STORAGE_KEY } from '../contexts/AuthContext';
import { Button, Field, InlineAlert, Input } from '@/components/ui';

const getIamLoginUrl = () => {
  const iamApiUrl =
    import.meta.env.VITE_IAM_API_URL || 'http://localhost:3000/iam';
  const normalizedIamApiUrl = iamApiUrl.replace(/\/$/, '');
  const loginUrl = new URL(`${normalizedIamApiUrl}/login`);

  loginUrl.searchParams.set(
    'redirect_uri',
    'https://admin.medicalstudent.ai/callback',
  );

  return loginUrl.toString();
};

/** Where the test environment is started from. Set only on the site that runs on it. */
const TEST_ENV_PAGE_URL = import.meta.env.VITE_TEST_ENV_PAGE_URL;

/**
 * On that site an IAM that cannot be reached usually means the test environment
 * is asleep. Its load balancer answers 503 with no CORS header, which the
 * browser reports as no response at all.
 */
const looksLikeTestEnvIsOff = (err: unknown): boolean =>
  Boolean(TEST_ENV_PAGE_URL) &&
  axios.isAxiosError(err) &&
  (!err.response || [502, 503, 504].includes(err.response.status));

/** The green mark, cropped from the horizontal logo (whose wordmark is white). */
const LogoMark: React.FC = () => (
  <span className="block h-10 w-[44px] flex-shrink-0 overflow-hidden" aria-hidden="true">
    <img
      src="/assets/Medical Student AI Horizontal Dark BG - Green.png"
      alt=""
      className="h-10 max-w-none"
    />
  </span>
);

const GoogleIcon: React.FC = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const MicrosoftIcon: React.FC = () => (
  <svg className="h-4 w-4" viewBox="0 0 23 23" aria-hidden="true">
    <path fill="#f35325" d="M0 0h11v11H0z" />
    <path fill="#81bc06" d="M12 0h11v11H12z" />
    <path fill="#05a6f0" d="M0 12h11v11H0z" />
    <path fill="#ffba08" d="M12 12h11v11H12z" />
  </svg>
);

const linkClass =
  'font-medium text-stone-700 underline-offset-2 transition-colors hover:text-stone-950 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [testEnvOff, setTestEnvOff] = useState(false);

  useEffect(() => {
    const authError = window.sessionStorage.getItem(AUTH_ERROR_STORAGE_KEY);

    if (!authError) {
      return;
    }

    setError(authError);
    window.sessionStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTestEnvOff(false);
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('email', email);
      params.append('password', password);

      const response = await axios.post(
        getIamLoginUrl(),
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      // Matches Vue app logic: Response is JSON with "url" key containing the callback URL with token.
      const redirectUrl = response.data.url;

      if (redirectUrl) {
        const urlObj = new URL(redirectUrl);
        const accessToken = urlObj.searchParams.get('access_token');

        if (accessToken) {
          login(accessToken);
          navigate('/');
        } else {
          // Fallback: check query params for error
          const errorDescription = urlObj.searchParams.get('error_description');
          const errorMsg = urlObj.searchParams.get('error');
          throw new Error(
            errorDescription ||
              errorMsg ||
              'No access token found in redirect URL',
          );
        }
      } else {
        throw new Error('Invalid response from server: No redirect URL');
      }

    } catch (err: any) {
      console.error("Login error", err);
      // specific error handling if possible
      if (looksLikeTestEnvIsOff(err)) {
        setTestEnvOff(true);
      } else if (err.response) {
          setError(`Login failed: ${err.response.data?.message || err.response.statusText}`);
      } else if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSOLogin = (provider: 'google' | 'microsoft') => {
    setIsLoading(true);
    console.log(`SSO Login with ${provider}`);
    window.setTimeout(() => {
      setError('SSO sign-in is not available yet.');
      setIsLoading(false);
    }, 300);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-4 py-12 font-sans">
      {/* A faint wash of the brand gradient behind the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-14rem] h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-ai-gradient opacity-[0.07] blur-3xl"
      />

      <main className="relative w-full max-w-[400px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <LogoMark />
          <span className="text-lg font-semibold text-stone-900">Medical Student AI</span>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white shadow-card">
          <div className="px-6 pb-6 pt-7 sm:px-8">
            <h1 className="text-xl font-semibold leading-7 text-stone-900">
              Sign in to the educator dashboard
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Use the email and password for your educator account.
            </p>

            {error && (
              <InlineAlert className="mt-5" onDismiss={() => setError('')}>
                {error}
              </InlineAlert>
            )}

            {testEnvOff && (
              <InlineAlert className="mt-5" tone="info" title="The test environment looks to be off">
                You can&apos;t sign in here until it is on. A superadmin can start it from the{' '}
                <a href={TEST_ENV_PAGE_URL} className="font-medium underline">
                  main dashboard
                </a>
                . It takes about 15 minutes.
              </InlineAlert>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" aria-busy={isLoading}>
              <Field label="Email">
                {(id) => (
                  <Input
                    id={id}
                    name="email"
                    type="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="educator@institution.edu"
                    required
                    className="h-10"
                  />
                )}
              </Field>

              <Field label="Password">
                {(id) => (
                  <Input
                    id={id}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="h-10"
                  />
                )}
              </Field>

              <div className="flex items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    name="remember"
                    className="h-4 w-4 cursor-pointer accent-brand-600"
                  />
                  Remember me
                </label>
                <button type="button" className={`text-sm ${linkClass}`}>
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={isLoading}
                className="!mt-6 h-10 w-full"
              >
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-stone-200" />
              <span className="text-xs text-stone-500">or</span>
              <span className="h-px flex-1 bg-stone-200" />
            </div>

            <div className="space-y-2.5">
              <Button
                variant="secondary"
                onClick={() => handleSSOLogin('google')}
                disabled={isLoading}
                className="h-10 w-full"
              >
                <GoogleIcon />
                Continue with Google
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSSOLogin('microsoft')}
                disabled={isLoading}
                className="h-10 w-full"
              >
                <MicrosoftIcon />
                Continue with Microsoft
              </Button>
            </div>
          </div>

          <div className="rounded-b-xl border-t border-stone-100 bg-stone-50/60 px-6 py-4 text-center text-[13px] text-stone-500 sm:px-8">
            Need access?{' '}
            <a href="#" className={linkClass}>
              Contact your institution administrator
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-stone-500">
          By signing in, you agree to our{' '}
          <a href="#" className={linkClass}>
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className={linkClass}>
            Privacy Policy
          </a>
          .
        </p>
      </main>
    </div>
  );
};

export default Login;
