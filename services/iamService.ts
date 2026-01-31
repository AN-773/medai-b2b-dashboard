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

export const iamService = {
  login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('IAM', '/auth/login', credentials, { authenticated: false });
  },

  getUserProfile: async (): Promise<UserProfile> => {
    return apiClient.get<UserProfile>('IAM', '/users/me');
  },

  getAuthors: async (): Promise<Author[]> => {
    return apiClient.get<Author[]>('IAM', '/authors');
  }
};
