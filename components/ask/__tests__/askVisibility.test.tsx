// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProtectedRoute from '@/components/ProtectedRoute';
import SidebarContent from '@/components/SidebarContent';
import { navGroupsFor } from '@/components/shell/navigation';
import { AuthProvider, canAskFaculty } from '@/contexts/AuthContext';
import { facultyChatClient } from '@/services/facultyChatClient';
import { AskRoute } from '@/views/AskView';

import { AskAboutCohortButton, askAboutCohortPath } from '../AskAboutCohortButton';

const ROLES = 'https://iam.weos.io/v1/roles';
const TENANT_ROLE = 'https://iam.weos.io/v1/tenant_role';

const base64url = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenFor = (claims: Record<string, unknown>) => `${base64url({ alg: 'none' })}.${base64url(claims)}.sig`;

const signIn = (claims: Record<string, unknown>) => localStorage.setItem('msai_educator_token', tokenFor(claims));

const TENANT_ADMIN = { [ROLES]: ['Administrator'], [TENANT_ROLE]: 'admin' };
const TENANT_OWNER = { [ROLES]: ['user'], [TENANT_ROLE]: 'owner' };
const PLATFORM_ONLY = { [ROLES]: ['superadmin'] };
const PLATFORM_AND_OWNER = { [ROLES]: ['superadmin'], [TENANT_ROLE]: 'owner' };
const ADMINISTRATOR_ONLY = { [ROLES]: ['Administrator'] };

const navLabels = () => screen.getAllByRole('button').map((button) => button.textContent?.trim());

const renderSidebar = () =>
  render(
    <AuthProvider>
      <SidebarContent activeView="FACULTY" onNavigate={() => undefined} onLogout={() => undefined} />
    </AuthProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv('VITE_AGENT_V2_API_URL', 'http://agent.test');
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('canAskFaculty', () => {
  it.each([
    ['admin', true],
    ['owner', true],
    ['member', false],
    ['', false],
    [undefined, false],
  ])('tenant role %s: %s', (tenantRole, expected) => {
    expect(canAskFaculty({ tenantRole })).toBe(expected);
  });

  it('does not care about the platform role', () => {
    expect(canAskFaculty({ role: 'superadmin' })).toBe(false);
    expect(canAskFaculty({ role: 'Administrator' })).toBe(false);
    expect(canAskFaculty({ role: 'superadmin', tenantRole: 'admin' })).toBe(true);
    expect(canAskFaculty(null)).toBe(false);
  });
});

describe('navGroupsFor', () => {
  const views = (options: Parameters<typeof navGroupsFor>[0]) =>
    navGroupsFor(options).flatMap((group) => group.items.map((item) => item.view));

  it('puts Ask under the Dashboard for an educator who may use it', () => {
    expect(views({ isSuperadmin: false, canAsk: true }).slice(0, 3)).toEqual(['FACULTY', 'ASK', 'COURSES']);
  });

  it('leaves it out for an educator who may not', () => {
    expect(views({ isSuperadmin: false, canAsk: false })).not.toContain('ASK');
  });

  it('leaves it out for a superadmin-only account', () => {
    expect(views({ isSuperadmin: true, canAsk: false })).not.toContain('ASK');
  });

  it('adds it for a superadmin who also holds a tenant role', () => {
    const shown = views({ isSuperadmin: true, canAsk: true });
    expect(shown[0]).toBe('ASK');
    expect(shown).toContain('TENANTS');
  });
});

describe('the sidebar, from a real token', () => {
  it.each([
    ['a tenant admin', TENANT_ADMIN],
    ['a tenant owner', TENANT_OWNER],
    ['a superadmin who is also an owner', PLATFORM_AND_OWNER],
  ])('shows Ask to %s', async (_name, claims) => {
    signIn(claims);
    renderSidebar();
    await waitFor(() => expect(navLabels()).toContain('Ask'));
  });

  it.each([
    ['a superadmin-only account', PLATFORM_ONLY, 'Tenants'],
    ['an Administrator with no tenant role', ADMINISTRATOR_ONLY, 'Dashboard'],
  ])('hides Ask from %s', async (_name, claims, landmark) => {
    signIn(claims);
    renderSidebar();
    await waitFor(() => expect(navLabels()).toContain(landmark));
    expect(navLabels()).not.toContain('Ask');
  });

  it('hides Ask on a site with no agent, whoever you are', async () => {
    vi.stubEnv('VITE_AGENT_V2_API_URL', '');
    signIn(TENANT_ADMIN);
    renderSidebar();
    await waitFor(() => expect(navLabels()).toContain('Dashboard'));
    expect(navLabels()).not.toContain('Ask');
  });
});

describe('the /ask route', () => {
  const renderAt = (path: string) =>
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/ask/:threadId?"
              element={
                <ProtectedRoute>
                  <AskRoute />
                </ProtectedRoute>
              }
            />
            <Route path="/tenants" element={<p>Tenants page</p>} />
            <Route path="/faculty" element={<p>Dashboard page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

  beforeEach(() => {
    vi.spyOn(facultyChatClient, 'listFacultyThreads').mockResolvedValue({ threads: [], nextCursor: null, watchCursor: '' });
  });

  it('opens for a tenant admin', async () => {
    signIn(TENANT_ADMIN);
    renderAt('/ask');
    expect(await screen.findByRole('heading', { name: 'Ask', level: 1 })).toBeTruthy();
  });

  it('sends a superadmin-only account home, even by direct link', async () => {
    signIn(PLATFORM_ONLY);
    renderAt('/ask/thread-1');
    expect(await screen.findByText('Tenants page')).toBeTruthy();
    expect(facultyChatClient.listFacultyThreads).not.toHaveBeenCalled();
  });

  it('sends an account with no tenant role home', async () => {
    signIn(ADMINISTRATOR_ONLY);
    renderAt('/ask');
    expect(await screen.findByText('Dashboard page')).toBeTruthy();
  });
});

describe('Ask about this cohort', () => {
  const Where: React.FC = () => {
    const location = useLocation();
    return <p data-testid="where">{`${location.pathname}${location.search}|${JSON.stringify(location.state)}`}</p>;
  };

  const renderButton = () =>
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/mastery']}>
          <Routes>
            <Route
              path="/mastery"
              element={<AskAboutCohortButton cohortId="/cohorts/year-2" cohortTitle="Year 2" page="mastery" />}
            />
            <Route path="/ask" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

  it('opens Ask with the cohort, and keeps its title out of the URL', async () => {
    signIn(TENANT_OWNER);
    renderButton();
    fireEvent.click(await screen.findByRole('button', { name: 'Ask about this cohort' }));

    expect(screen.getByTestId('where').textContent).toBe(
      `${askAboutCohortPath('/cohorts/year-2', 'mastery')}|{"cohortTitle":"Year 2"}`,
    );
    expect(screen.getByTestId('where').textContent).toContain('/ask?cohortId=%2Fcohorts%2Fyear-2&page=mastery');
  });

  it('is not there for a superadmin-only account', async () => {
    signIn(PLATFORM_ONLY);
    const { container } = renderButton();
    await waitFor(() => expect(container.querySelector('button')).toBeNull());
  });
});
