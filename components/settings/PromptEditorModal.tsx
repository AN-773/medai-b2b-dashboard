import React, { useEffect, useRef, useState } from 'react';
import { Prompt, PromptPayload } from '../../types';
import { testsService } from '../../services/testsService';
import { X, Save, AlertCircle, FilePlus, Loader2, Trash } from 'lucide-react';
import {
  DEFAULT_PROMPT_EXAM,
  PROMPT_TYPE_OPTIONS,
  getSystemPromptPlaceholder,
  getPromptTypeOption,
  getUserTemplatePlaceholder,
  normalizePromptExamForType,
} from './promptConfig';

interface PromptEditorModalProps {
  prompt: Prompt | null;
  existingPrompts: Prompt[];
  onClose: (didChange: boolean) => void;
}

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

const PromptEditorModal: React.FC<PromptEditorModalProps> = ({ prompt, existingPrompts, onClose }) => {
  const [formData, setFormData] = useState<PromptPayload>(() => getInitialPromptFormData(prompt));

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // File Context state
  const [attachedFiles, setAttachedFiles] = useState(prompt?.files || []);
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const userTemplateRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedPromptType = getPromptTypeOption(formData.type);
  const normalizedExam = normalizePromptExamForType(formData.type, formData.exam);
  const systemPromptPlaceholder = getSystemPromptPlaceholder(formData.type, normalizedExam);
  const userTemplatePlaceholder = getUserTemplatePlaceholder(formData.type);
  const isStudyPlanFlow = selectedPromptType.value === 'study_plan' || selectedPromptType.value.startsWith('study_plan_');
  const isStudyPlanBasePrompt = selectedPromptType.value === 'study_plan';
  const supportsVariableTemplate = selectedPromptType.variables.length > 0;
  const showUserTemplateEditor = supportsVariableTemplate || Boolean(formData.userTemplate?.trim());
  const systemPromptLabel = isStudyPlanFlow ? 'Persona' : 'System Instruction';
  const systemPromptHint = selectedPromptType.value === 'study_plan'
    ? 'Shared system prompt for study-plan generation flows.'
    : selectedPromptType.value.startsWith('study_plan_')
      ? 'Optional override. If left blank, the shared study-plan base prompt will be used.'
      : 'Primary system instruction for this prompt type.';

  // Sync state if prompt changes (unlikely in modal but good practice)
  useEffect(() => {
    if (prompt) {
      setFormData(getInitialPromptFormData(prompt));
      setAttachedFiles(prompt.files || []);
    }
  }, [prompt]);

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
      exam: normalizePromptExamForType(nextType, prev.exam),
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

    // Ensure only one prompt per type and exam combination
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
    if (!file || !prompt?.id) return; // Must save prompt first before attaching

    setIsUploading(true);
    try {
      // 1. Upload file
      const uploadedFile = await testsService.uploadFile(file);
      // 2. Assign Context
      await testsService.assignPromptContext(prompt.id.split("/").pop() || "", uploadedFile.id);
      // Optimistically update
      setAttachedFiles(prev => [...prev, { id: uploadedFile.id, name: file.name }]);
      setHasChanges(true);
    } catch (err: any) {
      console.error(err);
      alert('Failed to upload file and attach context');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    if (!prompt?.id) return;
    try {
      await testsService.removePromptContext(prompt.id.split("/").pop() || "", fileId.split("/").pop() || "");
      setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
      setHasChanges(true);
    } catch (err: any) {
      console.error(err);
      alert('Failed to remove context file');
    }
  };

  const systemPromptEditor = (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex justify-between">
        <span>{systemPromptLabel}</span>
        <span className="text-xs text-slate-500 font-normal">{systemPromptHint}</span>
      </label>
      <textarea
        value={formData.text}
        onChange={e => handleChange('text', e.target.value)}
        rows={8}
        placeholder={systemPromptPlaceholder}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 font-['Inter'] backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">
            {prompt ? 'Edit Prompt Configuration' : 'Create New Prompt'}
          </h3>
          <button 
            onClick={() => onClose(hasChanges)} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-200">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Exam</label>
              {selectedPromptType.requiresExam ? (
                <select
                  value={normalizedExam}
                  onChange={e => handleChange('exam', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="STEP 1">Step 1</option>
                  <option value="STEP 2">Step 2</option>
                  <option value="STEP 3">Step 3</option>
                </select>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                  This prompt applies globally and does not require an exam target.
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Feature Type</label>
              <select
                value={formData.type}
                onChange={e => handleTypeChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {PROMPT_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500">{selectedPromptType.description}</p>
            </div>
          </div>

          {isStudyPlanBasePrompt && systemPromptEditor}

          {showUserTemplateEditor && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-4 space-y-3">
                <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Template Editor</label>
                    <p className="mt-1 text-xs text-slate-500">
                      Edit the runtime message and insert supported variables directly into the template.
                    </p>
                  </div>
                  
                </div>

                {supportsVariableTemplate ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Insert Variables
                      </span>
                      <span className="text-xs text-slate-500">
                        Click a token to add it at the cursor.
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500">
                    This prompt type does not expose predefined template variables.
                  </div>
                )}
              </div>

              <div className={supportsVariableTemplate ? 'grid lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]' : ''}>
                {supportsVariableTemplate && (
                  <div className="order-1 border-b border-slate-200 bg-white/70 px-4 py-4 lg:order-2 lg:border-b-0 lg:border-l">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-slate-800">Variable Guide</h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Reference the available runtime values while you edit.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {selectedPromptType.variables.map(variable => (
                        <div
                          key={`${variable.token}-description`}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div className="font-mono text-xs text-slate-800">{variable.token}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{variable.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={supportsVariableTemplate ? 'order-2 px-4 py-4 lg:order-1' : 'px-4 py-4'}>
                  <textarea
                    ref={userTemplateRef}
                    value={formData.userTemplate || ''}
                    onChange={e => handleChange('userTemplate', e.target.value)}
                    rows={supportsVariableTemplate ? 16 : 10}
                    placeholder={userTemplatePlaceholder}
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                  />
                </div>
              </div>
            </div>
          )}

          {!isStudyPlanBasePrompt && systemPromptEditor}


          {prompt && prompt.id && (
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-slate-700">Context Files (RAG Context)</label>
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
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                      isUploading ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <FilePlus size={14} />}
                    {isUploading ? 'Uploading...' : 'Link New File'}
                  </label>
                </div>
              </div>
              
              {attachedFiles.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-4 text-center text-sm text-slate-500">
                  No context files bound to this prompt.
                </div>
              ) : (
                <ul className="space-y-2">
                  {attachedFiles.map(f => (
                    <li key={f.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white group hover:border-slate-300 transition-colors">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FilePlus size={16} className="text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 truncate">{f.name || 'document_context.txt'}</span>
                      </div>
                      <button 
                        onClick={() => handleRemoveFile(f.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        title="Unlink File"
                      >
                        <Trash size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {!prompt?.id && (
            <div className="pt-4 border-t border-slate-200">
               <p className="text-sm text-slate-500 italic">Save this prompt to unlock context file linking.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={() => onClose(hasChanges)}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {prompt ? 'Update Prompt' : 'Create Prompt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptEditorModal;
