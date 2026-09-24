import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, Plus } from 'lucide-react';
import { testsService } from '@/services/testsService';
import { BackendApiItem, LearningObjective } from '@/types/TestsServiceTypes';
import { Button, Drawer, EmptyState, InlineAlert, Spinner, StatusDot, cn } from '@/components/ui';
import { MODALITIES, itemTitle } from '@/components/academy/course-workbench/ObjectiveItemsList';
import { plural } from '@/components/curriculum-workbench/HierarchyRows';

interface LinkedItemsPanelProps {
  objective: LearningObjective;
  onClose: () => void;
  onCreateNew?: (obj: LearningObjective, redirectTo?: string) => void;
}

const STATUS_META: Record<BackendApiItem['status'], { label: string; tone: 'green' | 'neutral' | 'amber' }> = {
  live: { label: 'Live', tone: 'green' },
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Pending review', tone: 'amber' },
};

const modalityByType = new Map(MODALITIES.map((modality) => [modality.type, modality] as const));

/** Items (MCQ, SAQ, flashcards, lectures) that assess one learning objective. */
const LinkedItemsPanel: React.FC<LinkedItemsPanelProps> = ({ objective, onClose, onCreateNew }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<BackendApiItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const redirectTo = `${location.pathname}${location.search}${location.hash}`;

  const navigateToItem = (questionId: string) => {
    const params = new URLSearchParams({
      questionId,
      redirect: redirectTo,
    });

    navigate(`/workbench?${params.toString()}`);
  };

  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await testsService.getItems(1, 200, undefined, undefined, undefined, objective.id);
        setItems(res.items || []);
      } catch (err) {
        console.error('Failed to fetch items:', err);
        setError('Failed to load items.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, [objective.id, reloadKey]);

  const renderBody = () => {
    if (isLoading) return <Spinner label="Loading linked items…" className="py-16" />;

    if (error) {
      return (
        <InlineAlert
          action={
            <Button size="sm" onClick={() => setReloadKey((key) => key + 1)}>
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
        <div className="rounded-xl border border-dashed border-stone-300">
          <EmptyState
            compact
            icon={ClipboardCheck}
            title="No linked items yet"
            description="Items written for this objective — MCQs, SAQs, flashcards and lectures — appear here."
          />
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border border-stone-200">
        <ul aria-label="Linked items" className="divide-y divide-stone-100">
          {items.map((item) => {
            const modality = modalityByType.get(item.type);
            const Icon = modality?.icon ?? ClipboardCheck;
            const status = STATUS_META[item.status] ?? { label: item.status, tone: 'neutral' as const };
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => navigateToItem(item.identifier)}
                  className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                >
                  <span
                    className={cn(
                      'mt-px flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border',
                      modality?.badge ?? 'border-stone-200 bg-stone-50 text-stone-500',
                    )}
                    aria-hidden="true"
                  >
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm leading-5 text-stone-800">{itemTitle(item)}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                      {modality?.label ?? item.type}
                      <StatusDot tone={status.tone}>{status.label}</StatusDot>
                      <span className="font-mono text-stone-400">{item.identifier || item.id.slice(0, 8)}</span>
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    className="mt-1.5 flex-shrink-0 text-stone-300 transition-colors group-hover:text-stone-500"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-xl"
      title="Linked items"
      description={
        isLoading
          ? 'Items that assess this objective'
          : `${plural(items.length, 'item')} · open one to edit it in the item workbench`
      }
      footer={
        <>
          <p className="min-w-0 flex-1 truncate text-[13px] text-stone-500">
            New items open in the item workbench
          </p>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {onCreateNew && (
            <Button variant="primary" icon={Plus} onClick={() => onCreateNew(objective, redirectTo)}>
              New item
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5 px-6 py-5">
        <div className="rounded-lg bg-stone-50 px-4 py-3">
          <p className="text-[13px] text-stone-500">Objective</p>
          <p className="mt-0.5 text-sm leading-6 text-stone-800">{objective.title}</p>
        </div>
        {renderBody()}
      </div>
    </Drawer>
  );
};

export default LinkedItemsPanel;
