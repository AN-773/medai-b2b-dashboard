import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  MonitorPlay,
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

export const MODALITIES: ModalitySpec[] = [
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

export const itemTitle = (item: BackendApiItem) =>
  item.lecture?.title ||
  item.mcq?.stem ||
  item.saq?.question ||
  item.flashcard?.front ||
  'Untitled item';

interface ObjectiveItemsListProps {
  objectiveId: string;
  /** Bump to force a refetch (e.g. after an item is saved or an AI draft is accepted). */
  refreshSignal: number;
  onOpenItem: (item: BackendApiItem) => void;
}

/**
 * Inline list of a learning objective's live content items, grouped by modality.
 * Extracted from the former ObjectiveItemsDrawer so the per-objective content
 * workspace can render live items alongside AI drafts without a drawer.
 */
const ObjectiveItemsList: React.FC<ObjectiveItemsListProps> = ({
  objectiveId,
  refreshSignal,
  onOpenItem,
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 size={20} className="mb-2 animate-spin text-[#1BD183]" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Loading items…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-xs font-semibold text-rose-500">{error}</p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-xs font-medium text-slate-400">
        No live content on this objective yet. Author an item above or accept an
        AI draft to populate it.
      </p>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-5">
      {grouped.map(({ modality, items: group }) => {
        if (group.length === 0) return null;
        const Icon = modality.icon;
        return (
          <div key={modality.type} className="min-w-0 space-y-2">
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
                className="group flex w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3 text-left transition hover:border-emerald-200 hover:shadow-sm"
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
                  <span className="mt-0.5 flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate font-mono text-[10px] text-slate-400">
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
      })}
    </div>
  );
};

export default ObjectiveItemsList;
