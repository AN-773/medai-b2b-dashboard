import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import { TeamsWebhook, notificationService } from '../../services/notificationService';
import {
  ErrorBanner,
  Panel,
  TableMessage,
  errorMessage,
  formatTimestamp,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
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

const TeamsWebhookManager: React.FC = () => {
  const [webhooks, setWebhooks] = useState<TeamsWebhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [draft, setDraft] = useState<Draft | null>(null);
  const [editorError, setEditorError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [testingKey, setTestingKey] = useState('');
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [pendingDelete, setPendingDelete] = useState<TeamsWebhook | null>(null);

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
      await load();
    } catch (err) {
      console.error('Failed to delete Teams webhook:', err);
      setListError(errorMessage(err, 'Unable to delete this webhook.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Teams Webhooks</h3>
          <p className="text-sm text-slate-500">
            Destinations for ops alerts. Notifications address a webhook by its key.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={isLoading} className={secondaryButtonClass}>
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          <button type="button" onClick={() => setDraft(emptyDraft())} className={primaryButtonClass}>
            <Plus size={16} />
            Add Webhook
          </button>
        </div>
      </div>

      <ErrorBanner message={listError} />

      {draft && (
        <form onSubmit={handleSave}>
          <Panel
            title={draft.isNew ? 'New webhook' : `Editing ${draft.key}`}
            description="The URL contains a secret — it is masked in the directory once saved."
          >
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="webhook-key" className={labelClass}>
                    Key
                  </label>
                  <input
                    id="webhook-key"
                    type="text"
                    value={draft.key}
                    onChange={(event) => setDraft({ ...draft, key: event.target.value })}
                    disabled={!draft.isNew}
                    placeholder="ops-alerts"
                    className={`${inputClass} font-mono disabled:opacity-70 disabled:cursor-not-allowed`}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="webhook-name" className={labelClass}>
                    Name
                  </label>
                  <input
                    id="webhook-name"
                    type="text"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="Ops Alerts channel"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="webhook-url" className={labelClass}>
                  Incoming webhook URL
                </label>
                <div className="relative">
                  <Link2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="webhook-url"
                    type="url"
                    value={draft.url}
                    onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                    placeholder="https://outlook.office.com/webhook/…"
                    className={`${inputClass} pl-11 font-mono text-xs`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="webhook-description" className={labelClass}>
                  Description
                </label>
                <input
                  id="webhook-description"
                  type="text"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="Where deployment and bounce alerts land"
                  className={inputClass}
                />
              </div>

              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Enabled — disabled webhooks reject sends instead of posting.
              </label>

              <ErrorBanner message={editorError} />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setDraft(null)} className={secondaryButtonClass}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className={primaryButtonClass}>
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Webhook
                </button>
              </div>
            </div>
          </Panel>
        </form>
      )}

      <Panel title="Webhook directory" description={`${webhooks.length} configured`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Key</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Destination</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableMessage colSpan={5}>
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Loading webhooks
                  </span>
                </TableMessage>
              ) : webhooks.length === 0 ? (
                <TableMessage colSpan={5}>
                  No Teams webhooks configured yet.
                </TableMessage>
              ) : (
                webhooks.map((webhook) => {
                  const result = testResults[webhook.key];

                  return (
                    <tr key={webhook.key} className="hover:bg-slate-50/60 transition-colors align-top">
                      <td className="px-6 py-4">
                        <p className="text-sm font-mono font-bold text-slate-900">{webhook.key}</p>
                        {webhook.name && (
                          <p className="text-xs text-slate-500 mt-1">{webhook.name}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-mono text-slate-600 break-all">
                          {maskUrl(webhook.url)}
                        </p>
                        {webhook.description && (
                          <p className="text-xs text-slate-400 mt-1">{webhook.description}</p>
                        )}
                        {result && (
                          <p
                            className={`mt-2 inline-flex items-start gap-1.5 text-xs ${
                              result.ok ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {result.ok ? (
                              <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                            ) : (
                              <XCircle size={13} className="mt-0.5 shrink-0" />
                            )}
                            {result.message}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(webhook)}
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                            webhook.enabled
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {webhook.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                        {formatTimestamp(webhook.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleTest(webhook)}
                            disabled={testingKey === webhook.key}
                            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {testingKey === webhook.key ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                            Test
                          </button>
                          <button
                            type="button"
                            onClick={() => setDraft(toDraft(webhook))}
                            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(webhook)}
                            className="inline-flex items-center gap-2 px-3 py-2 border border-rose-200 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <ConfirmationModal
        isOpen={pendingDelete !== null}
        title="Delete webhook?"
        message={
          pendingDelete
            ? `"${pendingDelete.key}" will be removed. Any alert addressed to this key will fail until it is recreated, and the URL is not recoverable from here.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (pendingDelete) {
            handleDelete(pendingDelete);
          }
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default TeamsWebhookManager;
