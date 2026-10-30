/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Each deployed site builds from its own env file, picked by the mode (see .env): `--mode university` for
// university.medicalstudent.ai (PRODUCTION backends), `--mode dashboard` for dashboard.medicalstudent.ai (TEST).
// Any other build would fall back to services/apiClient.ts's localhost defaults, or to whatever a local file holds,
// so it is refused here instead of being shipped.
const SITES = ['university', 'dashboard'];
const REQUIRED = ['VITE_IAM_API_URL', 'VITE_TUTOR_API_URL', 'VITE_TEST_API_URL', 'VITE_NOTIFICATIONS_API_URL', 'VITE_PUBLIC_APP_URL'];

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, '.', '');
    if (command === 'build') {
      if (!SITES.includes(mode)) {
        throw new Error(`vite build needs --mode ${SITES.join(' or ')}, got "${mode}": each site has its own .env.<site>`);
      }
      const missing = REQUIRED.filter((key) => !env[key]);
      if (missing.length) {
        throw new Error(`.env.${mode} does not set ${missing.join(', ')}`);
      }
    }
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // tests/ holds node:test suites run by scripts/test-progressive-files.mjs, not Vitest.
      test: {
        include: ['**/__tests__/*.test.{ts,tsx}'],
      }
    };
});
