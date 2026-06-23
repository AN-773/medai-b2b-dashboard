import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Database,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  MonitorPlay,
  Plus,
  X,
} from 'lucide-react';
import { testsService } from '@/services/testsService';
import type { BackendApiItem } from '@/types/TestsServiceTypes';

export type ItemModality = 'mcq' | 'saq' | 'flashcard' | 'lecture';

interface ModalitySpec {
  type: ItemModality;
  label: string;
  plural: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge: string;
  create: string;
}

const MODALITIES: ModalitySpec[] = [
  {
    type: 'mcq',
    label: 'MCQ',
    plural: 'MCQs',
    icon: ClipboardCheck,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    create: 'hover:border-emerald-300 hover:text-emerald-700',
  },
  {
    type: 'saq',
    label: 'SAQ',
    plural: 'SAQs',
    icon: FileText,
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    create: 'hover:border-blue-300 hover:text-blue-700',
  },
  {
    type: 'flashcard',
    label: 'Flashcard',
    plural: 'Flashcards',
    icon: Layers,
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    create: 'hover:border-purple-300 hover:text-purple-700',
  },
  {
    type: 'lecture',
    label: 'Lecture',
    plural: 'Lectures',
    icon: MonitorPlay,
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    create: 'hover:border-amber-300 hover:text-amber-700',
  },
];

const STATUS_STYLES: Record<string, string> = {
  live: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-slate-100 text-slate-500 border-slate-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

const itemTitle = (item: BackendApiItem) =>
  item.lecture?.title ||
  item.mcq?.stem ||
  item.saq?.question ||
  item.flashcard?.front ||
  'Untitled item';

interface ObjectiveItemsDrawerProps {
  objectiveId: string;
  objectiveTitle: string;
  /** Bump to force a refetch (e.g. after an item is saved). */
  refreshSignal: number;
  onCreate: (modality: ItemModality, objectiveId: string) => void;
  onOpenItem: (item: BackendApiItem) => void;
  onClose: () => void;
}

const ObjectiveItemsDrawer: React.FC<ObjectiveItemsDrawerProps> = ({
  objectiveId,
  objectiveTitle,
  refreshSignal,
  onCreate,
  onOpenItem,
  onClose,
}) => {
  const [items, setItems] = useState<BackendApiItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchItems = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await testsService.getItems(
          1,
          200,
          undefined,
          undefined,
          undefined,
          objectiveId,
        );
        if (!cancelled) setItems(response.items || []);
      } catch (fetchError) {
        console.error('Failed to fetch objective items:', fetchError);
        if (!cancelled) setError('Failed to load items for this objective.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchItems();
    return () => {
      cancelled = true;
    };
  }, [objectiveId, refreshSignal]);

  const grouped = useMemo(
    () =>
      MODALITIES.map((modality) => ({
        modality,
        items: items.filter((item) => item.type === modality.type),
      })),
    [items],
  );

  return (
    <>
      <div
        className="absolute inset-0 z-40 bg-slate-900/20 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div className="absolute right-4 top-4 bottom-4 z-50 flex w-[min(92vw,460px)] flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 p-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              <Database size={14} className="text-[#1BD183]" />
              Objective content
            </p>
            <p className="mt-2 line-clamp-2 text-sm font-bold text-slate-900">
              {objectiveTitle || 'Learning objective'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        {/* Create actions */}
        <div className="border-b border-slate-100 p-4">
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Author new
          </p>
          <div className="grid grid-cols-2 gap-2">
            {MODALITIES.map((modality) => {
              const Icon = modality.icon;
              return (
                <button
                  key={modality.type}
                  type="button"
                  onClick={() => onCreate(modality.type, objectiveId)}
                  className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-600 transition ${modality.create}`}
                >
                  <Plus size={13} />
                  <Icon size={14} />
                  {modality.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Item list */}
        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={20} className="mb-2 animate-spin text-[#1BD183]" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Loading items…
              </p>
            </div>
          ) : error ? (
            <p className="py-8 text-center text-xs font-semibold text-rose-500">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-xs font-medium text-slate-400">
              No content linked to this objective yet. Use the buttons above to
              author the first item.
            </p>
          ) : (
            grouped.map(({ modality, items: group }) => {
              if (group.length === 0) return null;
              const Icon = modality.icon;
              return (
                <div key={modality.type} className="space-y-2">
                  <h4 className="flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    <Icon size={12} /> {modality.plural}
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] leading-none text-slate-500">
                      {group.length}
                    </span>
                  </h4>
                  {group.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenItem(item)}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3 text-left transition hover:border-emerald-200 hover:shadow-sm"
                    >
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${modality.badge}`}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-800">
                          {itemTitle(item)}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">
                            {item.identifier || item.id.slice(0, 8)}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${STATUS_STYLES[item.status] || STATUS_STYLES.draft}`}
                          >
                            {item.status}
                          </span>
                        </span>
                      </span>
                      <ExternalLink
                        size={14}
                        className="flex-shrink-0 text-slate-300 transition group-hover:text-[#1BD183]"
                      />
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default ObjectiveItemsDrawer;
