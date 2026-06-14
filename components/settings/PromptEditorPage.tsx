import React, { useEffect, useRef, useState } from 'react';
import { Prompt, PromptCatalogItem, PromptFile, PromptPayload } from '../../types';
import { testsService } from '../../services/testsService';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FilePlus,
  Loader2,
  Save,
  Trash,
} from 'lucide-react';
import {
  getPromptTypeOption,
  getPromptTypeOptions,
  normalizePromptExam,
  serializePromptSchema,
} from './promptConfig';

interface PromptEditorPageProps {
  prompt: Prompt | null;
  initialType?: string | null;
  catalogItems: PromptCatalogItem[];
  existingPrompts: Prompt[];
  onClose: (didChange: boolean) => void;
}

type ReferencePanelKey = 'systemPrompt' | 'userTemplate' | 'variableGuide' | 'schema';
type SectionKey = 'setup' | 'systemPrompt' | 'userTemplate' | 'context';

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

const getDefaultOpenSections = (
  payload: PromptPayload,
  promptType = getPromptTypeOption(payload.type),
  defaultUserTemplate = '',
): Record<SectionKey, boolean> => {
  const shouldShowTemplateEditor =
    promptType.variables.length > 0 ||
    Boolean(payload.userTemplate?.trim()) ||
    Boolean(defaultUserTemplate.trim());

  return {
    setup: true,
    systemPrompt: !shouldShowTemplateEditor,
    userTemplate: shouldShowTemplateEditor,
    context: false,
  };
};

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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<PromptFile[]>(prompt?.files || []);
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [openReferences, setOpenReferences] = useState<Record<ReferencePanelKey, boolean>>({
    systemPrompt: false,
    userTemplate: false,
    variableGuide: false,
    schema: false,
  });
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    setup: true,
    systemPrompt: true,
    userTemplate: false,
    context: false,
  });
  const userTemplateRef = useRef<HTMLTextAreaElement | null>(null);

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
  const systemPromptLabel = 'System Instruction';
  const systemPromptHint = selectedPromptType.description || 'Primary system instruction for this prompt type.';

  useEffect(() => {
    const nextFormData = getInitialPromptFormData(prompt, initialType, catalogItems);
    const nextPromptType = getPromptTypeOption(nextFormData.type, catalogItems);
    const nextDefaultUserTemplate = getCatalogItemForType(catalogItems, nextFormData.type)?.defaultUserTemplate ?? '';

    setPersistedPrompt(prompt);
    setFormData(nextFormData);
    setErrorMsg('');
    setSuccessMsg('');
    setHasChanges(false);
    setAttachedFiles(prompt?.files || []);
    setOpenReferences({
      systemPrompt: false,
      userTemplate: false,
      variableGuide: false,
      schema: false,
    });
    setOpenSections(getDefaultOpenSections(nextFormData, nextPromptType, nextDefaultUserTemplate));
  }, [prompt, initialType, catalogItems]);

  const toggleReference = (key: ReferencePanelKey) => {
    setOpenReferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleSection = (key: SectionKey) => {
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getReferencePreview = (value: string) => {
    const firstMeaningfulLine = value
      .split('\n')
      .map(line => line.trim())
      .find(Boolean);

    if (!firstMeaningfulLine) {
      return 'Reference available';
    }

    return firstMeaningfulLine.length > 92
      ? `${firstMeaningfulLine.slice(0, 92)}...`
      : firstMeaningfulLine;
  };

  const renderReferenceToggle = (
    key: ReferencePanelKey,
    title: string,
    referenceText: string,
    previewText?: string,
  ) => {
    if (!referenceText.trim()) {
      return null;
    }

    const isOpen = openReferences[key];

    return (
      <div className="rounded-2xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => toggleReference(key)}
          className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50"
        >
          <ChevronDown
            size={15}
            className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</div>
            {!isOpen && (
              <div className="mt-1 truncate text-sm text-slate-600">
                {previewText || getReferencePreview(referenceText)}
              </div>
            )}
          </div>
          <span className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {isOpen ? 'Hide' : 'Show'}
          </span>
        </button>

        {isOpen && (
          <div className="border-t border-slate-200 px-3 py-3">
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 px-3 py-3 font-mono text-xs leading-5 text-slate-600">
              {referenceText}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (
    key: SectionKey,
    step: string,
    title: string,
    description: string,
    preview: string,
    children: React.ReactNode,
  ) => {
    const isOpen = openSections[key];

    return (
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_50px_-35px_rgba(15,23,42,0.35)]">
        <button
          type="button"
          onClick={() => toggleSection(key)}
          className="flex w-full items-start gap-4 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(255,255,255,1))] px-5 py-4 text-left transition-colors hover:bg-slate-50"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold uppercase tracking-[0.18em] text-white">
            {step}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
              </div>
              {!isOpen && (
                <div className="max-w-sm truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {preview}
                </div>
              )}
            </div>
          </div>
          <ChevronDown
            size={18}
            className={`mt-1 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && <div className="border-t border-slate-100 px-5 py-5">{children}</div>}
      </section>
    );
  };

  const handleChange = (field: keyof PromptPayload, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errorMsg) {
      setErrorMsg('');
    }
    if (successMsg) {
      setSuccessMsg('');
    }
  };

  const handleTypeChange = (nextType: string) => {
    const normalizedType = nextType;

    setFormData(prev => {
      const nextFormData = {
        ...prev,
        type: normalizedType,
        exam: normalizePromptExamForCatalogType(catalogItems, normalizedType, prev.exam),
      };

      const nextPromptType = getPromptTypeOption(normalizedType, catalogItems);
      const nextDefaultTemplate = getCatalogItemForType(catalogItems, normalizedType)?.defaultUserTemplate ?? '';

      setOpenSections(prevSections => ({
        ...prevSections,
        ...getDefaultOpenSections(nextFormData, nextPromptType, nextDefaultTemplate),
        context: prevSections.context,
      }));

      return nextFormData;
    });

    if (errorMsg) {
      setErrorMsg('');
    }
    if (successMsg) {
      setSuccessMsg('');
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
    setSuccessMsg('');
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

      setPersistedPrompt(storedPrompt);
      setFormData(getInitialPromptFormData(storedPrompt, storedPrompt.type, catalogItems));
      setAttachedFiles(storedPrompt.files || []);
      setHasChanges(true);
      setOpenSections(prev => ({
        ...prev,
        context: true,
      }));
      setSuccessMsg(
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
    setErrorMsg('');
    setSuccessMsg('');
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
      setSuccessMsg('Context file linked.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to upload file and attach context.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    if (!activePrompt?.id) {
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    try {
      await testsService.removePromptContext(activePrompt.id, fileId);
      setAttachedFiles(prev => prev.filter(file => file.id !== fileId));
      setHasChanges(true);
      setSuccessMsg('Context file unlinked.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to remove context file.');
    }
  };

  const scopeLabel = selectedPromptType.requiresExam ? normalizedExam : 'Global';
  const variableGuideText = selectedPromptType.variables
    .map(variable => `${variable.token}\n${variable.description}`)
    .join('\n\n');
  const systemPreview = formData.text.trim() || 'Using the built-in default instruction.';
  const templatePreview = (formData.userTemplate || '').trim() || 'Using the built-in default template.';
  const schemaPreview = (formData.enforcedSchema || '').trim() || 'Using the built-in default response schema.';
  const contextPreview = activePrompt?.id
    ? attachedFiles.length > 0
      ? `${attachedFiles.length} ${attachedFiles.length === 1 ? 'file' : 'files'} linked`
      : 'No files linked yet.'
    : 'Save this prompt first to enable file linking.';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-8">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_35%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onClose(hasChanges)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                <ArrowLeft size={14} />
                Back To Prompts
              </button>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                {activePrompt ? 'Edit Prompt' : 'Create Prompt'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Build the prompt from scope to instruction to runtime template, then attach context files after the prompt exists.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Current Scope</div>
                <div className="mt-1 text-sm font-semibold text-slate-800">{scopeLabel}</div>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Feature Type</div>
                <div className="mt-1 text-sm font-semibold text-slate-800">{selectedPromptType.label}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="space-y-4">
        {renderSection(
          'setup',
          '01',
          'Scope And Type',
          '',
          `${selectedPromptType.label} • ${scopeLabel}`,
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Target Exam</label>
                {selectedPromptType.requiresExam ? (
                  <select
                    value={normalizedExam}
                    onChange={event => handleChange('exam', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="STEP 1">Step 1</option>
                    <option value="STEP 2">Step 2</option>
                    <option value="STEP 3">Step 3</option>
                  </select>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    This prompt applies globally and does not require an exam target.
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Target Feature Type</label>
                <input
                  list="prompt-type-options"
                  value={formData.type}
                  onChange={event => handleTypeChange(event.target.value)}
                  placeholder="Select or enter a prompt type"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <datalist id="prompt-type-options">
                  {promptTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </datalist>
                <p className="mt-2 text-xs text-slate-500">
                  Choose a catalog-backed type or enter a custom backend prompt type string.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-800">{selectedPromptType.label}</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{selectedPromptType.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {selectedPromptType.requiresExam ? 'Exam Required' : 'Global'}
                </span>
                {selectedCatalogItem && (
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Catalog Backed
                  </span>
                )}
                {!selectedCatalogItem && formData.type.trim() && (
                  <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                    Custom Type
                  </span>
                )}
              </div>
            </div>
          </div>,
        )}

        {showUserTemplateEditor &&
          renderSection(
            'userTemplate',
            '02',
            'Template Editor',
            'Define the runtime message after the high-level instruction is set.',
            getReferencePreview(templatePreview),
            <div className="space-y-4">
              {supportsVariableTemplate ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Runtime Variables</div>
                      <p className="mt-1 text-xs text-slate-500">
                        Insert tokens inline and only open the guide when you need the full descriptions.
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {selectedPromptType.variables.length} available
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedPromptType.variables.map(variable => (
                      <button
                        key={variable.token}
                        type="button"
                        onClick={() => handleInsertVariable(variable.token)}
                        className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                      >
                        {variable.token}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3">
                    {renderReferenceToggle(
                      'variableGuide',
                      'Variable Guide',
                      variableGuideText,
                      `${selectedPromptType.variables.length} runtime variables`,
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  This prompt type does not expose predefined template variables.
                </div>
              )}

              <textarea
                ref={userTemplateRef}
                value={formData.userTemplate || ''}
                onChange={event => handleChange('userTemplate', event.target.value)}
                rows={supportsVariableTemplate ? 12 : 9}
                placeholder={defaultUserTemplate}
                className="w-full resize-y rounded-[24px] border border-slate-200 bg-white p-4 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              {renderReferenceToggle('userTemplate', 'Default Template Reference', defaultUserTemplate)}
            </div>,
          )}

        {renderSection(
          'systemPrompt',
          showUserTemplateEditor ? '03' : '02',
          systemPromptLabel,
          systemPromptHint,
          getReferencePreview(systemPreview),
          <div className="space-y-4">
            <textarea
              value={formData.text}
              onChange={event => handleChange('text', event.target.value)}
              rows={10}
              placeholder={defaultSystemPrompt}
              className="w-full resize-y rounded-[24px] border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {renderReferenceToggle('systemPrompt', `Default ${systemPromptLabel}`, defaultSystemPrompt)}

            {shouldShowSchemaEditor && (
              <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Response Schema</div>
                  <p className="mt-1 text-xs text-slate-500">
                    Stored as a string on upsert and returned as JSON on read endpoints. Provide valid JSON when overriding it.
                  </p>
                </div>

                <textarea
                  value={formData.enforcedSchema || ''}
                  onChange={event => handleChange('enforcedSchema', event.target.value)}
                  rows={10}
                  placeholder={defaultSchemaReference}
                  className="w-full resize-y rounded-[20px] border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                {renderReferenceToggle(
                  'schema',
                  'Default Response Schema',
                  defaultSchemaReference,
                  getReferencePreview(schemaPreview),
                )}
              </div>
            )}
          </div>,
        )}

        {renderSection(
          'context',
          showUserTemplateEditor ? '04' : '03',
          'Context Files',
          activePrompt?.id
            ? 'Link optional source material after the prompt itself is in place.'
            : 'This section unlocks after the prompt is saved for the first time.',
          contextPreview,
          activePrompt?.id ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">RAG Context</div>
                  <p className="mt-1 text-xs text-slate-500">
                    The assign endpoint expects the full uploaded file id, while removals use the file identifier from the path automatically.
                  </p>
                </div>

                <div>
                  <input
                    type="file"
                    id="context-upload"
                    className="hidden"
                    accept=".txt,.md,.json,.pdf,.csv"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="context-upload"
                    className={`flex cursor-pointer items-center gap-1.5 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition-colors ${
                      isUploading
                        ? 'border-slate-200 bg-slate-100 text-slate-400'
                        : 'border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <FilePlus size={14} />}
                    {isUploading ? 'Uploading...' : 'Link New File'}
                  </label>
                </div>
              </div>

              {attachedFiles.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No context files linked yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {attachedFiles.map(file => (
                    <li
                      key={file.id}
                      className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FilePlus size={16} className="shrink-0 text-slate-400" />
                        <span className="truncate text-sm font-medium text-slate-700">{file.name || 'document_context.txt'}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="rounded-md p-1.5 text-slate-400 opacity-0 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                        title="Unlink File"
                      >
                        <Trash size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <div className="text-sm font-semibold text-slate-700">Save this prompt first.</div>
              <p className="mt-2 text-sm text-slate-500">
                Context files are attached after the prompt exists, so this stays at the end of the flow.
              </p>
            </div>
          ),
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-500">Save after reviewing the sections from top to bottom.</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => onClose(hasChanges)}
            className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {activePrompt ? 'Update Prompt' : 'Create Prompt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptEditorPage;
