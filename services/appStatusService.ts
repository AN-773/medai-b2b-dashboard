import { apiClient } from './apiClient';

export interface AppAnnouncement {
  id: string;
  message: string;
  enabled: boolean;
  showOnLanding: boolean;
}

export interface AppStatusSettings {
  revision: number;
  maintenance: { enabled: boolean; scope: 'app' | 'all'; message: string };
  announcements: AppAnnouncement[];
}

export const appStatusService = {
  get: () => apiClient.get<AppStatusSettings>('TESTS', '/superadmin/app-status'),
  update: (settings: AppStatusSettings) => apiClient.put<AppStatusSettings>('TESTS', '/superadmin/app-status', settings),
};
