import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isAgentV2Configured } from '@/services/agentV2Service';

interface AuthUser {
  email?: string;
  role?: string;
  tenantRole?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  loading: boolean;
  currentUser: AuthUser | null;
  isSuperadmin: boolean;
  /** Whether this account may use faculty Ask. See {@link canAskFaculty}. */
  canAsk: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_TOKEN_STORAGE_KEY = 'msai_educator_token';
export const AUTH_ERROR_STORAGE_KEY = 'msai_educator_auth_error';
const AUTHORIZATION_ERROR_MESSAGE = 'Not authorized';

const persistAuthError = (message: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(AUTH_ERROR_STORAGE_KEY, message);
};

const isTenantAdminRole = (role?: string) =>
  role === 'admin' || role === 'owner';

/**
 * Faculty Ask is for a tenant admin or owner, and only that: agent-v2 refuses
 * any token without `tenant_role` admin/owner, so being a superadmin neither
 * grants it nor takes it away.
 */
export const canAskFaculty = (user: AuthUser | null) => isTenantAdminRole(user?.tenantRole);

const canAccessDashboard = (user: AuthUser | null) =>
  user?.role === 'superadmin' || user?.role === 'Administrator' || isTenantAdminRole(user?.tenantRole);

const parseJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);

    return JSON.parse(decoded) as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to parse auth token payload:', error);
    return null;
  }
};

const getUserFromToken = (token: string | null): AuthUser | null => {
  if (!token) {
    return null;
  }

  const payload = parseJwtPayload(token);
  if (!payload) {
    return null;
  }

  const rawRole = payload['https://iam.weos.io/v1/roles'];
  const role = Array.isArray(rawRole)
    ? String(rawRole[0] || '')
    : typeof rawRole === 'string'
      ? rawRole
      : undefined;
  const rawTenantRole = payload['https://iam.weos.io/v1/tenant_role'];
  const tenantRole = typeof rawTenantRole === 'string'
    ? rawTenantRole
    : undefined;
  const email = typeof payload['https://iam.weos.io/v1/email'] === 'string'
    ? payload['https://iam.weos.io/v1/email']
    : undefined;

  return { email, role, tenantRole };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const user = getUserFromToken(token);

    if (token && canAccessDashboard(user)) {
      setIsAuthenticated(true);
      setCurrentUser(user);
    } else {
      if (token) {
        persistAuthError(AUTHORIZATION_ERROR_MESSAGE);
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
      setIsAuthenticated(false);
      setCurrentUser(null);
    }

    setLoading(false);
  }, []);

  const login = (token: string) => {
    const user = getUserFromToken(token);

    if (!canAccessDashboard(user)) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setIsAuthenticated(false);
      setCurrentUser(null);
      persistAuthError(AUTHORIZATION_ERROR_MESSAGE);
      throw new Error(AUTHORIZATION_ERROR_MESSAGE);
    }

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    setIsAuthenticated(true);
    setCurrentUser(user);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const isSuperadmin = currentUser?.role === 'superadmin';
  const canAsk = canAskFaculty(currentUser) && isAgentV2Configured();

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading, currentUser, isSuperadmin, canAsk }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
