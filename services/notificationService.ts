import { apiClient } from './apiClient';

// Shapes mirror contracts/notifications-contract.md (medai-notification-service).
// The dashboard authenticates with the operator's own IAM bearer token; the
// service's shared X-Notify-Key is a service-to-service credential and must
// never ship in this bundle.

export type NotificationChannel = 'email' | 'push' | 'teams';
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';
export type TemplateFormat = 'text' | 'html' | 'json';
export type DevicePlatform = 'ios' | 'android' | 'web';

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ['email', 'push', 'teams'];
export const DELIVERY_STATUSES: DeliveryStatus[] = ['pending', 'sent', 'failed', 'skipped'];
export const TEMPLATE_FORMATS: TemplateFormat[] = ['text', 'html', 'json'];

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface NotificationTemplate {
  key: string;
  channel: NotificationChannel;
  subject_tmpl: string;
  body_tmpl: string;
  format: TemplateFormat;
  version: number;
  updated_at: string;
}

export interface TeamsWebhook {
  key: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  created_at: string;
}

export interface SuppressedEmail {
  id: string;
  email: string;
  reason?: string;
  source: 'smtp_permanent' | 'acs_delivery_report' | 'manual';
  created_at: string;
}

export interface DeliveryLog {
  id: string;
  notification_id: string;
  channel: NotificationChannel;
  recipient: string;
  status: DeliveryStatus;
  error?: string;
  attempt: number;
  idempotency_key: string;
  created_at: string;
}

export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: DevicePlatform;
  last_seen: string;
  created_at: string;
}

export interface DeliveryStats {
  since: string;
  total: number;
  by_status: Record<string, number>;
  by_channel: Record<string, number>;
}

export interface AdminOverview {
  deliveries: DeliveryStats;
  channels: NotificationChannel[];
  templates: number;
  webhooks: number;
  suppressions: number;
  device_tokens: number;
  window_hours: number;
}

export interface WhoAmI {
  auth_method: 'jwt' | 'api_key' | 'none';
  email: string;
  user_id: string;
}

export interface DeliverySearchParams {
  notificationId?: string;
  channel?: NotificationChannel | '';
  status?: DeliveryStatus | '';
  recipient?: string;
  windowHours?: number;
  limit?: number;
  offset?: number;
}

export interface TemplatePreviewRequest {
  channel: NotificationChannel;
  variables?: Record<string, unknown>;
  /** Overrides the stored template so an unsaved edit can be previewed. */
  subject_tmpl?: string;
  body_tmpl?: string;
  format?: TemplateFormat;
}

export interface TemplatePreview {
  key: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  body_format: string;
  missing_variables: string[];
}

export interface Recipient {
  user_id?: string;
  email?: string;
  teams_webhook_key?: string;
  push_device_tokens?: string[];
}

export interface SendNotificationRequest {
  template_key: string;
  channels: NotificationChannel[];
  recipient: Recipient;
  variables?: Record<string, unknown>;
  idempotency_key?: string;
}

export interface DeliveryResult {
  notification_id: string;
  per_channel: Record<string, DeliveryStatus>;
  errors?: Record<string, string>;
}

export interface HealthStatus {
  status: string;
  error?: string;
}

const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '' || value === null) return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const notificationService = {
  // --- Diagnostics ---------------------------------------------------------

  /** Confirms the notification service accepts this operator's token. */
  whoami: async (): Promise<WhoAmI> =>
    apiClient.get<WhoAmI>('NOTIFICATIONS', '/admin/whoami'),

  /** Readiness probe — unauthenticated, so it also proves the host is reachable. */
  readiness: async (): Promise<HealthStatus> =>
    apiClient.get<HealthStatus>('NOTIFICATIONS', '/readyz', { authenticated: false }),

  getOverview: async (windowHours = 24): Promise<AdminOverview> =>
    apiClient.get<AdminOverview>(
      'NOTIFICATIONS',
      `/admin/overview${buildQuery({ window_hours: windowHours })}`
    ),

  // --- Delivery log --------------------------------------------------------

  searchDeliveries: async (params: DeliverySearchParams = {}): Promise<Page<DeliveryLog>> =>
    apiClient.get<Page<DeliveryLog>>(
      'NOTIFICATIONS',
      `/admin/deliveries${buildQuery({
        notification_id: params.notificationId,
        channel: params.channel,
        status: params.status,
        recipient: params.recipient,
        window_hours: params.windowHours,
        limit: params.limit,
        offset: params.offset,
      })}`
    ),

  // --- Templates -----------------------------------------------------------

  listTemplates: async (): Promise<NotificationTemplate[]> =>
    apiClient.get<NotificationTemplate[]>('NOTIFICATIONS', '/templates'),

  upsertTemplate: async (template: NotificationTemplate): Promise<NotificationTemplate> =>
    apiClient.put<NotificationTemplate>(
      'NOTIFICATIONS',
      `/templates/${encodeURIComponent(template.key)}`,
      template
    ),

  deleteTemplate: async (key: string, channel: NotificationChannel): Promise<void> =>
    apiClient.delete<void>(
      'NOTIFICATIONS',
      `/templates/${encodeURIComponent(key)}${buildQuery({ channel })}`
    ),

  previewTemplate: async (key: string, payload: TemplatePreviewRequest): Promise<TemplatePreview> =>
    apiClient.post<TemplatePreview>(
      'NOTIFICATIONS',
      `/admin/templates/${encodeURIComponent(key)}/preview`,
      payload
    ),

  // --- Teams webhooks ------------------------------------------------------

  listWebhooks: async (): Promise<TeamsWebhook[]> =>
    apiClient.get<TeamsWebhook[]>('NOTIFICATIONS', '/teams-webhooks'),

  upsertWebhook: async (webhook: TeamsWebhook): Promise<TeamsWebhook> =>
    apiClient.put<TeamsWebhook>(
      'NOTIFICATIONS',
      `/teams-webhooks/${encodeURIComponent(webhook.key)}`,
      webhook
    ),

  deleteWebhook: async (key: string): Promise<void> =>
    apiClient.delete<void>('NOTIFICATIONS', `/teams-webhooks/${encodeURIComponent(key)}`),

  testWebhook: async (key: string, message?: string): Promise<{ status: string; error?: string }> =>
    apiClient.post<{ status: string; error?: string }>(
      'NOTIFICATIONS',
      `/admin/teams-webhooks/${encodeURIComponent(key)}/test`,
      { message: message ?? '' }
    ),

  // --- Suppressions --------------------------------------------------------

  listSuppressions: async (
    query = '',
    limit = 50,
    offset = 0
  ): Promise<Page<SuppressedEmail>> => {
    // This endpoint predates the dashboard and returns a bare array, so the
    // unpaginated match count arrives on a header instead.
    const { data, headers } = await apiClient.getWithHeaders<SuppressedEmail[]>(
      'NOTIFICATIONS',
      `/suppressions${buildQuery({ q: query, limit, offset })}`
    );
    const items = data || [];
    const rawTotal = Number(headers?.['x-total-count']);

    return {
      items,
      total: Number.isFinite(rawTotal) ? rawTotal : items.length,
      limit,
      offset,
    };
  },

  addSuppression: async (email: string, reason: string): Promise<SuppressedEmail> =>
    apiClient.put<SuppressedEmail>(
      'NOTIFICATIONS',
      `/suppressions/${encodeURIComponent(email)}`,
      { reason }
    ),

  removeSuppression: async (email: string): Promise<void> =>
    apiClient.delete<void>('NOTIFICATIONS', `/suppressions/${encodeURIComponent(email)}`),

  // --- Device tokens -------------------------------------------------------

  searchDeviceTokens: async (userId = '', limit = 50, offset = 0): Promise<Page<DeviceToken>> =>
    apiClient.get<Page<DeviceToken>>(
      'NOTIFICATIONS',
      `/admin/device-tokens${buildQuery({ user_id: userId, limit, offset })}`
    ),

  revokeDeviceToken: async (token: string): Promise<void> =>
    apiClient.delete<void>('NOTIFICATIONS', `/device-tokens/${encodeURIComponent(token)}`),

  // --- Test send -----------------------------------------------------------

  sendNotification: async (payload: SendNotificationRequest): Promise<DeliveryResult> =>
    apiClient.post<DeliveryResult>('NOTIFICATIONS', '/notifications', payload),
};
