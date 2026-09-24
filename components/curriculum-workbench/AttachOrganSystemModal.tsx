import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Link2, Search } from 'lucide-react';
import { OrganSystem } from '../../types/TestsServiceTypes';
import { testsService } from '../../services/testsService';
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  InlineAlert,
  SearchInput,
  Spinner,
  cn,
} from '@/components/ui';
import { plural } from './HierarchyRows';

interface AttachOrganSystemModalProps {
  isOpen: boolean;
  /** Absolute curriculum id the organ systems will be attached to. */
  curriculumId: string | null;
  /** Organ system ids already linked to this curriculum (excluded from the picker). */
  linkedIds: string[];
  onClose: () => void;
  onAttach: (systems: { id: string; title: string }[]) => Promise<void>;
}

/** Pick existing organ systems and link them to the current curriculum. */
const AttachOrganSystemModal: React.FC<AttachOrganSystemModalProps> = ({
  isOpen,
  curriculumId,
  linkedIds,
  onClose,
  onAttach,
}) => {
  const [allSystems, setAllSystems] = useState<OrganSystem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setSelected({});
    setError(null);
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await testsService.getOrganSystems(1, 500);
        if (active) setAllSystems(res.items.filter((s) => !!s.title));
      } catch (err) {
        if (active) {
          console.error('Failed to load organ systems:', err);
          setError('Could not load organ systems.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [isOpen]);

  const linked = useMemo(() => new Set(linkedIds), [linkedIds]);

  const eligible = useMemo(
    () => allSystems.filter((s) => !linked.has(s.id) && s.curriculumId !== curriculumId),
    [allSystems, linked, curriculumId],
  );

  const attachable = useMemo(
    () => eligible.filter((s) => s.title.toLowerCase().includes(search.toLowerCase())),
    [eligible, search],
  );

  // Selections survive searching, so count and attach from the full eligible list.
  const picks = eligible.filter((s) => selected[s.id]);
  const selectedCount = picks.length;

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  const handleSubmit = async () => {
    if (picks.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onAttach(picks.map((s) => ({ id: s.id, title: s.title })));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach organ systems.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderList = () => {
    if (isLoading) return <Spinner label="Loading organ systems…" className="py-16" />;
    if (error && eligible.length === 0) return null;

    if (attachable.length === 0) {
      return search && eligible.length > 0 ? (
        <EmptyState
          compact
          icon={Search}
          title="No matching organ systems"
          description={`Nothing matches “${search.trim()}”.`}
          action={
            <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <EmptyState
          compact
          icon={Activity}
          title="Nothing to attach"
          description="Every organ system is already part of this curriculum."
        />
      );
    }

    return (
      <ul aria-label="Organ systems" className="divide-y divide-stone-100">
        {attachable.map((s) => {
          const isChecked = !!selected[s.id];
          const linkedElsewhere = !!s.curriculumId;
          return (
            <li key={s.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-6 py-2.5 transition-colors',
                  isChecked ? 'bg-brand-50/50' : 'hover:bg-stone-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => setSelected((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                  disabled={isSubmitting}
                  className="h-4 w-4 flex-shrink-0 rounded border-stone-300 accent-brand-600"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{s.title}</span>
                {linkedElsewhere && (
                  <Badge tone="amber" title="Attaching moves it to this curriculum">
                    Linked elsewhere
                  </Badge>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Drawer
      open={isOpen}
      onClose={handleClose}
      dismissible={!isSubmitting}
      width="max-w-lg"
      title="Attach organ systems"
      description="Link existing organ systems to this curriculum."
      toolbar={
        <div className="space-y-3 border-b border-stone-200 px-6 py-4">
          <InlineAlert tone="warning">
            An organ system belongs to one curriculum. Attaching one that’s linked elsewhere moves
            it here.
          </InlineAlert>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search organ systems"
          />
        </div>
      }
      footer={
        <>
          <p className="min-w-0 flex-1 truncate text-[13px] text-stone-500">
            {selectedCount > 0 ? `${plural(selectedCount, 'organ system')} selected` : 'Select organ systems to attach'}
          </p>
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Link2}
            onClick={() => void handleSubmit()}
            loading={isSubmitting}
            disabled={selectedCount === 0}
          >
            {selectedCount > 0 ? `Attach ${selectedCount.toLocaleString()}` : 'Attach'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="px-6 pt-4">
          <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>
        </div>
      )}
      <div className="py-2">{renderList()}</div>
    </Drawer>
  );
};

export default AttachOrganSystemModal;
