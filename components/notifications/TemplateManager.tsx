import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FileText, Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
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
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  Menu,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  Select,
  Spinner,
  Textarea,
  cn,
} from '@/components/ui';
import {
  ChannelBadge,
  DataTable,
  LoadingRow,
  TableMessage,
  Timestamp,
  channelLabel,
  errorMessage,
  formatShortTimestamp,
  plural,
  tdClass,
  useToast,
} from './shared';
import { useNotificationTabs } from './navigation';

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

const sameDraft = (a: Draft, b: Draft) =>
  a.key === b.key &&
  a.channel === b.channel &&
  a.subject_tmpl === b.subject_tmpl &&
  a.body_tmpl === b.body_tmpl &&
  a.format === b.format;

const FORMAT_LABEL: Record<TemplateFormat, string> = {
  text: 'Plain text',
  html: 'HTML',
  json: 'JSON',
};

type ChannelFilter = 'all' | NotificationChannel;

const COLUMNS = [
  { label: 'Template' },
  { label: 'Channel' },
  { label: 'Format' },
  { label: 'Version', className: 'text-right' },
  { label: 'Updated' },
  { label: 'Actions', srOnly: true, className: 'w-12' },
];

const EDITOR_FORM_ID = 'notification-template-editor';

/** Waits this long after the last keystroke before rendering the preview. */
const PREVIEW_DEBOUNCE_MS = 600;

const TemplateManager: React.FC = () => {
  const { openTab } = useNotificationTabs();
  const { toast, showToast } = useToast();

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');

  const [draft, setDraft] = useState<Draft | null>(null);
  /** The draft as it was opened or last saved — the baseline for "unsaved changes". */
  const [original, setOriginal] = useState<Draft | null>(null);
  const [editorError, setEditorError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);

  const [variablesText, setVariablesText] = useState('{\n  "firstName": "Alice"\n}');
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  /** Bumped per render request so a slow, stale response can't overwrite a newer one. */
  const previewRequestRef = useRef(0);

  const [pendingDelete, setPendingDelete] = useState<NotificationTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const sorted = useMemo(
    () =>
      [...templates].sort(
        (a, b) => a.key.localeCompare(b.key) || a.channel.localeCompare(b.channel),
      ),
    [templates],
  );

  const channelCounts = useMemo(() => {
    const counts: Record<NotificationChannel, number> = { email: 0, push: 0, teams: 0 };
    templates.forEach((template) => {
      if (template.channel in counts) counts[template.channel] += 1;
    });
    return counts;
  }, [templates]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      sorted.filter(
        (template) =>
          (channelFilter === 'all' || template.channel === channelFilter) &&
          (!query ||
            template.key.toLowerCase().includes(query) ||
            (template.subject_tmpl || '').toLowerCase().includes(query)),
      ),
    [sorted, channelFilter, query],
  );

  const resetPreview = () => {
    previewRequestRef.current += 1;
    setPreview(null);
    setPreviewError('');
    setIsPreviewing(false);
  };

  const openEditor = (next: Draft) => {
    setDraft(next);
    setOriginal(next);
    setEditorError('');
    resetPreview();
  };

  const selectTemplate = (template: NotificationTemplate) => openEditor(toDraft(template));

  const startNewTemplate = () => openEditor(newDraft());

  const closeEditor = () => {
    setDraft(null);
    setOriginal(null);
    setEditorError('');
    setIsConfirmingDiscard(false);
    resetPreview();
  };

  const isDirty = draft !== null && original !== null && !sameDraft(draft, original);

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty) {
      setIsConfirmingDiscard(true);
      return;
    }
    closeEditor();
  };

  const storedTemplate =
    draft && !draft.isNew
      ? templates.find((template) => templateId(template) === templateId(draft)) ?? null
      : null;

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

    previewRequestRef.current += 1;
    const requestId = previewRequestRef.current;
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
      if (requestId !== previewRequestRef.current) return;
      setPreview(result);
    } catch (err) {
      if (requestId !== previewRequestRef.current) return;
      console.error('Failed to preview template:', err);
      setPreview(null);
      setPreviewError(errorMessage(err, 'Unable to render this template.'));
    } finally {
      if (requestId === previewRequestRef.current) setIsPreviewing(false);
    }
  };

  // Live preview: re-render a moment after the editor or the sample variables
  // change. Read through a ref so the timer always runs the latest closure.
  const handlePreviewRef = useRef(handlePreview);
  useEffect(() => {
    handlePreviewRef.current = handlePreview;
  });

  const previewSignature = draft
    ? JSON.stringify([
        draft.key,
        draft.channel,
        draft.subject_tmpl,
        draft.body_tmpl,
        draft.format,
        variablesText,
      ])
    : '';
  const canAutoPreview = Boolean(draft?.key.trim() && draft?.body_tmpl.trim());

  useEffect(() => {
    if (!previewSignature || !canAutoPreview) return;
    const timer = window.setTimeout(() => {
      void handlePreviewRef.current();
    }, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [previewSignature, canAutoPreview]);

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

      const savedDraft = toDraft(saved);
      setDraft(savedDraft);
      setOriginal(savedDraft);
      showToast(`Saved ${key} (${channelLabel(draft.channel)}) as version ${saved.version}.`);
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
    const isOpenInEditor =
      draft !== null && !draft.isNew && templateId(draft) === templateId(template);
    try {
      await notificationService.deleteTemplate(template.key, template.channel);
      if (isOpenInEditor) {
        closeEditor();
      }
      showToast(`Deleted ${template.key} (${channelLabel(template.channel)}).`);
      await load();
    } catch (err) {
      console.error('Failed to delete template:', err);
      const message = errorMessage(err, 'Unable to delete this template.');
      if (isOpenInEditor) setEditorError(message);
      else setListError(message);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    await handleDelete(pendingDelete);
    setIsDeleting(false);
    setPendingDelete(null);
  };

  const footerHint = !draft
    ? ''
    : isDirty
      ? 'Unsaved changes'
      : draft.isNew
        ? `Saving creates the ${channelLabel(draft.channel).toLowerCase()} template`
        : `Saving stores version ${draft.version + 1}`;

  const isFiltered = query !== '' || channelFilter !== 'all';

  const renderPreviewBody = (result: TemplatePreview) => {
    if (result.body_format === 'html') {
      // Rendered as source, not injected: an operator previewing a template
      // should see exactly what the service will send.
      return (
        <pre className="mt-1.5 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-stone-900 p-3 font-mono text-xs leading-5 text-stone-100 custom-scrollbar">
          {result.body}
        </pre>
      );
    }
    return (
      <pre
        className={cn(
          'mt-1.5 max-h-96 overflow-auto whitespace-pre-wrap break-words text-stone-800 custom-scrollbar',
          result.body_format === 'json'
            ? 'rounded-md bg-stone-50 p-3 font-mono text-xs leading-5 ring-1 ring-inset ring-stone-200'
            : 'font-sans text-[13px] leading-6',
        )}
      >
        {result.body}
      </pre>
    );
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Templates"
        description="What each notification says on each channel. Open one to edit it with a live preview — saved edits reach real recipients immediately."
        meta={
          !isLoading && !listError ? (
            <Badge className="tabular-nums">{plural(templates.length, 'template')}</Badge>
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
            <Button icon={Plus} onClick={startNewTemplate}>
              New template
            </Button>
          </>
        }
      />

      {templates.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by key or subject"
            className="w-full sm:w-72"
          />
          <SegmentedControl
            label="Filter by channel"
            value={channelFilter}
            onChange={setChannelFilter}
            className="sm:ml-auto"
            options={[
              { value: 'all', label: 'All', count: templates.length },
              ...NOTIFICATION_CHANNELS.map((channel) => ({
                value: channel,
                label: channelLabel(channel),
                count: channelCounts[channel],
              })),
            ]}
          />
        </div>
      )}

      {listError && (
        <InlineAlert onDismiss={() => setListError('')} className="break-words">
          {listError}
        </InlineAlert>
      )}

      {!isLoading && !listError && templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300">
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="A template defines the subject and body a notification sends on one channel."
            action={
              <Button variant="primary" icon={Plus} onClick={startNewTemplate}>
                New template
              </Button>
            }
          />
        </div>
      ) : (
        (isLoading || templates.length > 0) && (
          <DataTable
            label="Templates"
            columns={COLUMNS}
            busy={isLoading && templates.length > 0}
            footer={
              isFiltered && visible.length > 0 ? (
                <p className="border-t border-stone-100 px-4 py-2.5 text-[13px] tabular-nums text-stone-500">
                  Showing {visible.length.toLocaleString()} of {plural(templates.length, 'template')}
                </p>
              ) : undefined
            }
          >
            {isLoading && templates.length === 0 ? (
              <LoadingRow colSpan={COLUMNS.length} label="Loading templates…" />
            ) : visible.length === 0 ? (
              <TableMessage colSpan={COLUMNS.length}>
                <EmptyState
                  compact
                  icon={FileText}
                  title="No templates match"
                  description="Try another search or channel."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setChannelFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              </TableMessage>
            ) : (
              visible.map((template) => {
                const isOpen = draft !== null && !draft.isNew && templateId(draft) === templateId(template);
                return (
                  <tr
                    key={templateId(template)}
                    onClick={() => selectTemplate(template)}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-stone-50',
                      isOpen && 'bg-stone-50',
                    )}
                  >
                    <td className={tdClass}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectTemplate(template);
                        }}
                        className="block max-w-[32rem] truncate rounded text-left font-mono font-medium text-stone-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                      >
                        {template.key}
                      </button>
                      <p
                        className="mt-0.5 max-w-[32rem] truncate text-xs text-stone-500"
                        title={template.subject_tmpl || undefined}
                      >
                        {template.subject_tmpl || <span className="text-stone-400">No subject</span>}
                      </p>
                    </td>
                    <td className={tdClass}>
                      <ChannelBadge channel={template.channel} />
                    </td>
                    <td className={cn(tdClass, 'whitespace-nowrap text-stone-600')}>
                      {FORMAT_LABEL[template.format] ?? template.format}
                    </td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>v{template.version}</td>
                    <td className={cn(tdClass, 'text-stone-600')}>
                      <Timestamp value={template.updated_at} />
                    </td>
                    {/* Stops row clicks, including from the portaled menu. */}
                    <td className="w-12 py-2 pr-3 text-right" onClick={(event) => event.stopPropagation()}>
                      <Menu
                        size="sm"
                        label={`Actions for ${template.key} (${channelLabel(template.channel)})`}
                        items={[
                          {
                            label: 'Edit',
                            icon: Pencil,
                            onSelect: () => selectTemplate(template),
                          },
                          {
                            label: 'Send a test',
                            icon: Send,
                            onSelect: () =>
                              openTab('send', { template: template.key, channel: template.channel }),
                          },
                          {
                            label: 'Delete template',
                            icon: Trash2,
                            tone: 'danger',
                            onSelect: () => setPendingDelete(template),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </DataTable>
        )
      )}

      {draft && (
        <Drawer
          open
          onClose={requestClose}
          dismissible={!isSaving && !isConfirmingDiscard && pendingDelete === null}
          width="max-w-6xl"
          title={draft.isNew ? 'New template' : <span className="font-mono">{draft.key}</span>}
          description={
            draft.isNew
              ? 'Pick a key and channel, then write the message. The preview renders as you type.'
              : `${channelLabel(draft.channel)} · Version ${draft.version} · Updated ${formatShortTimestamp(
                  storedTemplate?.updated_at,
                )}`
          }
          footer={
            <>
              {storedTemplate && (
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => setPendingDelete(storedTemplate)}
                  disabled={isSaving}
                  className="-ml-2"
                >
                  Delete
                </Button>
              )}
              <span
                className={cn(
                  'ml-auto truncate text-[13px]',
                  isDirty ? 'text-amber-700' : 'text-stone-500',
                )}
              >
                {footerHint}
              </span>
              <Button variant="ghost" onClick={requestClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form={EDITOR_FORM_ID} loading={isSaving}>
                {draft.isNew ? 'Create template' : 'Save template'}
              </Button>
            </>
          }
        >
          <form
            id={EDITOR_FORM_ID}
            onSubmit={handleSave}
            className="grid min-h-full grid-cols-1 lg:grid-cols-2"
          >
            <div className="space-y-4 px-6 py-5">
              {editorError && (
                <InlineAlert onDismiss={() => setEditorError('')} className="break-words">
                  {editorError}
                </InlineAlert>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <Field
                  label="Key"
                  description={draft.isNew ? undefined : 'Fixed once created'}
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={draft.key}
                      onChange={(event) => setDraft({ ...draft, key: event.target.value })}
                      disabled={!draft.isNew}
                      placeholder="user.invited"
                      className="font-mono text-[13px]"
                    />
                  )}
                </Field>
                <Field label="Channel">
                  {(id) => (
                    <Select
                      id={id}
                      value={draft.channel}
                      onChange={(event) =>
                        setDraft({ ...draft, channel: event.target.value as NotificationChannel })
                      }
                      disabled={!draft.isNew}
                    >
                      {NOTIFICATION_CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>
                          {channelLabel(channel)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Body format">
                  {(id) => (
                    <Select
                      id={id}
                      value={draft.format}
                      onChange={(event) =>
                        setDraft({ ...draft, format: event.target.value as TemplateFormat })
                      }
                    >
                      {TEMPLATE_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {FORMAT_LABEL[format] ?? format}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>

              <Field label="Subject">
                {(id) => (
                  <Input
                    id={id}
                    value={draft.subject_tmpl}
                    onChange={(event) => setDraft({ ...draft, subject_tmpl: event.target.value })}
                    placeholder="You're invited to {{.appName}}"
                    className="font-mono text-[13px]"
                  />
                )}
              </Field>

              <Field
                label="Body"
                description={
                  <>
                    Go template syntax — <code className="font-mono">{'{{.firstName}}'}</code> inserts
                    the <code className="font-mono">firstName</code> variable.
                  </>
                }
              >
                {(id) => (
                  <Textarea
                    id={id}
                    value={draft.body_tmpl}
                    onChange={(event) => setDraft({ ...draft, body_tmpl: event.target.value })}
                    rows={16}
                    placeholder="Hi {{.firstName}}, ..."
                    spellCheck={false}
                    className="resize-y font-mono text-[13px]"
                  />
                )}
              </Field>
            </div>

            <div className="space-y-4 border-t border-stone-200 bg-stone-50/70 px-6 py-5 lg:border-l lg:border-t-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-stone-900">Live preview</h3>
                  <p className="mt-0.5 text-[13px] text-stone-500">
                    Renders the editor’s current text — nothing is sent.
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {isPreviewing && <Spinner label="Rendering…" />}
                  <IconButton
                    icon={RefreshCw}
                    size="sm"
                    label="Render again"
                    onClick={() => void handlePreview()}
                    disabled={isPreviewing}
                  />
                </div>
              </div>

              <Field label="Sample variables" description="A JSON object of the values to fill in.">
                {(id) => (
                  <Textarea
                    id={id}
                    value={variablesText}
                    onChange={(event) => setVariablesText(event.target.value)}
                    rows={6}
                    spellCheck={false}
                    className="resize-y font-mono text-[13px]"
                  />
                )}
              </Field>

              {previewError && <InlineAlert className="break-words">{previewError}</InlineAlert>}

              {preview ? (
                <>
                  {preview.missing_variables.length > 0 && (
                    <InlineAlert tone="warning" title="Rendered blank for missing variables">
                      <span className="font-mono">{preview.missing_variables.join(', ')}</span>
                    </InlineAlert>
                  )}
                  <div
                    className={cn(
                      'overflow-hidden rounded-lg border border-stone-200 bg-white shadow-card transition-opacity',
                      isPreviewing && 'opacity-60',
                    )}
                  >
                    <div className="border-b border-stone-100 px-4 py-3">
                      <p className="text-xs text-stone-500">Subject</p>
                      <p className="mt-0.5 break-words text-sm font-medium text-stone-900">
                        {preview.subject || <span className="font-normal text-stone-400">No subject</span>}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-xs text-stone-500">
                        Body · {FORMAT_LABEL[preview.body_format as TemplateFormat] ?? preview.body_format}
                      </p>
                      {renderPreviewBody(preview)}
                    </div>
                  </div>
                </>
              ) : (
                !isPreviewing &&
                !previewError && (
                  <div className="rounded-lg border border-dashed border-stone-300 bg-white">
                    <EmptyState
                      compact
                      icon={Eye}
                      title="Nothing rendered yet"
                      description={
                        canAutoPreview
                          ? 'The preview appears in a moment.'
                          : 'Add a key and a body to see the rendered message.'
                      }
                    />
                  </div>
                )
              )}
            </div>
          </form>
        </Drawer>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete template?"
        description={
          pendingDelete
            ? `The ${pendingDelete.channel} template "${pendingDelete.key}" will be removed. Any notification requesting this template on this channel will fail until it is recreated. Seeded templates come back on the next service restart.`
            : ''
        }
        confirmLabel="Delete template"
        busy={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={isConfirmingDiscard}
        title="Discard changes?"
        description="Your edits to this template haven’t been saved."
        confirmLabel="Discard"
        onConfirm={closeEditor}
        onCancel={() => setIsConfirmingDiscard(false)}
      />

      {toast}
    </div>
  );
};

export default TemplateManager;
