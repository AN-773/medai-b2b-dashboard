import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  ClipboardCheck,
  FileText,
  Layers,
  MonitorPlay,
  RefreshCw,
} from 'lucide-react';
import {
  Button,
  EmptyState,
  InlineAlert,
  Spinner,
  StatusDot,
  type BadgeTone,
} from '@/components/ui';
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

const STATUS_TONES: Record<string, BadgeTone> = {
  live: 'green',
  draft: 'neutral',
  pending: 'amber',
};

const statusLabel = (status: string) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft';

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
  // Local retry counter so a failed load can be retried without the host.
  const [retryTick, setRetryTick] = useState(0);

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
  }, [objectiveId, refreshSignal, retryTick]);

  const grouped = useMemo(
    () =>
      MODALITIES.map((modality) => ({
        modality,
        items: items.filter((item) => item.type === modality.type),
      })).filter((group) => group.items.length > 0),
    [items],
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border border-stone-200 py-10">
        <Spinner label="Loading items…" />
      </div>
    );
  }

  if (error) {
    return (
      <InlineAlert
        tone="error"
        action={
          <Button size="sm" icon={RefreshCw} onClick={() => setRetryTick((tick) => tick + 1)}>
            Retry
          </Button>
        }
      >
        {error}
      </InlineAlert>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200">
        <EmptyState
          compact
          icon={Layers}
          title="No items yet"
          description="Add an item above, or accept an AI draft to make it live on this objective."
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
      {grouped.map(({ modality, items: group }) => {
        const Icon = modality.icon;
        return (
          <div key={modality.type} className="min-w-0">
            <h5 className="flex items-center gap-2 border-b border-stone-100 bg-stone-50/70 px-4 py-2 text-[13px] font-medium text-stone-700">
              <Icon size={14} className="text-stone-500" />
              {modality.plural}
              <span className="tabular-nums text-stone-400">{group.length}</span>
            </h5>
            <ul className="divide-y divide-stone-100">
              {group.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpenItem(item)}
                    className="group flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm leading-5 text-stone-900">
                        {itemTitle(item)}
                      </span>
                      <span className="mt-1 block truncate font-mono text-xs text-stone-400">
                        {item.identifier || item.id.slice(0, 8)}
                      </span>
                    </span>
                    <StatusDot tone={STATUS_TONES[item.status] ?? 'neutral'}>
                      {statusLabel(item.status)}
                    </StatusDot>
                    <ChevronRight
                      size={16}
                      className="flex-shrink-0 text-stone-300 transition-colors group-hover:text-stone-500"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default ObjectiveItemsList;
