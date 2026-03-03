import React, { useState, useEffect } from 'react';
import { Prompt } from '../../types';
import { testsService } from '../../services/testsService';
import { 
  Plus, Search, Edit2, Trash2, BookOpen, 
  FileText, Loader2, RefreshCw 
} from 'lucide-react';
import PromptEditorModal from './PromptEditorModal';

const PromptManager: React.FC = () => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  const fetchPrompts = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const resp = await testsService.getPrompts();
      setPrompts(resp.items || []);
    } catch (err) {
      console.error('Failed to fetch prompts:', err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleEdit = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsEditorOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedPrompt(null);
    setIsEditorOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this prompt?')) return;
    try {
      await testsService.deletePrompt(id);
      fetchPrompts(); // Refresh
    } catch (err) {
      alert('Failed to delete prompt');
      console.error(err);
    }
  };

  const handleModalClose = (didChange: boolean) => {
    setIsEditorOpen(false);
    setSelectedPrompt(null);
    if (didChange) {
      fetchPrompts();
    }
  };

  const filteredPrompts = prompts.filter(p => 
    p.exam.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 font-['Inter']">
      
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold">Generative Prompts</h3>
          <p className="text-sm text-slate-500">
            Customize the system instructions provided to AI agents per exam and activity type.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
            />
          </div>
          
          <button
            onClick={fetchPrompts}
            className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            title="Refresh List"
          >
            <RefreshCw size={16} />
          </button>

          <button
            onClick={handleCreateNew}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            <Plus size={16} /> Add Prompt
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-auto border border-slate-200 rounded-xl relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
             <Loader2 className="animate-spin text-emerald-600" size={32} />
          </div>
        )}

        {isError && (
          <div className="p-8 text-center text-red-600">
            Failed to load prompts. Please try again.
          </div>
        )}

        {!isLoading && !isError && filteredPrompts.length === 0 && (
          <div className="p-12 text-center flex flex-col items-center text-slate-500">
            <BookOpen size={48} className="text-slate-200 mb-4" />
            <p className="font-medium text-lg text-slate-900">No Prompts Configured</p>
            <p className="text-sm mt-1 max-w-sm">
              Create specific prompt templates targeting exam and application types to control AI outputs.
            </p>
            <button
              onClick={handleCreateNew}
              className="mt-6 flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <Plus size={16} /> Create First Prompt
            </button>
          </div>
        )}

        {filteredPrompts.length > 0 && (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Target Exam</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Feature Type</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/3">Core Instruction</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Files</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPrompts.map((p) => {
                const isStep1 = p.exam.toLowerCase().includes('step 1');
                
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        isStep1 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}>
                        {p.exam}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        {p.type === 'Question' ? <FileText size={14} className="text-indigo-500"/> : <BookOpen size={14} className="text-amber-500"/>}
                        {p.type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-600 line-clamp-2 max-w-[250px]" title={p.text}>
                        {p.text}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        {p.files?.length || 0}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <button 
                        onClick={() => handleEdit(p)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors mr-1"
                        title="Edit Prompt"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id.split("/").pop() || '')}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Prompt"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isEditorOpen && (
        <PromptEditorModal 
          prompt={selectedPrompt} 
          existingPrompts={prompts}
          onClose={handleModalClose} 
        />
      )}
    </div>
  );
};

export default PromptManager;
