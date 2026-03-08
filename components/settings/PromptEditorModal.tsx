import React, { useState, useEffect } from 'react';
import { Prompt, PromptPayload } from '../../types';
import { testsService } from '../../services/testsService';
import { X, Save, AlertCircle, FilePlus, Loader2, Trash } from 'lucide-react';

interface PromptEditorModalProps {
  prompt: Prompt | null;
  existingPrompts: Prompt[];
  onClose: (didChange: boolean) => void;
}

const PromptEditorModal: React.FC<PromptEditorModalProps> = ({ prompt, existingPrompts, onClose }) => {
  const [formData, setFormData] = useState<PromptPayload>({
    exam: prompt?.exam || 'Step 1',
    type: prompt?.type || 'Question',
    text: prompt?.text || '',
    enforcedSchema: prompt?.enforcedSchema || '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // File Context state
  const [attachedFiles, setAttachedFiles] = useState(prompt?.files || []);
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state if prompt changes (unlikely in modal but good practice)
  useEffect(() => {
    if (prompt) {
      setFormData({
        id: prompt.id,
        exam: prompt.exam,
        type: prompt.type,
        text: prompt.text,
        enforcedSchema: prompt.enforcedSchema || '',
      });
      setAttachedFiles(prompt.files || []);
    }
  }, [prompt]);

  const handleChange = (field: keyof PromptPayload, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.text.trim()) {
      setErrorMsg('Prompt instruction text cannot be empty.');
      return;
    }

    // Ensure only one prompt per type and exam combination
    const isDuplicate = existingPrompts.some(p => 
      p.exam === formData.exam && 
      p.type === formData.type && 
      p.id !== prompt?.id
    );

    if (isDuplicate) {
      setErrorMsg(`A prompt for ${formData.exam} - ${formData.type} already exists.`);
      return;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    try {
      await testsService.upsertPrompt(formData);
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
              <select
                value={formData.exam}
                onChange={e => handleChange('exam', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="STEP 1">Step 1</option>
                <option value="STEP 2">Step 2</option>
                <option value="STEP 3">Step 3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Feature Type</label>
              <select
                value={formData.type}
                onChange={e => handleChange('type', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Question">Question Generation</option>
                <option value="Learning Objective">Learning Objective Generation</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex justify-between">
              <span>System Instruction (Main Prompt)</span>
              <span className="text-xs text-slate-500 font-normal">Supports markdown mapping</span>
            </label>
            <textarea
              value={formData.text}
              onChange={e => handleChange('text', e.target.value)}
              rows={8}
              placeholder="e.g., Act as an expert medical education faculty. Generate USMLE style questions..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
            />
          </div>


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
