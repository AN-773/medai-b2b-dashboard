import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Send } from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import {
  DeliveryResult,
  NOTIFICATION_CHANNELS,
  NotificationChannel,
  NotificationTemplate,
  SendNotificationRequest,
  TeamsWebhook,
  notificationService,
} from '../../services/notificationService';
import {
  ChannelBadge,
  ErrorBanner,
  Panel,
  StatusBadge,
  errorMessage,
  inputClass,
  labelClass,
  primaryButtonClass,
} from './shared';

const TestSendConsole: React.FC = () => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [webhooks, setWebhooks] = useState<TeamsWebhook[]>([]);
  const [loadError, setLoadError] = useState('');

  const [templateKey, setTemplateKey] = useState('');
  const [channels, setChannels] = useState<NotificationChannel[]>(['email']);
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [webhookKey, setWebhookKey] = useState('');
  const [pushTokens, setPushTokens] = useState('');
  const [variablesText, setVariablesText] = useState('{\n  "firstName": "Alice"\n}');

  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [templateList, webhookList] = await Promise.all([
          notificationService.listTemplates(),
          notificationService.listWebhooks().catch(() => [] as TeamsWebhook[]),
        ]);
        setTemplates(templateList || []);
        setWebhooks(webhookList || []);
      } catch (err) {
        console.error('Failed to load send options:', err);
        setLoadError(errorMessage(err, 'Unable to load templates for the test console.'));
      }
    };
    load();
  }, []);

  const templateKeys = useMemo(
    () => Array.from(new Set(templates.map((t) => t.key))).sort(),
    [templates]
  );

  /** Channels this template actually has a stored variant for. */
  const availableChannels = useMemo(
    () =>
      templates.filter((t) => t.key === templateKey).map((t) => t.channel),
    [templates, templateKey]
  );

  const toggleChannel = (channel: NotificationChannel) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const validate = (): string => {
    if (!templateKey.trim()) return 'Choose a template.';
    if (channels.length === 0) return 'Choose at least one channel.';
    if (channels.includes('email') && !email.trim()) {
      return 'The email channel needs a recipient address.';
    }
    if (channels.includes('teams') && !webhookKey.trim()) {
      return 'The teams channel needs a webhook key.';
    }
    if (channels.includes('push') && !userId.trim() && !pushTokens.trim()) {
      return 'The push channel needs a user ID or explicit device tokens.';
    }
    try {
      const parsed = JSON.parse(variablesText.trim() || '{}');
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return 'Variables must be a JSON object.';
      }
    } catch {
      return 'Variables are not valid JSON.';
    }
    return '';
  };

  const handleRequestSend = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setSendError(problem);
      return;
    }
    setSendError('');
    setIsConfirming(true);
  };

  const handleSend = async () => {
    setIsSending(true);
    setSendError('');
    setResult(null);

    const payload: SendNotificationRequest = {
      template_key: templateKey.trim(),
      channels,
      recipient: {
        email: email.trim() || undefined,
        user_id: userId.trim() || undefined,
        teams_webhook_key: webhookKey.trim() || undefined,
        push_device_tokens: pushTokens
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      },
      variables: JSON.parse(variablesText.trim() || '{}'),
    };

    if (payload.recipient.push_device_tokens?.length === 0) {
      delete payload.recipient.push_device_tokens;
    }

    try {
      setResult(await notificationService.sendNotification(payload));
    } catch (err) {
      console.error('Failed to send test notification:', err);
      setSendError(errorMessage(err, 'The notification service rejected this send.'));
    } finally {
      setIsSending(false);
    }
  };

  const recipientSummary = [
    email.trim() && `email ${email.trim()}`,
    webhookKey.trim() && `Teams webhook "${webhookKey.trim()}"`,
    userId.trim() && `push to user ${userId.trim()}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Send a Test</h3>
        <p className="text-sm text-slate-500">
          Dispatches a real notification through the live channels — the recipient receives it.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <p className="text-sm">
          This is not a preview. Use a template preview to check wording; use this only to verify a
          channel end to end, and prefer your own address.
        </p>
      </div>

      <ErrorBanner message={loadError} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)] gap-6 items-start">
        <form onSubmit={handleRequestSend}>
          <Panel title="Compose" description="Mirrors the payload a service would publish.">
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="send-template" className={labelClass}>
                    Template key
                  </label>
                  <input
                    id="send-template"
                    list="send-template-options"
                    type="text"
                    value={templateKey}
                    onChange={(event) => setTemplateKey(event.target.value)}
                    placeholder="user.invited"
                    className={`${inputClass} font-mono`}
                  />
                  <datalist id="send-template-options">
                    {templateKeys.map((key) => (
                      <option key={key} value={key} />
                    ))}
                  </datalist>
                  {templateKey && availableChannels.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Stored for: {availableChannels.join(', ')}
                    </p>
                  )}
                  {templateKey && templateKeys.includes(templateKey) === false && (
                    <p className="text-xs text-amber-700">
                      No stored template with this key — the send will fail.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <span className={labelClass}>Channels</span>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {NOTIFICATION_CHANNELS.map((channel) => (
                      <label
                        key={channel}
                        className="inline-flex items-center gap-2 text-sm text-slate-700 capitalize"
                      >
                        <input
                          type="checkbox"
                          checked={channels.includes(channel)}
                          onChange={() => toggleChannel(channel)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        {channel}
                      </label>
                    ))}
                  </div>
                  {templateKey &&
                    channels.some(
                      (c) => availableChannels.length > 0 && !availableChannels.includes(c)
                    ) && (
                      <p className="text-xs text-amber-700">
                        Some selected channels have no template variant and will fail.
                      </p>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="send-email" className={labelClass}>
                    Recipient email
                  </label>
                  <input
                    id="send-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@medicalstudent.ai"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="send-user-id" className={labelClass}>
                    User ID <span className="normal-case font-semibold text-slate-400">(push)</span>
                  </label>
                  <input
                    id="send-user-id"
                    type="text"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    placeholder="users/42"
                    className={`${inputClass} font-mono text-xs`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="send-webhook" className={labelClass}>
                    Teams webhook key
                  </label>
                  <select
                    id="send-webhook"
                    value={webhookKey}
                    onChange={(event) => setWebhookKey(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">None</option>
                    {webhooks.map((webhook) => (
                      <option key={webhook.key} value={webhook.key}>
                        {webhook.key}
                        {webhook.enabled ? '' : ' (disabled)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="send-tokens" className={labelClass}>
                    Device tokens{' '}
                    <span className="normal-case font-semibold text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="send-tokens"
                    type="text"
                    value={pushTokens}
                    onChange={(event) => setPushTokens(event.target.value)}
                    placeholder="Comma-separated; overrides the user's registry"
                    className={`${inputClass} font-mono text-xs`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="send-variables" className={labelClass}>
                  Variables (JSON)
                </label>
                <textarea
                  id="send-variables"
                  value={variablesText}
                  onChange={(event) => setVariablesText(event.target.value)}
                  rows={8}
                  className={`${inputClass} font-mono text-xs`}
                />
              </div>

              <ErrorBanner message={sendError} />

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={isSending} className={primaryButtonClass}>
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Send Notification
                </button>
              </div>
            </div>
          </Panel>
        </form>

        <Panel title="Result" description="Per-channel outcome from the dispatcher.">
          <div className="p-6">
            {result ? (
              <div className="space-y-4">
                <div>
                  <p className={labelClass}>Notification ID</p>
                  <p className="mt-1 font-mono text-xs text-slate-700 break-all">
                    {result.notification_id}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Paste this into the Delivery Log tab to see every attempt.
                  </p>
                </div>

                <div className="space-y-3">
                  {Object.entries(result.per_channel).map(([channel, status]) => (
                    <div
                      key={channel}
                      className="rounded-xl border border-slate-200 px-4 py-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <ChannelBadge channel={channel as NotificationChannel} />
                        <StatusBadge status={status} />
                      </div>
                      {result.errors?.[channel] && (
                        <p className="text-xs text-rose-700 break-words">
                          {result.errors[channel]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-slate-500 py-12">
                <Send size={36} className="text-slate-200 mb-3" />
                <p className="text-sm font-medium text-slate-900">Nothing sent yet</p>
                <p className="text-xs mt-1">The dispatch result appears here.</p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <ConfirmationModal
        isOpen={isConfirming}
        title="Send a real notification?"
        message={`This delivers "${templateKey}" over ${channels.join(', ')} to ${
          recipientSummary || 'the recipient below'
        }. It is not a drill — the recipient will receive it.`}
        confirmLabel="Send"
        variant="warning"
        onConfirm={() => {
          setIsConfirming(false);
          handleSend();
        }}
        onCancel={() => setIsConfirming(false)}
      />
    </div>
  );
};

export default TestSendConsole;
