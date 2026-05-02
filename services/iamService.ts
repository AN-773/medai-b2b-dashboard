import { apiClient } from './apiClient';
import { Author } from '../types';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
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

  listUsers: async (role = 'user'): Promise<IamListUsersResponse> => {
    return apiClient.get<IamListUsersResponse>(
      'IAM',
      `/users/list?_filters[subscription][eq]=inactive&limit=200`,
    );
  },

  createInvite: async (email: string): Promise<IamInvite> => {
    return apiClient.post<IamInvite>('IAM', '/invites', {
      email: email.trim(),
    });
  },

  importInvites: async (file: File): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post<unknown>('IAM', '/invites/import', formData);
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
};
