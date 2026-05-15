import React, {
  FormEvent,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { testsService } from '../services/testsService';
import type { Discipline } from '../types/TestsServiceTypes';

const LIST_LIMIT = 500;

const panelClass = 'rounded-[2rem] border border-slate-200 bg-white shadow-sm';
const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10';

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const getShortIdentifier = (identifier: string) =>
  identifier.split('/').filter(Boolean).pop() || identifier;

const DisciplinesView: React.FC = () => {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [totalDisciplines, setTotalDisciplines] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const loadDisciplines = async (options?: { background?: boolean }) => {
    const background = options?.background === true;

    if (background) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setLoadError(null);

    try {
      const response = await testsService.getDisciplines(1, LIST_LIMIT);
      const sortedItems = [...(response.items || [])].sort((left, right) =>
        left.title.localeCompare(right.title),
      );

      setDisciplines(sortedItems);
      setTotalDisciplines(response.total || sortedItems.length);
    } catch (error) {
      console.error('Failed to load disciplines:', error);
      setLoadError(
        getErrorMessage(error, 'Unable to load disciplines right now.'),
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDisciplines();
  }, []);

  const filteredDisciplines = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return disciplines;
    }

    return disciplines.filter((discipline) =>
      discipline.title.toLowerCase().includes(normalizedQuery),
    );
  }, [deferredSearchQuery, disciplines]);

  const resetMessages = () => {
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = newTitle.trim();

    if (!normalizedTitle) {
      setFormError('Discipline title is required.');
      setSuccessMessage(null);
      return;
    }

    setIsSaving(true);
    resetMessages();

    try {
      await testsService.upsertDiscipline(normalizedTitle);
      setNewTitle('');
      setSuccessMessage(`Created "${normalizedTitle}".`);
      await loadDisciplines({ background: true });
    } catch (error) {
      console.error('Failed to create discipline:', error);
      setFormError(
        getErrorMessage(error, 'Unable to create discipline right now.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const beginEdit = (discipline: Discipline) => {
    resetMessages();
    setEditingId(discipline.id);
    setEditingTitle(discipline.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleSaveEdit = async (discipline: Discipline) => {
    const normalizedTitle = editingTitle.trim();

    if (!normalizedTitle) {
      setFormError('Discipline title is required.');
      setSuccessMessage(null);
      return;
    }

    setIsSaving(true);
    resetMessages();

    try {
      await testsService.upsertDiscipline(normalizedTitle, discipline.id);
      setSuccessMessage(`Updated "${discipline.title}" to "${normalizedTitle}".`);
      cancelEdit();
      await loadDisciplines({ background: true });
    } catch (error) {
      console.error('Failed to update discipline:', error);
      setFormError(
        getErrorMessage(error, 'Unable to update discipline right now.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (discipline: Discipline) => {
    const confirmed = window.confirm(
      `Delete "${discipline.title}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(discipline.id);
    resetMessages();

    try {
      await testsService.deleteDiscipline(discipline.id);
      if (editingId === discipline.id) {
        cancelEdit();
      }
      setSuccessMessage(`Deleted "${discipline.title}".`);
      await loadDisciplines({ background: true });
    } catch (error) {
      console.error('Failed to delete discipline:', error);
      setFormError(
        getErrorMessage(error, 'Unable to delete discipline right now.'),
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 text-slate-900">
      <section className={`${panelClass} overflow-hidden`}>
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
             
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Discipline Management
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Create, rename, and retire the discipline taxonomy used across
                learning objectives and item metadata.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadDisciplines({ background: true })}
              disabled={isLoading || isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Add a discipline
              </p>
              <p className="mt-1 text-sm text-slate-500">
                New disciplines become available anywhere the taxonomy is used.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="discipline-title"
                className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500"
              >
                Title
              </label>
              <input
                id="discipline-title"
                type="text"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Pathology"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving && !editingId ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              Create Discipline
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3 xl:max-w-[420px] xl:justify-end">
            <div className="inline-flex items-baseline gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Total
              </p>
              <p className="text-xl font-black tracking-tight text-slate-900">
                {totalDisciplines}
              </p>
            </div>
            <div className="inline-flex items-baseline gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Showing
              </p>
              <p className="text-xl font-black tracking-tight text-slate-900">
                {filteredDisciplines.length}
              </p>
            </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Status
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isLoading
                      ? 'bg-slate-400'
                      : isRefreshing
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                />
                <p className="text-sm font-black tracking-tight text-slate-900">
                {isLoading ? 'Loading' : isRefreshing ? 'Refreshing' : 'Synced'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {(formError || successMessage || loadError || totalDisciplines > LIST_LIMIT) && (
        <div className="space-y-3">
          {formError && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-900">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm">{formError}</p>
            </div>
          )}

          {loadError && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-900">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm">{loadError}</p>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
              <Check size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm">{successMessage}</p>
            </div>
          )}

          {totalDisciplines > LIST_LIMIT && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p className="text-sm">
                Only the first {LIST_LIMIT} disciplines are loaded in this view.
                Increase the page size or add pagination if the taxonomy grows
                beyond that.
              </p>
            </div>
          )}
        </div>
      )}

      <section className={panelClass}>
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-bold text-slate-900">Current disciplines</p>
            <p className="mt-1 text-sm text-slate-500">
              Search, rename, or delete entries from the shared taxonomy.
            </p>
          </div>

          <div className="relative w-full max-w-md">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                startTransition(() => setSearchQuery(event.target.value))
              }
              placeholder="Search disciplines..."
              className={`${inputClass} pl-11`}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[280px] items-center justify-center px-6 py-10 text-slate-500">
            <div className="inline-flex items-center gap-3 rounded-2xl bg-slate-50 px-5 py-4 text-sm font-medium">
              <Loader2 size={18} className="animate-spin" />
              Loading disciplines...
            </div>
          </div>
        ) : filteredDisciplines.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-400">
              <BookOpen size={28} />
            </div>
            <p className="text-lg font-bold text-slate-900">
              {searchQuery.trim() ? 'No matching disciplines' : 'No disciplines yet'}
            </p>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              {searchQuery.trim()
                ? 'Try a different search term or clear the filter.'
                : 'Create the first discipline to start managing the taxonomy.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredDisciplines.map((discipline) => {
              const isEditing = editingId === discipline.id;
              const isDeleting = deletingId === discipline.id;
              const isRowBusy = isSaving || isDeleting;

              return (
                <div
                  key={discipline.id}
                  className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          className={inputClass}
                          autoFocus
                        />
                        <p className="text-xs text-slate-500">
                          ID:{' '}
                          <span className="font-mono">
                            {getShortIdentifier(discipline.id)}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="truncate text-base font-bold text-slate-900">
                          {discipline.title}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                            ID: {getShortIdentifier(discipline.id)}
                          </span>
                          <span>
                            Updated{' '}
                            {new Date(discipline.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(discipline)}
                          disabled={isRowBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSaving ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Check size={16} />
                          )}
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isRowBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <X size={16} />
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => beginEdit(discipline)}
                          disabled={isRowBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <PencilLine size={16} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(discipline)}
                          disabled={isRowBusy}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default DisciplinesView;
