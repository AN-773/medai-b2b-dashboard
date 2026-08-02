import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import {
  NOTIFICATION_CHANNELS,
  NotificationChannel,
  NotificationTemplate,
  TEMPLATE_FORMATS,
  TemplateFormat,
  TemplatePreview,
  notificationService,
} from '../../services/notificationService';
import {
  ChannelBadge,
  ErrorBanner,
  Panel,
  errorMessage,
  formatTimestamp,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './shared';

interface Draft {
  key: string;
  channel: NotificationChannel;
  subject_tmpl: string;
  body_tmpl: string;
  format: TemplateFormat;
  version: number;
  /** True until the template has been saved to the service at least once. */
  isNew: boolean;
}

const templateId = (t: { key: string; channel: NotificationChannel }) => `${t.key}/${t.channel}`;

const toDraft = (template: NotificationTemplate): Draft => ({
  key: template.key,
  channel: template.channel,
  subject_tmpl: template.subject_tmpl || '',
  body_tmpl: template.body_tmpl || '',
  format: template.format || 'text',
  version: template.version || 0,
  isNew: false,
});

const newDraft = (): Draft => ({
  key: '',
  channel: 'email',
  subject_tmpl: '',
  body_tmpl: '',
  format: 'text',
  version: 1,
  isNew: true,
});

const TemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [draft, setDraft] = useState<Draft | null>(null);
  const [editorError, setEditorError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  const [variablesText, setVariablesText] = useState('{\n  "firstName": "Alice"\n}');
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [pendingDelete, setPendingDelete] = useState<NotificationTemplate | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setListError('');

    try {
      const data = await notificationService.listTemplates();
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setTemplates([]);
      setListError(errorMessage(err, 'Unable to load templates.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const byKey = new Map<string, NotificationTemplate[]>();
    templates.forEach((template) => {
      const list = byKey.get(template.key) || [];
      list.push(template);
      byKey.set(template.key, list);
    });
    return Array.from(byKey.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [templates]);

  const selectTemplate = (template: NotificationTemplate) => {
    setDraft(toDraft(template));
    setEditorError('');
    setSavedNotice('');
    setPreview(null);
    setPreviewError('');
  };

  const startNewTemplate = () => {
    setDraft(newDraft());
    setEditorError('');
    setSavedNotice('');
    setPreview(null);
    setPreviewError('');
  };

  const parseVariables = (): Record<string, unknown> | null => {
    const raw = variablesText.trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setPreviewError('Variables must be a JSON object.');
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      setPreviewError('Variables are not valid JSON.');
      return null;
    }
  };

  const handlePreview = async () => {
    if (!draft) return;
    setPreviewError('');

    const variables = parseVariables();
    if (!variables) return;

    if (!draft.key.trim()) {
      setPreviewError('Give the template a key before previewing.');
      return;
    }

    setIsPreviewing(true);
    try {
      // Send the editor's current text as a draft override so the preview
      // reflects unsaved edits rather than what is stored.
      const result = await notificationService.previewTemplate(draft.key.trim(), {
        channel: draft.channel,
        variables,
        subject_tmpl: draft.subject_tmpl,
        body_tmpl: draft.body_tmpl,
        format: draft.format,
      });
      setPreview(result);
    } catch (err) {
      console.error('Failed to preview template:', err);
      setPreview(null);
      setPreviewError(errorMessage(err, 'Unable to render this template.'));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;

    const key = draft.key.trim();
    if (!key) {
      setEditorError('Template key is required.');
      return;
    }
    if (!draft.body_tmpl.trim()) {
      setEditorError('Body template is required.');
      return;
    }
    if (draft.isNew && templates.some((t) => templateId(t) === `${key}/${draft.channel}`)) {
      setEditorError(`A ${draft.channel} template with key "${key}" already exists.`);
      return;
    }

    setIsSaving(true);
    setEditorError('');
    setSavedNotice('');

    try {
      // The service re-seeds any row whose version is behind the build's, so
      // an edit must bump past the seeded version to survive a restart.
      const saved = await notificationService.upsertTemplate({
        key,
        channel: draft.channel,
        subject_tmpl: draft.subject_tmpl,
        body_tmpl: draft.body_tmpl,
        format: draft.format,
        version: draft.version + 1,
        updated_at: new Date().toISOString(),
      });

      setDraft(toDraft(saved));
      setSavedNotice(`Saved ${key} (${draft.channel}) as version ${saved.version}.`);
      await load();
    } catch (err) {
      console.error('Failed to save template:', err);
      setEditorError(errorMessage(err, 'Unable to save this template.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (template: NotificationTemplate) => {
    setListError('');
    try {
      await notificationService.deleteTemplate(template.key, template.channel);
      if (draft && draft.key === template.key && draft.channel === template.channel) {
        setDraft(null);
      }
      await load();
    } catch (err) {
      console.error('Failed to delete template:', err);
      setListError(errorMessage(err, 'Unable to delete this template.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Templates</h3>
          <p className="text-sm text-slate-500">
            Go template syntax — <code className="text-xs">{'{{.firstName}}'}</code> interpolates a
            variable. Preview before saving; edits reach real recipients immediately.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={isLoading} className={secondaryButtonClass}>
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
          <button type="button" onClick={startNewTemplate} className={primaryButtonClass}>
            <Plus size={16} />
            New Template
          </button>
        </div>
      </div>

      <ErrorBanner message={listError} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.6fr)] gap-6 items-start">
        <Panel title="Template directory" description={`${templates.length} stored`}>
          <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <p className="px-6 py-10 text-center text-sm text-slate-500">
                <Loader2 size={16} className="inline animate-spin mr-2" />
                Loading templates
              </p>
            ) : grouped.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-500">
                No templates stored yet.
              </p>
            ) : (
              grouped.map(([key, variants]) => (
                <div key={key} className="px-6 py-4">
                  <p className="text-sm font-mono font-bold text-slate-900 break-all">{key}</p>
                  <div className="mt-2 space-y-1">
                    {variants.map((variant) => {
                      const isSelected =
                        draft && !draft.isNew && templateId(draft) === templateId(variant);

                      return (
                        <div key={templateId(variant)} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => selectTemplate(variant)}
                            className={`flex-1 flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                              isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <ChannelBadge channel={variant.channel} />
                            <span className="text-xs text-slate-500">v{variant.version}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(variant)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            aria-label={`Delete ${key} ${variant.channel} template`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        {draft ? (
          <div className="space-y-6">
            <form onSubmit={handleSave}>
              <Panel
                title={draft.isNew ? 'New template' : `Editing ${draft.key}`}
                description={
                  draft.isNew
                    ? 'Saving creates the template for the selected channel.'
                    : `Version ${draft.version} — saving stores version ${draft.version + 1}.`
                }
              >
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="space-y-2">
                      <label htmlFor="template-key" className={labelClass}>
                        Key
                      </label>
                      <input
                        id="template-key"
                        type="text"
                        value={draft.key}
                        onChange={(event) => setDraft({ ...draft, key: event.target.value })}
                        disabled={!draft.isNew}
                        placeholder="user.invited"
                        className={`${inputClass} font-mono disabled:opacity-70 disabled:cursor-not-allowed`}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="template-channel" className={labelClass}>
                        Channel
                      </label>
                      <select
                        id="template-channel"
                        value={draft.channel}
                        onChange={(event) =>
                          setDraft({ ...draft, channel: event.target.value as NotificationChannel })
                        }
                        disabled={!draft.isNew}
                        className={`${inputClass} disabled:opacity-70 disabled:cursor-not-allowed`}
                      >
                        {NOTIFICATION_CHANNELS.map((channel) => (
                          <option key={channel} value={channel}>
                            {channel}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="template-format" className={labelClass}>
                        Body format
                      </label>
                      <select
                        id="template-format"
                        value={draft.format}
                        onChange={(event) =>
                          setDraft({ ...draft, format: event.target.value as TemplateFormat })
                        }
                        className={inputClass}
                      >
                        {TEMPLATE_FORMATS.map((format) => (
                          <option key={format} value={format}>
                            {format}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="template-subject" className={labelClass}>
                      Subject
                    </label>
                    <input
                      id="template-subject"
                      type="text"
                      value={draft.subject_tmpl}
                      onChange={(event) => setDraft({ ...draft, subject_tmpl: event.target.value })}
                      placeholder="You're invited to {{.appName}}"
                      className={`${inputClass} font-mono`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="template-body" className={labelClass}>
                      Body
                    </label>
                    <textarea
                      id="template-body"
                      value={draft.body_tmpl}
                      onChange={(event) => setDraft({ ...draft, body_tmpl: event.target.value })}
                      rows={12}
                      placeholder="Hi {{.firstName}}, ..."
                      className={`${inputClass} font-mono leading-relaxed`}
                    />
                  </div>

                  <ErrorBanner message={editorError} />

                  {savedNotice && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      {savedNotice}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-2">
                    <p className="text-xs text-slate-500">
                      Last updated {formatTimestamp(templates.find((t) => draft && templateId(t) === templateId(draft))?.updated_at)}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handlePreview}
                        disabled={isPreviewing}
                        className={secondaryButtonClass}
                      >
                        {isPreviewing ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Eye size={16} />
                        )}
                        Preview
                      </button>
                      <button type="submit" disabled={isSaving} className={primaryButtonClass}>
                        {isSaving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Save size={16} />
                        )}
                        Save Template
                      </button>
                    </div>
                  </div>
                </div>
              </Panel>
            </form>

            <Panel
              title="Preview"
              description="Renders the editor's current text — no message is sent."
            >
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="template-variables" className={labelClass}>
                    Variables (JSON)
                  </label>
                  <textarea
                    id="template-variables"
                    value={variablesText}
                    onChange={(event) => setVariablesText(event.target.value)}
                    rows={10}
                    className={`${inputClass} font-mono text-xs`}
                  />
                  <ErrorBanner message={previewError} />
                </div>

                <div className="space-y-3">
                  {preview ? (
                    <>
                      {preview.missing_variables.length > 0 && (
                        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                          <p className="text-xs">
                            Rendered blank for:{' '}
                            <span className="font-mono font-bold">
                              {preview.missing_variables.join(', ')}
                            </span>
                          </p>
                        </div>
                      )}

                      <div>
                        <p className={labelClass}>Subject</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 break-words">
                          {preview.subject || '—'}
                        </p>
                      </div>

                      <div>
                        <p className={labelClass}>Body ({preview.body_format})</p>
                        {preview.body_format === 'html' ? (
                          // Rendered as source, not injected: an operator
                          // previewing a template should see exactly what the
                          // service will send.
                          <pre className="mt-1 max-h-80 overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
                            {preview.body}
                          </pre>
                        ) : (
                          <pre className="mt-1 max-h-80 overflow-auto rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                            {preview.body}
                          </pre>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-10">
                      <Eye size={36} className="text-slate-200 mb-3" />
                      <p className="text-sm font-medium text-slate-900">Nothing rendered yet</p>
                      <p className="text-xs mt-1">Select Preview to render with these variables.</p>
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
            <FileText size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="font-medium text-slate-900">No template selected</p>
            <p className="text-sm text-slate-500 mt-1">
              Pick one from the directory, or create a new template.
            </p>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={pendingDelete !== null}
        title="Delete template?"
        message={
          pendingDelete
            ? `The ${pendingDelete.channel} template "${pendingDelete.key}" will be removed. Any notification requesting this template on this channel will fail until it is recreated. Seeded templates come back on the next service restart.`
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

export default TemplateManager;
