import React, { useEffect, useRef, useState } from 'react';
import { Prompt, PromptPayload } from '../../types';
import { testsService } from '../../services/testsService';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  FilePlus,
  Loader2,
  Save,
  Sparkles,
  Trash,
} from 'lucide-react';
import {
  DEFAULT_PROMPT_EXAM,
  PROMPT_TYPE_OPTIONS,
  getSystemPromptPlaceholder,
  getPromptTypeOption,
  getUserTemplatePlaceholder,
  normalizePromptExamForType,
} from './promptConfig';

interface PromptEditorPageProps {
  prompt: Prompt | null;
  existingPrompts: Prompt[];
  onClose: (didChange: boolean) => void;
}

type ReferencePanelKey = 'systemPrompt' | 'userTemplate' | 'variableGuide';
type SectionKey = 'setup' | 'systemPrompt' | 'userTemplate' | 'context';

const getInitialPromptFormData = (prompt: Prompt | null): PromptPayload => {
  const type = prompt?.type || PROMPT_TYPE_OPTIONS[0].value;

  return {
    id: prompt?.id,
    exam: normalizePromptExamForType(type, prompt?.exam || DEFAULT_PROMPT_EXAM),
    type,
    text: prompt?.text || '',
    userTemplate: prompt?.userTemplate || '',
    enforcedSchema: prompt?.enforcedSchema || '',
  };
};

const getDefaultOpenSections = (payload: PromptPayload): Record<SectionKey, boolean> => {
  const promptType = getPromptTypeOption(payload.type);
  const shouldShowTemplateEditor = promptType.variables.length > 0 || Boolean(payload.userTemplate?.trim());

  return {
    setup: true,
    systemPrompt: !shouldShowTemplateEditor,
    userTemplate: shouldShowTemplateEditor,
    context: false,
  };
};

const PromptEditorPage: React.FC<PromptEditorPageProps> = ({ prompt, existingPrompts, onClose }) => {
  const [formData, setFormData] = useState<PromptPayload>(() => getInitialPromptFormData(prompt));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [attachedFiles, setAttachedFiles] = useState(prompt?.files || []);
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [openReferences, setOpenReferences] = useState<Record<ReferencePanelKey, boolean>>({
    systemPrompt: false,
    userTemplate: false,
    variableGuide: false,
  });
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    setup: true,
    systemPrompt: true,
    userTemplate: false,
    context: false,
  });
  const userTemplateRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedPromptType = getPromptTypeOption(formData.type);
  const normalizedExam = normalizePromptExamForType(formData.type, formData.exam);
  const systemPromptPlaceholder = getSystemPromptPlaceholder(formData.type, normalizedExam);
  const userTemplatePlaceholder = getUserTemplatePlaceholder(formData.type);
  const isStudyPlanFlow = selectedPromptType.value === 'study_plan' || selectedPromptType.value.startsWith('study_plan_');
  const supportsVariableTemplate = selectedPromptType.variables.length > 0;
  const showUserTemplateEditor = supportsVariableTemplate || Boolean(formData.userTemplate?.trim());
  const systemPromptLabel = isStudyPlanFlow ? 'Persona' : 'System Instruction';
  const systemPromptHint = selectedPromptType.value === 'study_plan'
    ? 'Shared system prompt for study-plan generation flows.'
    : selectedPromptType.value.startsWith('study_plan_')
      ? 'Optional override. If left blank, the shared study-plan base prompt will be used.'
      : 'Primary system instruction for this prompt type.';

  useEffect(() => {
    const nextFormData = getInitialPromptFormData(prompt);
    setFormData(nextFormData);
    setErrorMsg('');
    setHasChanges(false);
    setAttachedFiles(prompt?.files || []);
    setOpenReferences({
      systemPrompt: false,
      userTemplate: false,
      variableGuide: false,
    });
    setOpenSections(getDefaultOpenSections(nextFormData));
  }, [prompt]);

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
              <div className='flex flex-col align-middle h-100'>
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                {description && (
                  <p className="mt-1 text-sm text-slate-500">{description}</p>
                )}
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
  };

  const handleTypeChange = (nextType: string) => {
    setFormData(prev => {
      const nextFormData = {
        ...prev,
        type: nextType,
        exam: normalizePromptExamForType(nextType, prev.exam),
      };

      setOpenSections(prevSections => ({
        ...prevSections,
        ...getDefaultOpenSections(nextFormData),
        context: prevSections.context,
      }));

      return nextFormData;
    });
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
      if (!textarea) return;
      const cursorPosition = selectionStart + token.length;
      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleSave = async () => {
    if (!formData.text.trim() && !(formData.userTemplate || '').trim()) {
      setErrorMsg('Provide a system instruction, a variable template, or both.');
      return;
    }

    const isDuplicate = existingPrompts.some(p =>
      p.type === formData.type &&
      normalizePromptExamForType(p.type, p.exam) === normalizedExam &&
      p.id !== prompt?.id
    );

    if (isDuplicate) {
      const targetScope = selectedPromptType.requiresExam ? normalizedExam : 'the global scope';
      setErrorMsg(`A prompt for ${selectedPromptType.label} in ${targetScope} already exists.`);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      await testsService.upsertPrompt({
        ...formData,
        exam: normalizedExam,
      });
      onClose(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save prompt configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !prompt?.id) return;

    setIsUploading(true);
    try {
      const uploadedFile = await testsService.uploadFile(file);
      await testsService.assignPromptContext(prompt.id.split('/').pop() || '', uploadedFile.id);
      setAttachedFiles(prev => [...prev, { id: uploadedFile.id, name: file.name }]);
      setHasChanges(true);
    } catch (err: any) {
      console.error(err);
      alert('Failed to upload file and attach context');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    if (!prompt?.id) return;
    try {
      await testsService.removePromptContext(prompt.id.split('/').pop() || '', fileId.split('/').pop() || '');
      setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
      setHasChanges(true);
    } catch (err: any) {
      console.error(err);
      alert('Failed to remove context file');
    }
  };

  const scopeLabel = selectedPromptType.requiresExam ? normalizedExam : 'Global';
  const variableGuideText = selectedPromptType.variables
    .map(variable => `${variable.token}\n${variable.description}`)
    .join('\n\n');
  const systemPreview = formData.text.trim() || 'Using the built-in default instruction.';
  const templatePreview = (formData.userTemplate || '').trim() || 'Using the built-in default template.';
  const contextPreview = prompt?.id
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
                {prompt ? 'Edit Prompt' : 'Create Prompt'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Configure this prompt in order from scope to instruction to runtime template. References stay tucked away until you need them.
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
                    onChange={e => handleChange('exam', e.target.value)}
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
                <select
                  value={formData.type}
                  onChange={e => handleTypeChange(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {PROMPT_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>,
        )}

        {showUserTemplateEditor && renderSection(
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
              onChange={e => handleChange('userTemplate', e.target.value)}
              rows={supportsVariableTemplate ? 12 : 9}
              placeholder={userTemplatePlaceholder}
              className="w-full rounded-[24px] border border-slate-200 bg-white p-4 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
            />

            {renderReferenceToggle('userTemplate', 'Default Template Reference', userTemplatePlaceholder)}
          </div>,
        )}

        {renderSection(
          'systemPrompt',
          supportsVariableTemplate ? '03' : '02',
          systemPromptLabel,
          systemPromptHint,
          getReferencePreview(systemPreview),
          <div className="space-y-4">
            <textarea
              value={formData.text}
              onChange={e => handleChange('text', e.target.value)}
              rows={10}
              placeholder={systemPromptPlaceholder}
              className="w-full rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
            />
            {renderReferenceToggle('systemPrompt', `Default ${systemPromptLabel}`, systemPromptPlaceholder)}
          </div>,
        )}

        {renderSection(
          'context',
          showUserTemplateEditor ? '04' : '03',
          'Context Files',
          prompt?.id
            ? 'Link optional source material after the prompt itself is in place.'
            : 'This section unlocks after the prompt is saved for the first time.',
          contextPreview,
          prompt?.id ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">RAG Context</div>
                  <p className="mt-1 text-xs text-slate-500">
                    Keep documents separate from the prompt body so the instruction stays clean.
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
                  {attachedFiles.map(f => (
                    <li
                      key={f.id}
                      className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FilePlus size={16} className="shrink-0 text-slate-400" />
                        <span className="truncate text-sm font-medium text-slate-700">{f.name || 'document_context.txt'}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(f.id)}
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
        <p className="text-sm text-slate-500">
          Save after reviewing the sections from top to bottom.
        </p>
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
            {prompt ? 'Update Prompt' : 'Create Prompt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptEditorPage;
