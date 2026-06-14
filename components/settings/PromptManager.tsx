import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Prompt, PromptCatalogItem } from '../../types';
import { testsService } from '../../services/testsService';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  BookOpen,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import PromptEditorPage from './PromptEditorPage';
import {
  formatPromptExam,
  serializePromptSchema,
} from './promptConfig';

const buildCatalogSearchText = (item: PromptCatalogItem) => {
  const promptContent = item.configuredPrompts
    .flatMap(prompt => [
      prompt.exam,
      prompt.text,
      prompt.userTemplate || '',
      serializePromptSchema(prompt.enforcedSchema),
    ])
    .join(' ');

  return [
    item.type,
    item.label,
    item.description,
    item.defaultText || '',
    item.defaultUserTemplate || '',
    serializePromptSchema(item.defaultEnforcedSchema),
    promptContent,
  ]
    .join(' ')
    .toLowerCase();
};

const getDefaultBadges = (item: PromptCatalogItem) =>
  [
    item.defaultText ? 'System default' : null,
    item.defaultUserTemplate ? 'Template default' : null,
    item.defaultEnforcedSchema != null ? 'Schema default' : null,
  ].filter(Boolean) as string[];

const PromptManager: React.FC = () => {
  const [catalogItems, setCatalogItems] = useState<PromptCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const fetchPromptCatalog = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await testsService.getPromptCatalog();
      setCatalogItems(response.items || []);
    } catch (err: any) {
      console.error('Failed to fetch prompt catalog:', err);
      setErrorMsg(err.message || 'Failed to load prompt catalog.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromptCatalog();
  }, []);

  const allPrompts = useMemo(
    () => catalogItems.flatMap(item => item.configuredPrompts || []),
    [catalogItems],
  );

  const normalizedSearchTerm = deferredSearchTerm.trim().toLowerCase();
  const filteredCatalogItems = useMemo(() => {
    if (!normalizedSearchTerm) {
      return catalogItems;
    }

    return catalogItems.filter(item => buildCatalogSearchText(item).includes(normalizedSearchTerm));
  }, [catalogItems, normalizedSearchTerm]);

  const configuredTypeCount = useMemo(
    () => catalogItems.filter(item => item.configuredPrompts.length > 0).length,
    [catalogItems],
  );

  const handleEdit = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setSelectedType(null);
    setIsEditorOpen(true);
  };

  const handleCreate = (type?: string) => {
    setSelectedPrompt(null);
    setSelectedType(type || catalogItems[0]?.type || null);
    setIsEditorOpen(true);
  };

  const handleDelete = async (promptId: string) => {
    if (!window.confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    try {
      await testsService.deletePrompt(promptId);
      await fetchPromptCatalog();
    } catch (err: any) {
      console.error('Failed to delete prompt:', err);
      alert(err.message || 'Failed to delete prompt');
    }
  };

  const handleEditorClose = async (didChange: boolean) => {
    setIsEditorOpen(false);
    setSelectedPrompt(null);
    setSelectedType(null);

    if (didChange) {
      await fetchPromptCatalog();
    }
  };

  if (isEditorOpen) {
    return (
      <PromptEditorPage
        prompt={selectedPrompt}
        initialType={selectedType}
        catalogItems={catalogItems}
        existingPrompts={allPrompts}
        onClose={handleEditorClose}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-white font-['Inter'] text-slate-900">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-bold">Generative Prompts</h3>
            <p className="mt-1 text-sm text-slate-500">
              Manage saved prompt overrides and inspect the full backend catalog, including built-in types that are still using defaults.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:flex-row lg:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search prompt types, exams, or content..."
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
              />
            </div>

            <button
              onClick={fetchPromptCatalog}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50"
              title="Refresh Catalog"
            >
              <RefreshCw size={16} />
            </button>

            <button
              onClick={() => handleCreate()}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <Plus size={16} />
              Add Prompt
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Catalog Types</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{catalogItems.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Configured Prompts</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{allPrompts.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Using Built-In Defaults</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{catalogItems.length - configuredTypeCount}</div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto rounded-xl border border-slate-200">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <Loader2 className="animate-spin text-emerald-600" size={32} />
          </div>
        )}

        {errorMsg && !isLoading && (
          <div className="p-8 text-center text-red-600">{errorMsg}</div>
        )}

        {!isLoading && !errorMsg && filteredCatalogItems.length === 0 && (
          <div className="flex flex-col items-center p-12 text-center text-slate-500">
            <BookOpen size={48} className="mb-4 text-slate-200" />
            <p className="text-lg font-medium text-slate-900">No Matching Prompt Types</p>
            <p className="mt-1 max-w-md text-sm">
              Adjust the search term or create a custom prompt type directly from the editor.
            </p>
          </div>
        )}

        {!isLoading && !errorMsg && filteredCatalogItems.length > 0 && (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Feature Type</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Scope</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Configuration</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Built-In Defaults</th>
                <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Files</th>
                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCatalogItems.flatMap(item => {
                const configuredPrompts = item.configuredPrompts || [];
                const defaultBadges = getDefaultBadges(item);
                const canAddVariant = item.requiresExam && configuredPrompts.length < 3;
                const rows = configuredPrompts.length > 0 ? configuredPrompts : [null];

                return rows.map((prompt, index) => {
                  const examLabel = prompt ? formatPromptExam(item.requiresExam, prompt.exam) : item.requiresExam ? 'Exam-scoped' : 'Global';
                  const previewText = prompt
                    ? prompt.text || prompt.userTemplate || serializePromptSchema(prompt.enforcedSchema) || 'Saved override'
                    : item.defaultText || item.defaultUserTemplate || serializePromptSchema(item.defaultEnforcedSchema) || 'No built-in default defined';

                  return (
                    <tr key={prompt?.id || `${item.type}-empty`} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-600">
                            {item.requiresExam ? (
                              <FileText size={16} className="text-[#1BD183]" />
                            ) : (
                              <Sparkles size={16} className="text-amber-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800">{item.label || item.type}</span>
                              <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {item.type}
                              </span>
                            </div>
                            <p className="mt-1 max-w-md text-sm text-slate-500">{item.description}</p>
                            {index === 0 && canAddVariant && (
                              <button
                                type="button"
                                onClick={() => handleCreate(item.type)}
                                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                              >
                                <Plus size={12} />
                                Add Exam Variant
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            examLabel === 'Global'
                              ? 'border-slate-200 bg-slate-100 text-slate-700'
                              : examLabel === 'Exam-scoped'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : examLabel.toLowerCase().includes('step 1')
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-purple-200 bg-purple-50 text-purple-700'
                          }`}
                        >
                          {examLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {prompt ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Saved Override</div>
                            <p className="mt-1 max-w-md line-clamp-3 text-sm text-slate-600" title={previewText}>
                              {previewText}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Using Backend Defaults</div>
                            <p className="mt-1 max-w-md text-sm text-slate-500" title={previewText}>
                              {previewText}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        {defaultBadges.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {defaultBadges.map(badge => (
                              <span
                                key={badge}
                                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center align-top">
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {prompt?.files?.length || 0}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right align-top">
                        {prompt ? (
                          <>
                            <button
                              onClick={() => handleEdit(prompt)}
                              className="mr-1 rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                              title="Edit Prompt"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(prompt.id)}
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Delete Prompt"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleCreate(item.type)}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                          >
                            <Plus size={14} />
                            Configure
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PromptManager;
