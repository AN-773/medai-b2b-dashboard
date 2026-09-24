import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Prompt, PromptCatalogItem, PromptFile, PromptPayload } from '../../types';
import { testsService } from '../../services/testsService';
import {
  ArrowLeft,
  ChevronRight,
  FilePlus,
  FileText,
  Lock,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  PageHeader,
  Select,
  Textarea,
  cn,
} from '@/components/ui';
import {
  displayPromptExam,
  getPromptScopeTone,
  getPromptTypeOption,
  getPromptTypeOptions,
  normalizePromptExam,
  serializePromptSchema,
} from './promptConfig';
import {
  SaveBar,
  SettingsCard,
  Toast,
  formatDate,
  plural,
  useToast,
  useUnsavedChanges,
} from './SettingsKit';

interface PromptEditorPageProps {
  prompt: Prompt | null;
  initialType?: string | null;
  catalogItems: PromptCatalogItem[];
  existingPrompts: Prompt[];
  onClose: (didChange: boolean) => void;
}

const getCatalogItemForType = (catalogItems: PromptCatalogItem[], type: string): PromptCatalogItem | null =>
  catalogItems.find(item => item.type === type) ?? null;

const promptTypeRequiresExam = (catalogItems: PromptCatalogItem[], type: string): boolean =>
  getCatalogItemForType(catalogItems, type)?.requiresExam ?? false;

const normalizePromptExamForCatalogType = (
  catalogItems: PromptCatalogItem[],
  type: string,
  exam?: string | null,
): string => normalizePromptExam(promptTypeRequiresExam(catalogItems, type), exam);

const getInitialPromptFormData = (
  prompt: Prompt | null,
  initialType: string | null | undefined,
  catalogItems: PromptCatalogItem[],
): PromptPayload => {
  const type = prompt?.type || initialType || catalogItems[0]?.type || '';

  return {
    id: prompt?.id,
    exam: normalizePromptExamForCatalogType(catalogItems, type, prompt?.exam),
    type,
    text: prompt?.text || '',
    userTemplate: prompt?.userTemplate || '',
    enforcedSchema: serializePromptSchema(prompt?.enforcedSchema),
  };
};

/** The editable fields, normalised, for dirty tracking. */
const getFormSnapshot = (payload: PromptPayload, catalogItems: PromptCatalogItem[]) =>
  JSON.stringify([
    payload.type,
    normalizePromptExamForCatalogType(catalogItems, payload.type, payload.exam),
    payload.text,
    payload.userTemplate || '',
    payload.enforcedSchema || '',
  ]);

const toPromptFile = (file: Awaited<ReturnType<typeof testsService.uploadFile>>): PromptFile => ({
  id: file.id,
  questionId: null,
  identifier: file.identifier,
  name: file.name,
  path: file.path,
  type: file.type,
  size: file.size,
  url: file.url,
  tenantId: null,
  created: file.created,
  updated: file.updated,
  deletedAt: file.deletedAt || null,
});

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const EXAM_OPTIONS = ['STEP 1', 'STEP 2', 'STEP 3'];

const editorClass = 'resize-y font-mono';

/** Collapsible read-only view of a built-in default, with a shortcut to start from it. */
const DefaultReference: React.FC<{
  title: string;
  text: string;
  /** Shown only while the field is empty. */
  onUse?: () => void;
}> = ({ title, text, onUse }) => {
  if (!text.trim()) return null;
  return (
    <details className="group mt-3 rounded-lg border border-stone-200 bg-stone-50/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-stone-600 transition-colors hover:text-stone-900 [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} className="flex-shrink-0 text-stone-400 transition-transform group-open:rotate-90" />
        <span className="font-medium">{title}</span>
        <span className="text-stone-400">· read only</span>
      </summary>
      <div className="border-t border-stone-200 px-3 py-3">
        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-stone-600 custom-scrollbar">
          {text}
        </pre>
        {onUse && (
          <Button size="sm" className="mt-3" onClick={onUse}>
            Start from the default
          </Button>
        )}
      </div>
    </details>
  );
};

const PromptEditorPage: React.FC<PromptEditorPageProps> = ({
  prompt,
  initialType,
  catalogItems,
  existingPrompts,
  onClose,
}) => {
  const [persistedPrompt, setPersistedPrompt] = useState<Prompt | null>(prompt);
  const [formData, setFormData] = useState<PromptPayload>(() =>
    getInitialPromptFormData(prompt, initialType, catalogItems),
  );
  const [baseline, setBaseline] = useState<PromptPayload>(() =>
    getInitialPromptFormData(prompt, initialType, catalogItems),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fileError, setFileError] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<PromptFile[]>(prompt?.files || []);
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);
  const [fileToUnlink, setFileToUnlink] = useState<PromptFile | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const userTemplateRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typeListId = useId();
  const toast = useToast();

  const activePrompt = persistedPrompt ?? prompt;
  const promptTypeOptions = getPromptTypeOptions(catalogItems);
  const selectedCatalogItem = getCatalogItemForType(catalogItems, formData.type);
  const selectedPromptType = getPromptTypeOption(formData.type, catalogItems);
  const normalizedExam = normalizePromptExamForCatalogType(catalogItems, formData.type, formData.exam);
  const defaultSystemPrompt = selectedCatalogItem?.defaultText ?? '';
  const defaultUserTemplate = selectedCatalogItem?.defaultUserTemplate ?? '';
  const defaultSchemaReference = serializePromptSchema(selectedCatalogItem?.defaultEnforcedSchema);
  const supportsVariableTemplate = selectedPromptType.variables.length > 0;
  const showUserTemplateEditor =
    supportsVariableTemplate ||
    Boolean(formData.userTemplate?.trim()) ||
    Boolean(defaultUserTemplate.trim());
  const shouldShowSchemaEditor =
    Boolean(formData.enforcedSchema?.trim()) ||
    Boolean(defaultSchemaReference.trim());
  const systemPromptHint = selectedPromptType.description || 'Primary system instruction for this prompt type.';

  const isDirty = useMemo(
    () => getFormSnapshot(formData, catalogItems) !== getFormSnapshot(baseline, catalogItems),
    [baseline, catalogItems, formData],
  );
  useUnsavedChanges(isDirty);

  const schemaError = useMemo(() => {
    const value = (formData.enforcedSchema || '').trim();
    if (!value) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (error) {
      return error instanceof Error ? `Not valid JSON: ${error.message}` : 'Not valid JSON.';
    }
  }, [formData.enforcedSchema]);

  useEffect(() => {
    const nextFormData = getInitialPromptFormData(prompt, initialType, catalogItems);

    setPersistedPrompt(prompt);
    setFormData(nextFormData);
    setBaseline(nextFormData);
    setErrorMsg('');
    setFileError('');
    setHasChanges(false);
    setAttachedFiles(prompt?.files || []);
  }, [prompt, initialType, catalogItems]);

  const handleChange = (field: keyof PromptPayload, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errorMsg) {
      setErrorMsg('');
    }
  };

  const handleTypeChange = (nextType: string) => {
    setFormData(prev => ({
      ...prev,
      type: nextType,
      exam: normalizePromptExamForCatalogType(catalogItems, nextType, prev.exam),
    }));

    if (errorMsg) {
      setErrorMsg('');
    }
  };

  const handleInsertVariable = (token: string) => {
    const textarea = userTemplateRef.current;
    const currentValue = formData.userTemplate || '';
    const selectionStart = textarea?.selectionStart ?? currentValue.length;
    const selectionEnd = textarea?.selectionEnd ?? currentValue.length;
    const nextValue = `${currentValue.slice(0, selectionStart)}${token}${currentValue.slice(selectionEnd)}`;

    setFormData(prev => ({
      ...prev,
      userTemplate: nextValue,
    }));

    requestAnimationFrame(() => {
      if (!textarea) {
        return;
      }

      const cursorPosition = selectionStart + token.length;
      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleDiscard = () => {
    setFormData(baseline);
    setErrorMsg('');
  };

  const requestClose = () => {
    if (isLoading) {
      return;
    }
    if (isDirty) {
      setIsConfirmingLeave(true);
      return;
    }
    onClose(hasChanges);
  };

  const handleSave = async () => {
    const trimmedType = formData.type.trim();

    if (!trimmedType) {
      setErrorMsg('Provide a prompt type.');
      return;
    }

    if (!formData.text.trim() && !(formData.userTemplate || '').trim()) {
      setErrorMsg('Provide a system instruction, a variable template, or both.');
      return;
    }

    if ((formData.enforcedSchema || '').trim()) {
      try {
        JSON.parse(formData.enforcedSchema || '');
      } catch {
        setErrorMsg('Response schema must be valid JSON.');
        return;
      }
    }

    const normalizedType = trimmedType;
    const normalizedTargetExam = normalizePromptExamForCatalogType(catalogItems, normalizedType, formData.exam);
    const currentPromptId = activePrompt?.id;
    const isDuplicate = existingPrompts.some(existingPrompt =>
      existingPrompt.type === normalizedType &&
      normalizePromptExamForCatalogType(catalogItems, existingPrompt.type, existingPrompt.exam) === normalizedTargetExam &&
      existingPrompt.id !== currentPromptId,
    );

    if (isDuplicate) {
      const targetScope = selectedPromptType.requiresExam ? normalizedTargetExam : 'the global scope';
      setErrorMsg(`A prompt for ${selectedPromptType.label} in ${targetScope} already exists.`);
      return;
    }

    const wasExistingPrompt = Boolean(currentPromptId);

    setIsLoading(true);
    setErrorMsg('');
    try {
      const upsertedPrompt = await testsService.upsertPrompt({
        ...formData,
        type: normalizedType,
        exam: normalizedTargetExam,
        enforcedSchema: formData.enforcedSchema?.trim() || undefined,
      });
      const storedPrompt = await testsService.getPrompt(upsertedPrompt.id);

      if (prompt?.id) {
        onClose(true);
        return;
      }

      const storedFormData = getInitialPromptFormData(storedPrompt, storedPrompt.type, catalogItems);
      setPersistedPrompt(storedPrompt);
      setFormData(storedFormData);
      setBaseline(storedFormData);
      setAttachedFiles(storedPrompt.files || []);
      setHasChanges(true);
      toast.show(
        wasExistingPrompt
          ? 'Prompt updated. Context files remain available below.'
          : 'Prompt created. You can now link context files below.',
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save prompt configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activePrompt?.id) {
      return;
    }

    setIsUploading(true);
    setFileError('');
    try {
      const uploadedFile = await testsService.uploadFile(file);
      await testsService.assignPromptContext(activePrompt.id, uploadedFile.id);

      setAttachedFiles(prev => {
        const nextFile = toPromptFile(uploadedFile);
        if (prev.some(existingFile => existingFile.id === nextFile.id)) {
          return prev;
        }
        return [...prev, nextFile];
      });
      setHasChanges(true);
      toast.show('Context file linked.');
    } catch (err: any) {
      console.error(err);
      setFileError(err.message || 'Failed to upload file and attach context.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    if (!activePrompt?.id) {
      return;
    }

    setFileError('');
    try {
      await testsService.removePromptContext(activePrompt.id, fileId);
      setAttachedFiles(prev => prev.filter(file => file.id !== fileId));
      setHasChanges(true);
      toast.show('Context file unlinked.');
    } catch (err: any) {
      console.error(err);
      setFileError(err.message || 'Failed to remove context file.');
    }
  };

  const confirmUnlink = async () => {
    if (!fileToUnlink) return;
    setIsUnlinking(true);
    try {
      await handleRemoveFile(fileToUnlink.id);
    } finally {
      setIsUnlinking(false);
      setFileToUnlink(null);
    }
  };

  const formatJsonSchema = () => {
    try {
      handleChange('enforcedSchema', JSON.stringify(JSON.parse(formData.enforcedSchema || ''), null, 2));
    } catch {
      // The field already shows the parse error.
    }
  };

  const scopeLabel = selectedPromptType.requiresExam ? normalizedExam : 'Global';
  const isCustomType = !selectedCatalogItem && Boolean(formData.type.trim());
  const updatedLabel = formatDate(activePrompt?.updatedAt || activePrompt?.createdAt);
  const builtInDefaults = [
    defaultSystemPrompt.trim() ? 'System instruction' : null,
    defaultUserTemplate.trim() ? 'Template' : null,
    defaultSchemaReference.trim() ? 'Response schema' : null,
  ].filter(Boolean) as string[];

  const renderVariableList = (compact: boolean) =>
    supportsVariableTemplate ? (
      <ul className={cn(compact ? 'flex flex-wrap gap-1.5' : 'divide-y divide-stone-100')}>
        {selectedPromptType.variables.map(variable => (
          <li key={variable.token}>
            <button
              type="button"
              onClick={() => handleInsertVariable(variable.token)}
              title={compact ? variable.description : undefined}
              className={cn(
                'text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                compact
                  ? 'rounded-md border border-stone-200 bg-white px-2 py-1 hover:border-stone-300 hover:bg-stone-50'
                  : 'block w-full px-4 py-2.5 hover:bg-stone-50',
              )}
            >
              <span className="sr-only">Insert </span>
              <code className="break-all font-mono text-xs font-medium text-brand-800">{variable.token}</code>
              {!compact && variable.description && (
                <span className="mt-0.5 block text-xs leading-5 text-stone-500">{variable.description}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div>
      <PageHeader
        eyebrow={
          <button
            type="button"
            onClick={requestClose}
            className="inline-flex items-center gap-1 rounded font-medium text-stone-500 transition-colors hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <ArrowLeft size={14} />
            AI prompts
          </button>
        }
        title={activePrompt ? selectedPromptType.label : 'New prompt'}
        meta={
          <>
            <Badge tone={getPromptScopeTone(scopeLabel)}>{displayPromptExam(scopeLabel)}</Badge>
            {isCustomType && <Badge tone="amber">Custom type</Badge>}
            {updatedLabel && <span className="text-[13px] text-stone-400">Updated {updatedLabel}</span>}
          </>
        }
        description={
          selectedCatalogItem?.description ||
          (activePrompt
            ? undefined
            : 'Override a built-in prompt for one feature, or add a prompt for a custom backend type.')
        }
      />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <SettingsCard
            title="Target"
            description="The feature this prompt drives and, for exam-specific types, the exam it applies to."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Prompt type"
                description="Choose a catalog type or enter a custom backend prompt type string."
              >
                {id => (
                  <>
                    <Input
                      id={id}
                      list={typeListId}
                      value={formData.type}
                      onChange={event => handleTypeChange(event.target.value)}
                      placeholder="Select or enter a prompt type"
                      className="font-mono"
                    />
                    <datalist id={typeListId}>
                      {promptTypeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <Field
                label="Exam"
                description={
                  selectedPromptType.requiresExam
                    ? 'Each exam can have its own prompt.'
                    : 'This prompt applies globally and does not require an exam target.'
                }
              >
                {id =>
                  selectedPromptType.requiresExam ? (
                    <Select
                      id={id}
                      value={normalizedExam}
                      onChange={event => handleChange('exam', event.target.value)}
                    >
                      {EXAM_OPTIONS.map(exam => (
                        <option key={exam} value={exam}>
                          {displayPromptExam(exam)}
                        </option>
                      ))}
                      {!EXAM_OPTIONS.includes(normalizedExam) && (
                        <option value={normalizedExam}>{normalizedExam}</option>
                      )}
                    </Select>
                  ) : (
                    <Input id={id} value="Global (all exams)" readOnly disabled />
                  )
                }
              </Field>
            </div>
          </SettingsCard>

          <SettingsCard
            title="System instruction"
            description={
              selectedCatalogItem?.description
                ? 'The primary instruction the model follows for this feature.'
                : systemPromptHint
            }
            meta={
              formData.text.trim() ? null : defaultSystemPrompt.trim() ? (
                <Badge>Using default</Badge>
              ) : null
            }
          >
            <Textarea
              aria-label="System instruction"
              value={formData.text}
              onChange={event => handleChange('text', event.target.value)}
              rows={12}
              placeholder={defaultSystemPrompt || 'You are…'}
              className={editorClass}
            />
            <p className="mt-1.5 flex flex-wrap justify-between gap-x-4 text-xs text-stone-500">
              <span>
                {defaultSystemPrompt.trim()
                  ? 'Leave empty to use the built-in default instruction.'
                  : 'No built-in default for this type.'}
              </span>
              <span className="tabular-nums">{plural(formData.text.length, 'character')}</span>
            </p>
            <DefaultReference
              title="Built-in default instruction"
              text={defaultSystemPrompt}
              onUse={formData.text.trim() ? undefined : () => handleChange('text', defaultSystemPrompt)}
            />
          </SettingsCard>

          {showUserTemplateEditor && (
            <SettingsCard
              title="User message template"
              description="The runtime message sent with each request. Variables are replaced with live values."
              meta={
                (formData.userTemplate || '').trim() ? null : defaultUserTemplate.trim() ? (
                  <Badge>Using default</Badge>
                ) : null
              }
            >
              {supportsVariableTemplate ? (
                <div className="mb-3 lg:hidden">
                  <p className="mb-2 text-xs text-stone-500">Tap a variable to insert it at the cursor.</p>
                  {renderVariableList(true)}
                </div>
              ) : (
                <p className="mb-3 text-xs text-stone-500">
                  This prompt type does not expose predefined template variables.
                </p>
              )}
              <Textarea
                ref={userTemplateRef}
                aria-label="User message template"
                value={formData.userTemplate || ''}
                onChange={event => handleChange('userTemplate', event.target.value)}
                rows={supportsVariableTemplate ? 14 : 10}
                placeholder={defaultUserTemplate}
                className={editorClass}
              />
              <p className="mt-1.5 flex flex-wrap justify-between gap-x-4 text-xs text-stone-500">
                <span>
                  {defaultUserTemplate.trim()
                    ? 'Leave empty to use the built-in default template.'
                    : 'Optional when a system instruction is set.'}
                </span>
                <span className="tabular-nums">
                  {plural((formData.userTemplate || '').length, 'character')}
                </span>
              </p>
              <DefaultReference
                title="Built-in default template"
                text={defaultUserTemplate}
                onUse={
                  (formData.userTemplate || '').trim()
                    ? undefined
                    : () => handleChange('userTemplate', defaultUserTemplate)
                }
              />
            </SettingsCard>
          )}

          {shouldShowSchemaEditor && (
            <SettingsCard
              title="Response schema"
              description="JSON the model's output must follow. Stored as a string on save and returned as JSON when read."
              meta={
                (formData.enforcedSchema || '').trim() ? null : defaultSchemaReference.trim() ? (
                  <Badge>Using default</Badge>
                ) : null
              }
              actions={
                (formData.enforcedSchema || '').trim() && !schemaError ? (
                  <Button size="sm" variant="ghost" onClick={formatJsonSchema}>
                    Format JSON
                  </Button>
                ) : null
              }
            >
              <Textarea
                aria-label="Response schema"
                aria-invalid={Boolean(schemaError) || undefined}
                value={formData.enforcedSchema || ''}
                onChange={event => handleChange('enforcedSchema', event.target.value)}
                rows={10}
                placeholder={defaultSchemaReference}
                className={cn(editorClass, schemaError && 'border-red-300')}
              />
              {schemaError ? (
                <p className="mt-1.5 text-xs text-red-600">{schemaError}</p>
              ) : (
                <p className="mt-1.5 text-xs text-stone-500">
                  Provide valid JSON when overriding it; leave empty to use the built-in default.
                </p>
              )}
              <DefaultReference
                title="Built-in default schema"
                text={defaultSchemaReference}
                onUse={
                  (formData.enforcedSchema || '').trim()
                    ? undefined
                    : () => handleChange('enforcedSchema', defaultSchemaReference)
                }
              />
            </SettingsCard>
          )}

          <SettingsCard
            title="Context files"
            meta={
              activePrompt?.id && attachedFiles.length > 0 ? (
                <span className="text-[13px] tabular-nums text-stone-500">{attachedFiles.length}</span>
              ) : null
            }
            description="Optional source material linked to this prompt: TXT, MD, JSON, PDF or CSV."
            actions={
              activePrompt?.id ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".txt,.md,.json,.pdf,.csv"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <Button
                    size="sm"
                    icon={FilePlus}
                    loading={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? 'Uploading…' : 'Link file'}
                  </Button>
                </>
              ) : null
            }
            bodyClassName="p-0"
          >
            {fileError && (
              <div className="px-5 pt-4">
                <InlineAlert onDismiss={() => setFileError('')}>{fileError}</InlineAlert>
              </div>
            )}
            {!activePrompt?.id ? (
              <EmptyState
                compact
                icon={Lock}
                title="Save this prompt first"
                description="Context files attach to a saved prompt, so linking unlocks once it's created."
              />
            ) : attachedFiles.length === 0 ? (
              <EmptyState
                compact
                icon={FileText}
                title="No context files linked yet"
                description="Link a file when the model needs reference material for this prompt."
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {attachedFiles.map(file => {
                  const name = file.name || 'document_context.txt';
                  const meta = [formatFileSize(file.size), formatDate(file.created) && `Linked ${formatDate(file.created)}`]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <li key={file.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                        <FileText size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-stone-900" title={name}>
                          {name}
                        </span>
                        {meta && <span className="block text-xs text-stone-500">{meta}</span>}
                      </span>
                      <IconButton
                        icon={Trash2}
                        size="sm"
                        tone="danger"
                        label={`Unlink ${name}`}
                        onClick={() => setFileToUnlink(file)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsCard>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <section
            aria-labelledby={`${typeListId}-variables`}
            className="hidden rounded-xl border border-stone-200 bg-white shadow-card lg:block"
          >
            <div className="border-b border-stone-100 px-4 py-3">
              <h3 id={`${typeListId}-variables`} className="text-sm font-semibold text-stone-900">
                Variables
                {supportsVariableTemplate && (
                  <span className="ml-1.5 font-normal tabular-nums text-stone-400">
                    {selectedPromptType.variables.length}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-xs leading-5 text-stone-500">
                {supportsVariableTemplate
                  ? 'Click a variable to insert it at the cursor in the template.'
                  : 'This prompt type does not expose predefined template variables.'}
              </p>
            </div>
            {supportsVariableTemplate && (
              <div className="max-h-[calc(100dvh-24rem)] min-h-[8rem] overflow-y-auto custom-scrollbar">
                {renderVariableList(false)}
              </div>
            )}
          </section>

          <section
            aria-labelledby={`${typeListId}-about`}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-card"
          >
            <h3 id={`${typeListId}-about`} className="text-sm font-semibold text-stone-900">
              About this type
            </h3>
            <dl className="mt-2 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Type</dt>
                <dd className="min-w-0 break-all text-right font-mono text-stone-700">
                  {formData.type.trim() || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Scope</dt>
                <dd className="text-stone-700">
                  {selectedPromptType.requiresExam ? 'Exam required' : 'Global'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Source</dt>
                <dd className="text-stone-700">
                  {selectedCatalogItem ? 'Catalog backed' : isCustomType ? 'Custom type' : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">Built-in defaults</dt>
                <dd className="text-right text-stone-700">
                  {builtInDefaults.length > 0 ? builtInDefaults.join(', ') : 'None'}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <SaveBar
        dirty={isDirty}
        saving={isLoading}
        onDiscard={handleDiscard}
        onSave={() => void handleSave()}
        saveLabel={activePrompt ? 'Update prompt' : 'Create prompt'}
        canSave={activePrompt ? isDirty : true}
        cleanText={activePrompt ? 'No unsaved changes.' : 'Fill in the prompt, then create it.'}
        error={errorMsg || null}
      />

      <ConfirmDialog
        open={isConfirmingLeave}
        title="Discard unsaved changes?"
        description="Your edits to this prompt haven't been saved and will be lost."
        confirmLabel="Discard changes"
        onConfirm={() => {
          setIsConfirmingLeave(false);
          onClose(hasChanges);
        }}
        onCancel={() => setIsConfirmingLeave(false)}
      />

      <ConfirmDialog
        open={Boolean(fileToUnlink)}
        title="Unlink context file?"
        description={
          <>
            <span className="font-medium text-stone-900">{fileToUnlink?.name || 'This file'}</span> will
            no longer be used as context for this prompt.
          </>
        }
        confirmLabel="Unlink file"
        busy={isUnlinking}
        onConfirm={() => void confirmUnlink()}
        onCancel={() => setFileToUnlink(null)}
      />

      <Toast message={toast.message} onDismiss={toast.dismiss} />
    </div>
  );
};

export default PromptEditorPage;
