import { apiClient } from './apiClient';
import { Author } from '../types';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export interface IamListUser {
  id: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  status?: string;
  role?: string;
  accountId?: string;
  accounts?: string[];
  created?: string;
}

export interface IamListUsersResponse {
  items: IamListUser[];
  total: number;
  page: number;
}

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export interface IamTenant {
  id: string;
  name: string;
  ownerUserId?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  created?: string | null;
  updated?: string | null;
}

export interface IamListTenantsResponse {
  items: IamTenant[];
  total: number;
  page: number;
}

export interface CreateTenantRequest {
  name: string;
  userName: string;
  userEmail: string;
  userPassword: string;
}

export interface IamInvite {
  id: string;
  email: string;
  role?: string | null;
  status?: string;
  created?: string;
  updated?: string;
  expiresAt?: string;
  organizationId?: string;
  accountId?: string | null;
  accountIds?: string[] | null;
  accounts?: string[] | null;
}

export interface IamListInvitesResponse {
  items: IamInvite[];
  total: number;
  page: number;
}

export interface InviteImportResultRow {
  email: string;
  status: 'created' | 'skipped';
  message?: string;
}

export interface InviteImportResponse {
  created: number;
  skipped: number;
  total: number;
  results: InviteImportResultRow[];
}

export const iamService = {
  login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('IAM', '/auth/login', credentials, { authenticated: false });
  },

  getUserProfile: async (): Promise<UserProfile> => {
    return apiClient.get<UserProfile>('IAM', '/users/me');
  },

  getAuthors: async (): Promise<Author[]> => {
    return apiClient.get<Author[]>('IAM', '/authors');
  },

  listUsers: async (
    options: ListUsersOptions = {},
  ): Promise<IamListUsersResponse> => {
    const params = new URLSearchParams();
    params.set('limit', String(options.limit ?? 200));
    params.set('page', String(options.page ?? 1));
    params.set('_sort', 'created');
    if (options.search?.trim()) {
      params.set('query', options.search.trim());
    }

    return apiClient.get<IamListUsersResponse>(
      'IAM',
      `/users/list?${params.toString()}`,
    );
  },

  listTenants: async (page = 1, limit = 10): Promise<IamListTenantsResponse> => {
    return apiClient.get<IamListTenantsResponse>(
      'IAM',
      `/tenants?page=${page}&limit=${limit}`,
    );
  },

  createInvite: async (email: string): Promise<IamInvite> => {
    return apiClient.post<IamInvite>('IAM', '/invites', {
      email: email.trim(),
    });
  },

  importInvites: async (file: File): Promise<InviteImportResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post<InviteImportResponse>('IAM', '/invites/import', formData);
  },

  listInvites: async (status?: string): Promise<IamListInvitesResponse> => {
    const statusQuery = status
      ? `?_filters[status][eq]=${encodeURIComponent(status)}`
      : '';

    return apiClient.get<IamListInvitesResponse>(
      'IAM',
      `/invites${statusQuery}`,
    );
  },

  createTenant: async (payload: CreateTenantRequest): Promise<IamTenant> => {
    return apiClient.post<IamTenant>('IAM', '/tenants', {
      name: payload.name.trim(),
      userName: payload.userName.trim(),
      userEmail: payload.userEmail.trim(),
      userPassword: payload.userPassword,
    });
  },
};
