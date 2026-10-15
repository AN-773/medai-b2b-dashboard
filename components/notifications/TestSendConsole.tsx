import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Send } from 'lucide-react';
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
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  InlineAlert,
  Input,
  SectionHeader,
  Select,
  Spinner,
  Textarea,
  cn,
} from '@/components/ui';
import {
  CHANNEL_ICON,
  ChannelBadge,
  CopyButton,
  StatusBadge,
  channelLabel,
  errorMessage,
} from './shared';
import { SEND_LINK_KEYS, useLinkParams, useNotificationTabs } from './navigation';

const FormSection: React.FC<{
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <section className="space-y-4 px-5 py-5">
    <div>
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      {description && <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>}
    </div>
    {children}
  </section>
);

const TestSendConsole: React.FC = () => {
  const { openTab } = useNotificationTabs();
  // A template's "Send a test" action links here with its key and channel.
  const link = useLinkParams(SEND_LINK_KEYS);

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [webhooks, setWebhooks] = useState<TeamsWebhook[]>([]);
  const [loadError, setLoadError] = useState('');
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const [templateKey, setTemplateKey] = useState(() => link.template ?? '');
  const [channels, setChannels] = useState<NotificationChannel[]>(() =>
    NOTIFICATION_CHANNELS.includes(link.channel as NotificationChannel)
      ? [link.channel as NotificationChannel]
      : ['email']
  );
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
      } finally {
        setIsLoadingOptions(false);
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

  // Only the recipients the chosen channels will actually use.
  const recipientSummary = [
    channels.includes('email') && email.trim() && `email ${email.trim()}`,
    channels.includes('teams') && webhookKey.trim() && `Teams webhook "${webhookKey.trim()}"`,
    channels.includes('push') &&
      (userId.trim()
        ? `push to user ${userId.trim()}`
        : pushTokens.trim() && 'push to the listed device tokens'),
  ]
    .filter(Boolean)
    .join(', ');

  const trimmedKey = templateKey.trim();
  const isKnownTemplate = templateKeys.includes(trimmedKey);
  const missingVariants =
    trimmedKey && availableChannels.length > 0
      ? channels.filter((channel) => !availableChannels.includes(channel))
      : [];

  const summary =
    trimmedKey && channels.length > 0
      ? `Sends ${trimmedKey} over ${channels.map(channelLabel).join(', ')}${
          recipientSummary ? ` to ${recipientSummary}` : ''
        }.`
      : 'Choose a template and at least one channel.';

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Test send"
        description="Dispatches a real notification through the live channels, exactly as a service would publish it."
      />

      <InlineAlert tone="warning" title="This is not a preview — the recipient receives it">
        Check wording with a template’s live preview. Use this only to verify a channel end to end,
        and prefer your own address.
      </InlineAlert>

      {loadError && <InlineAlert className="break-words">{loadError}</InlineAlert>}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <form
          onSubmit={handleRequestSend}
          aria-label="Compose a test notification"
          className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-card"
        >
          <FormSection title="Message" description="The stored template to render, and the channels to send it on.">
            <Field
              label="Template key"
              description={
                !trimmedKey ? (
                  'Start typing to pick from stored templates.'
                ) : isLoadingOptions ? (
                  'Checking stored templates…'
                ) : !isKnownTemplate ? (
                  <span className="text-amber-700">
                    No stored template with this key — the send will fail.
                  </span>
                ) : (
                  `Stored for: ${availableChannels.map(channelLabel).join(', ')}`
                )
              }
            >
              {(id) => (
                <>
                  <Input
                    id={id}
                    list="send-template-options"
                    value={templateKey}
                    onChange={(event) => setTemplateKey(event.target.value)}
                    placeholder="user.invited"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono text-[13px] sm:max-w-md"
                  />
                  <datalist id="send-template-options">
                    {templateKeys.map((key) => (
                      <option key={key} value={key} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>

            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-stone-700">Channels</legend>
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_CHANNELS.map((channel) => {
                  const Icon = CHANNEL_ICON[channel];
                  const checked = channels.includes(channel);
                  const noVariant =
                    Boolean(trimmedKey) &&
                    availableChannels.length > 0 &&
                    !availableChannels.includes(channel);
                  return (
                    <label
                      key={channel}
                      className={cn(
                        'inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg border px-3 text-sm shadow-card transition-colors focus-within:ring-[3px] focus-within:ring-brand-500/15',
                        checked
                          ? 'border-brand-500 bg-brand-50/60 text-stone-900'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChannel(channel)}
                        className="h-4 w-4 rounded border-stone-300 accent-brand-600"
                      />
                      <Icon
                        size={15}
                        className={checked ? 'text-brand-700' : 'text-stone-400'}
                        aria-hidden="true"
                      />
                      {channelLabel(channel)}
                      {noVariant && <span className="text-xs text-amber-700">· no template</span>}
                    </label>
                  );
                })}
              </div>
              {missingVariants.length > 0 && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Some selected channels have no template variant and will fail.
                </p>
              )}
            </fieldset>
          </FormSection>

          <FormSection
            title="Recipients"
            description="Only the channels you picked need a recipient."
          >
            {channels.length === 0 ? (
              <p className="text-[13px] text-stone-500">Pick a channel to add its recipient.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {channels.includes('email') && (
                  <Field label="Recipient email">
                    {(id) => (
                      <Input
                        id={id}
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@medicalstudent.ai"
                      />
                    )}
                  </Field>
                )}
                {channels.includes('push') && (
                  <>
                    <Field label="User ID" description="Push goes to the devices registered for this user.">
                      {(id) => (
                        <Input
                          id={id}
                          value={userId}
                          onChange={(event) => setUserId(event.target.value)}
                          placeholder="users/42"
                          spellCheck={false}
                          className="font-mono text-[13px]"
                        />
                      )}
                    </Field>
                    <Field
                      label="Device tokens"
                      hint="Optional"
                      description="Comma-separated; overrides the user's registry."
                    >
                      {(id) => (
                        <Input
                          id={id}
                          value={pushTokens}
                          onChange={(event) => setPushTokens(event.target.value)}
                          placeholder="fcm-token-1, fcm-token-2"
                          spellCheck={false}
                          className="font-mono text-[13px]"
                        />
                      )}
                    </Field>
                  </>
                )}
                {channels.includes('teams') && (
                  <Field
                    label="Teams webhook"
                    description={
                      !isLoadingOptions && webhooks.length === 0
                        ? 'No webhooks configured — add one under Webhooks.'
                        : undefined
                    }
                  >
                    {(id) => (
                      <Select
                        id={id}
                        value={webhookKey}
                        onChange={(event) => setWebhookKey(event.target.value)}
                      >
                        <option value="">None</option>
                        {webhooks.map((webhook) => (
                          <option key={webhook.key} value={webhook.key}>
                            {webhook.key}
                            {webhook.enabled ? '' : ' (disabled)'}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                )}
              </div>
            )}
          </FormSection>

          <FormSection title="Variables" description="A JSON object passed to the template.">
            <Field label="Variables (JSON)">
              {(id) => (
                <Textarea
                  id={id}
                  value={variablesText}
                  onChange={(event) => setVariablesText(event.target.value)}
                  rows={7}
                  spellCheck={false}
                  className="resize-y font-mono text-[13px]"
                />
              )}
            </Field>
          </FormSection>

          <div className="space-y-3 rounded-b-xl bg-stone-50/60 px-5 py-4">
            {sendError && (
              <InlineAlert onDismiss={() => setSendError('')} className="break-words">
                {sendError}
              </InlineAlert>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 break-words text-[13px] text-stone-500">{summary}</p>
              <Button type="submit" variant="primary" icon={Send} loading={isSending}>
                Send notification
              </Button>
            </div>
          </div>
        </form>

        <section
          aria-labelledby="test-send-result-title"
          className="rounded-xl border border-stone-200 bg-white shadow-card xl:sticky xl:top-16"
        >
          <header className="border-b border-stone-100 px-5 py-4">
            <h3 id="test-send-result-title" className="text-sm font-semibold text-stone-900">
              Result
            </h3>
            <p className="mt-0.5 text-[13px] text-stone-500">Per-channel outcome from the dispatcher.</p>
          </header>

          <div aria-live="polite">
            {isSending ? (
              <Spinner label="Dispatching…" className="py-14" />
            ) : result ? (
              <div className="space-y-4 p-5">
                <div>
                  <p className="text-xs text-stone-500">Notification ID</p>
                  <div className="mt-1 flex items-start gap-1">
                    <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-stone-800">
                      {result.notification_id}
                    </code>
                    <CopyButton value={result.notification_id} label="Copy notification ID" className="-my-1" />
                  </div>
                </div>

                <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                  {Object.entries(result.per_channel).map(([channel, status]) => (
                    <li key={channel} className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <ChannelBadge channel={channel as NotificationChannel} />
                        <StatusBadge status={status} />
                      </div>
                      {result.errors?.[channel] && (
                        <p className="mt-1.5 break-words text-xs text-red-700">
                          {result.errors[channel]}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>

                <Button
                  size="sm"
                  iconRight={ArrowRight}
                  onClick={() => openTab('deliveries', { notification: result.notification_id })}
                >
                  View attempts in the delivery log
                </Button>
              </div>
            ) : (
              <EmptyState
                compact
                icon={Send}
                title="Nothing sent yet"
                description="The dispatch result appears here, with a link to its delivery attempts."
              />
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={isConfirming}
        tone="default"
        title="Send a real notification?"
        description={`This delivers "${templateKey}" over ${channels.join(', ')} to ${
          recipientSummary || 'the recipient you entered'
        }. It is not a drill — the recipient will receive it.`}
        confirmLabel="Send now"
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
