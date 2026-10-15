import React, { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { TeamsWebhook, notificationService } from '../../services/notificationService';
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  Menu,
  SectionHeader,
  StatusDot,
  SwitchRow,
  cn,
} from '@/components/ui';
import {
  DataTable,
  LoadingRow,
  Timestamp,
  errorMessage,
  plural,
  tdClass,
  useToast,
} from './shared';

interface Draft {
  key: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  isNew: boolean;
}

const emptyDraft = (): Draft => ({
  key: '',
  name: '',
  url: '',
  description: '',
  enabled: true,
  isNew: true,
});

const toDraft = (webhook: TeamsWebhook): Draft => ({
  key: webhook.key,
  name: webhook.name || '',
  url: webhook.url || '',
  description: webhook.description || '',
  enabled: webhook.enabled,
  isNew: false,
});

/** Masks the webhook URL: these carry an embedded secret. */
const maskUrl = (url: string): string => {
  if (!url) return '—';
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/…`;
  } catch {
    return `${url.slice(0, 24)}…`;
  }
};

const COLUMNS = [
  { label: 'Webhook' },
  { label: 'Destination' },
  { label: 'Status' },
  { label: 'Created' },
  { label: 'Actions', srOnly: true, className: 'w-px' },
];

const EDITOR_FORM_ID = 'teams-webhook-editor';

const TeamsWebhookManager: React.FC = () => {
  const { toast, showToast } = useToast();
  const [webhooks, setWebhooks] = useState<TeamsWebhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [draft, setDraft] = useState<Draft | null>(null);
  const [editorError, setEditorError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [testingKey, setTestingKey] = useState('');
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [pendingDelete, setPendingDelete] = useState<TeamsWebhook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setListError('');

    try {
      const data = await notificationService.listWebhooks();
      setWebhooks(data || []);
    } catch (err) {
      console.error('Failed to load Teams webhooks:', err);
      setWebhooks([]);
      setListError(errorMessage(err, 'Unable to load Teams webhooks.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEditor = (next: Draft) => {
    setDraft(next);
    setEditorError('');
  };

  const closeEditor = () => {
    if (isSaving) return;
    setDraft(null);
    setEditorError('');
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;

    const key = draft.key.trim();
    if (!key) {
      setEditorError('Webhook key is required.');
      return;
    }
    if (!/^https:\/\//i.test(draft.url.trim())) {
      setEditorError('Webhook URL must be an https:// address.');
      return;
    }
    if (draft.isNew && webhooks.some((w) => w.key === key)) {
      setEditorError(`A webhook with key "${key}" already exists.`);
      return;
    }

    setIsSaving(true);
    setEditorError('');

    try {
      await notificationService.upsertWebhook({
        key,
        name: draft.name.trim(),
        url: draft.url.trim(),
        description: draft.description.trim(),
        enabled: draft.enabled,
        created_at: '',
      });
      setDraft(null);
      showToast(draft.isNew ? `Added webhook ${key}.` : `Saved webhook ${key}.`);
      await load();
    } catch (err) {
      console.error('Failed to save Teams webhook:', err);
      setEditorError(errorMessage(err, 'Unable to save this webhook.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (webhook: TeamsWebhook) => {
    setTestingKey(webhook.key);
    setTestResults((prev) => ({ ...prev, [webhook.key]: { ok: false, message: 'Sending…' } }));

    try {
      const result = await notificationService.testWebhook(
        webhook.key,
        `Test from the MSAi dashboard for "${webhook.name || webhook.key}".`
      );
      setTestResults((prev) => ({
        ...prev,
        [webhook.key]:
          result.status === 'sent'
            ? { ok: true, message: 'Card delivered to the channel.' }
            : { ok: false, message: result.error || 'The webhook rejected the post.' },
      }));
    } catch (err) {
      console.error('Failed to test Teams webhook:', err);
      setTestResults((prev) => ({
        ...prev,
        [webhook.key]: { ok: false, message: errorMessage(err, 'The test post failed.') },
      }));
    } finally {
      setTestingKey('');
    }
  };

  const handleToggleEnabled = async (webhook: TeamsWebhook) => {
    setListError('');
    try {
      await notificationService.upsertWebhook({ ...webhook, enabled: !webhook.enabled });
      showToast(`${webhook.key} ${webhook.enabled ? 'disabled' : 'enabled'}.`);
      await load();
    } catch (err) {
      console.error('Failed to update Teams webhook:', err);
      setListError(errorMessage(err, 'Unable to update this webhook.'));
    }
  };

  const handleDelete = async (webhook: TeamsWebhook) => {
    setListError('');
    try {
      await notificationService.deleteWebhook(webhook.key);
      showToast(`Deleted webhook ${webhook.key}.`);
      await load();
    } catch (err) {
      console.error('Failed to delete Teams webhook:', err);
      setListError(errorMessage(err, 'Unable to delete this webhook.'));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    await handleDelete(pendingDelete);
    setIsDeleting(false);
    setPendingDelete(null);
  };

  const enabledCount = webhooks.filter((webhook) => webhook.enabled).length;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Teams webhooks"
        description="Destinations for ops alerts. Notifications address a webhook by its key; test one to post a card to its channel."
        meta={
          !isLoading && !listError && webhooks.length > 0 ? (
            <Badge className="tabular-nums">
              {enabledCount} of {plural(webhooks.length, 'webhook')} enabled
            </Badge>
          ) : undefined
        }
        actions={
          <>
            <IconButton
              icon={RefreshCw}
              label="Refresh"
              onClick={load}
              disabled={isLoading}
              className={isLoading ? '[&_svg]:animate-spin' : undefined}
            />
            <Button icon={Plus} onClick={() => openEditor(emptyDraft())}>
              Add webhook
            </Button>
          </>
        }
      />

      {listError && (
        <InlineAlert onDismiss={() => setListError('')} className="break-words">
          {listError}
        </InlineAlert>
      )}

      {!isLoading && !listError && webhooks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300">
          <EmptyState
            icon={BellRing}
            title="No Teams webhooks yet"
            description="Add a channel's incoming webhook so ops alerts have somewhere to land."
            action={
              <Button variant="primary" icon={Plus} onClick={() => openEditor(emptyDraft())}>
                Add webhook
              </Button>
            }
          />
        </div>
      ) : (
        (isLoading || webhooks.length > 0) && (
          <DataTable label="Teams webhooks" columns={COLUMNS} busy={isLoading && webhooks.length > 0}>
            {isLoading && webhooks.length === 0 ? (
              <LoadingRow colSpan={COLUMNS.length} label="Loading webhooks…" />
            ) : (
              webhooks.map((webhook) => {
                const result = testResults[webhook.key];
                const isTesting = testingKey === webhook.key;

                return (
                  <tr key={webhook.key} className="align-top transition-colors hover:bg-stone-50">
                    <td className={tdClass}>
                      <p className="font-mono font-medium text-stone-900">{webhook.key}</p>
                      {webhook.name && <p className="mt-0.5 text-xs text-stone-500">{webhook.name}</p>}
                    </td>
                    <td className={tdClass}>
                      <div className="max-w-[28rem]">
                        <p className="break-all font-mono text-xs text-stone-600">{maskUrl(webhook.url)}</p>
                        {webhook.description && (
                          <p className="mt-0.5 text-xs text-stone-500">{webhook.description}</p>
                        )}
                        {result && (
                          <p
                            role="status"
                            className={cn(
                              'mt-1.5 flex items-start gap-1.5 text-xs',
                              isTesting
                                ? 'text-stone-500'
                                : result.ok
                                  ? 'text-brand-700'
                                  : 'text-red-600',
                            )}
                          >
                            {isTesting ? (
                              <Loader2 size={13} className="mt-px flex-shrink-0 animate-spin" aria-hidden="true" />
                            ) : result.ok ? (
                              <CheckCircle2 size={13} className="mt-px flex-shrink-0" aria-hidden="true" />
                            ) : (
                              <XCircle size={13} className="mt-px flex-shrink-0" aria-hidden="true" />
                            )}
                            <span className="break-words">{result.message}</span>
                          </p>
                        )}
                      </div>
                    </td>
                    <td className={cn(tdClass, 'whitespace-nowrap')}>
                      <StatusDot tone={webhook.enabled ? 'green' : 'neutral'}>
                        {webhook.enabled ? 'Enabled' : 'Disabled'}
                      </StatusDot>
                    </td>
                    <td className={cn(tdClass, 'text-stone-600')}>
                      <Timestamp value={webhook.created_at} />
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Send}
                          onClick={() => handleTest(webhook)}
                          loading={isTesting}
                          title={`Post a test card to ${webhook.name || webhook.key}`}
                        >
                          Test
                        </Button>
                        <Menu
                          size="sm"
                          label={`Actions for ${webhook.key}`}
                          items={[
                            {
                              label: 'Edit',
                              icon: Pencil,
                              onSelect: () => openEditor(toDraft(webhook)),
                            },
                            {
                              label: webhook.enabled ? 'Disable' : 'Enable',
                              icon: webhook.enabled ? PowerOff : Power,
                              onSelect: () => handleToggleEnabled(webhook),
                            },
                            {
                              label: 'Delete webhook',
                              icon: Trash2,
                              tone: 'danger',
                              onSelect: () => setPendingDelete(webhook),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </DataTable>
        )
      )}

      <Dialog
        open={draft !== null}
        onClose={closeEditor}
        dismissible={!isSaving}
        width="max-w-lg"
        title={draft?.isNew ? 'Add Teams webhook' : `Edit ${draft?.key ?? 'webhook'}`}
        description="The URL contains a secret — it's masked in the list once saved."
        footer={
          <>
            <Button variant="ghost" onClick={closeEditor} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={EDITOR_FORM_ID} loading={isSaving}>
              {draft?.isNew ? 'Add webhook' : 'Save webhook'}
            </Button>
          </>
        }
      >
        {draft && (
          <form id={EDITOR_FORM_ID} onSubmit={handleSave} className="space-y-4">
            {editorError && <InlineAlert className="break-words">{editorError}</InlineAlert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Key" description={draft.isNew ? 'How notifications address it' : 'Fixed once created'}>
                {(id) => (
                  <Input
                    id={id}
                    value={draft.key}
                    onChange={(event) => setDraft({ ...draft, key: event.target.value })}
                    disabled={!draft.isNew}
                    placeholder="ops-alerts"
                    className="font-mono text-[13px]"
                  />
                )}
              </Field>
              <Field label="Name" hint="Optional">
                {(id) => (
                  <Input
                    id={id}
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="Ops alerts channel"
                  />
                )}
              </Field>
            </div>
            <Field label="Incoming webhook URL">
              {(id) => (
                <Input
                  id={id}
                  type="url"
                  value={draft.url}
                  onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                  placeholder="https://outlook.office.com/webhook/…"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-[13px]"
                />
              )}
            </Field>
            <Field label="Description" hint="Optional">
              {(id) => (
                <Input
                  id={id}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="Where deployment and bounce alerts land"
                />
              )}
            </Field>
            <div className="rounded-lg border border-stone-200 px-4 py-3">
              <SwitchRow
                label="Enabled"
                description="Disabled webhooks reject sends instead of posting."
                checked={draft.enabled}
                onChange={(enabled) => setDraft({ ...draft, enabled })}
              />
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete webhook?"
        description={
          pendingDelete
            ? `"${pendingDelete.key}" will be removed. Any alert addressed to this key will fail until it is recreated, and the URL is not recoverable from here.`
            : ''
        }
        confirmLabel="Delete webhook"
        busy={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      {toast}
    </div>
  );
};

export default TeamsWebhookManager;
