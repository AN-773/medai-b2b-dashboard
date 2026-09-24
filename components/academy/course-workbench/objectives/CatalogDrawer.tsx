import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Plus, Search } from 'lucide-react';
import {
  Button,
  Drawer,
  EmptyState,
  SearchInput,
  Select,
  Spinner,
  cn,
} from '@/components/ui';
import { testsService } from '@/services/testsService';
import type { TeacherCourse, TeacherLearningObjective } from '@/types/AcademyStudioTypes';
import type {
  LearningObjective,
  OrganSystem,
  Syndrome,
  Topic,
} from '@/types/TestsServiceTypes';
import { ObjectiveMeta, PaginationFooter, revealTop } from './ListHelpers';

type SearchLearningObjective = LearningObjective & {
  source?: string;
  organSystem?: { title?: string } | null;
};

const normalizeSearchLearningObjective = (
  objective: SearchLearningObjective,
): TeacherLearningObjective => ({
  id: objective.id,
  title: objective.title,
  organSystem:
    objective.organSystem?.title ||
    objective.syndrome?.topic?.organSystem?.title ||
    undefined,
  cognitiveSkill: objective.cognitiveSkill?.title || undefined,
  source: objective.source === 'ai' ? 'ai' : 'manual',
  createdAt: objective.createdAt || new Date().toISOString(),
});

const CATALOG_PAGE_SIZE = 25;

export type CatalogAddAllFilters = {
  q?: string;
  organSystemId?: string;
  topicId?: string;
  syndromeId?: string;
};

export type CatalogAddAllResult = { matched: number; added: number; alreadyAttached: number };

interface CatalogDrawerProps {
  open: boolean;
  onClose: () => void;
  course: TeacherCourse;
  attachedIds: Set<string>;
  onAttach: (objective: TeacherLearningObjective) => Promise<void>;
  onAddAll: (filters: CatalogAddAllFilters) => Promise<CatalogAddAllResult>;
}

const plural = (count: number, noun: string) =>
  `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;

const describeAddAll = ({ matched, added, alreadyAttached }: CatalogAddAllResult) => {
  if (added === 0) {
    return matched > 0
      ? `All ${plural(matched, 'matching objective')} are already in this course.`
      : 'No objectives matched.';
  }
  const already = alreadyAttached > 0 ? ` · ${alreadyAttached.toLocaleString()} already in course` : '';
  return `Added ${plural(added, 'objective')}${already}`;
};

/** Browse the learning-objective catalog and attach objectives to the course. */
const CatalogDrawer: React.FC<CatalogDrawerProps> = ({
  open,
  onClose,
  course,
  attachedIds,
  onAttach,
  onAddAll,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TeacherLearningObjective[]>([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [isSearching, setSearching] = useState(false);
  const [isAddingAll, setIsAddingAll] = useState(false);
  const [addAllMessage, setAddAllMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);
  const [organSystems, setOrganSystems] = useState<OrganSystem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [syndromes, setSyndromes] = useState<Syndrome[]>([]);
  const [selectedOrganSystemId, setSelectedOrganSystemId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedSyndromeId, setSelectedSyndromeId] = useState('');
  const [isLoadingOrganSystems, setIsLoadingOrganSystems] = useState(false);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingSyndromes, setIsLoadingSyndromes] = useState(false);
  const listTopRef = useRef<HTMLDivElement | null>(null);

  const trimmedQuery = query.trim();
  const hasHierarchyFilter = Boolean(
    selectedOrganSystemId || selectedTopicId || selectedSyndromeId,
  );
  const shouldApplyQuery =
    trimmedQuery.length >= 2 || (hasHierarchyFilter && trimmedQuery.length > 0);
  const hasActiveCatalogInputs = hasHierarchyFilter || trimmedQuery.length >= 2;
  const hasAnyInput = hasHierarchyFilter || trimmedQuery.length > 0;
  const totalCatalogPages = Math.max(1, Math.ceil(resultsTotal / CATALOG_PAGE_SIZE));

  useEffect(() => {
    setQuery('');
    setResults([]);
    setResultsTotal(0);
    setCatalogPage(1);
    setSelectedOrganSystemId('');
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setTopics([]);
    setSyndromes([]);
    setSearching(false);
    setAddAllMessage(null);

    let cancelled = false;
    setIsLoadingOrganSystems(true);
    void testsService
      .getOrganSystems(1, 200, undefined, course.curriculumId || undefined)
      .then((response) => {
        if (cancelled) return;
        setOrganSystems(response.items || []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load catalog organ systems:', error);
        setOrganSystems([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingOrganSystems(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [course.id, course.curriculumId]);

  useEffect(() => {
    setCatalogPage(1);
    setAddAllMessage(null);
  }, [query, selectedOrganSystemId, selectedTopicId, selectedSyndromeId, course.id]);

  useEffect(() => {
    setCatalogPage((current) => Math.min(current, totalCatalogPages));
  }, [totalCatalogPages]);

  useEffect(() => {
    if (!hasActiveCatalogInputs) {
      setResults([]);
      setResultsTotal(0);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void testsService
        .listLearningObjectiveCatalog({
          page: catalogPage,
          limit: CATALOG_PAGE_SIZE,
          q: shouldApplyQuery ? trimmedQuery : undefined,
          curriculumId: course.curriculumId || undefined,
          organSystemId: selectedOrganSystemId || undefined,
          topicId: selectedTopicId || undefined,
          syndromeId: selectedSyndromeId || undefined,
        })
        .then((response) => {
          if (cancelled) return;
          setResults(
            response.items.map((objective) =>
              normalizeSearchLearningObjective(objective as SearchLearningObjective),
            ),
          );
          setResultsTotal(response.total || 0);
        })
        .catch((searchError) => {
          if (cancelled) return;
          console.error('Failed to search learning objectives:', searchError);
          setResults([]);
          setResultsTotal(0);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, trimmedQuery.length > 0 ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    catalogPage,
    catalogRefreshKey,
    course.curriculumId,
    hasActiveCatalogInputs,
    selectedOrganSystemId,
    selectedSyndromeId,
    selectedTopicId,
    shouldApplyQuery,
    trimmedQuery,
  ]);

  const handleOrganSystemChange = async (organSystemId: string) => {
    setSelectedOrganSystemId(organSystemId);
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setTopics([]);
    setSyndromes([]);
    if (!organSystemId) return;
    setIsLoadingTopics(true);
    try {
      const response = await testsService.getTopics(organSystemId, 1, 200);
      setTopics(response.items || []);
    } catch (error) {
      console.error('Failed to load catalog topics:', error);
      setTopics([]);
    } finally {
      setIsLoadingTopics(false);
    }
  };

  const handleTopicChange = async (topicId: string) => {
    setSelectedTopicId(topicId);
    setSelectedSyndromeId('');
    setSyndromes([]);
    if (!topicId) return;
    setIsLoadingSyndromes(true);
    try {
      const response = await testsService.getSyndromes(topicId, 1, 200);
      setSyndromes(response.items || []);
    } catch (error) {
      console.error('Failed to load catalog syndromes:', error);
      setSyndromes([]);
    } finally {
      setIsLoadingSyndromes(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedOrganSystemId('');
    setSelectedTopicId('');
    setSelectedSyndromeId('');
    setTopics([]);
    setSyndromes([]);
  };

  const handleAddAll = async () => {
    if (!hasActiveCatalogInputs || isAddingAll) return;
    setIsAddingAll(true);
    setAddAllMessage(null);
    try {
      const result = await onAddAll({
        q: shouldApplyQuery ? trimmedQuery : undefined,
        organSystemId: selectedOrganSystemId || undefined,
        topicId: selectedTopicId || undefined,
        syndromeId: selectedSyndromeId || undefined,
      });
      setAddAllMessage({ tone: 'success', text: describeAddAll(result) });
      setCatalogRefreshKey((current) => current + 1);
    } catch {
      // The host already reports the failure; keep a local hint in the footer.
      setAddAllMessage({ tone: 'error', text: 'Couldn’t add the matching objectives.' });
    } finally {
      setIsAddingAll(false);
    }
  };

  const handleAttach = async (objective: TeacherLearningObjective) => {
    setBusyIds((current) => new Set(current).add(objective.id));
    try {
      await onAttach(objective);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(objective.id);
        return next;
      });
    }
  };

  const changePage = (page: number) => {
    setCatalogPage(page);
    revealTop(listTopRef.current);
  };

  const canAddAll =
    hasActiveCatalogInputs && !isAddingAll && !isSearching && resultsTotal > 0;

  const renderStatus = () => {
    if (addAllMessage) {
      return (
        <span className={addAllMessage.tone === 'error' ? 'text-red-600' : 'text-brand-700'}>
          {addAllMessage.text}
        </span>
      );
    }
    if (isSearching) return 'Searching…';
    if (hasActiveCatalogInputs) return `${resultsTotal.toLocaleString()} matching`;
    return null;
  };

  const renderBody = () => {
    if (!hasActiveCatalogInputs) {
      return (
        <EmptyState
          compact
          icon={Search}
          title="Search the catalog"
          description="Choose an organ system, topic or syndrome, or type at least 2 characters to search the catalog."
        />
      );
    }
    if (results.length === 0) {
      return isSearching ? (
        <Spinner label="Searching…" className="py-16" />
      ) : (
        <EmptyState
          compact
          icon={Search}
          title="No matching objectives"
          description="No objectives matched the current catalog filters."
          action={
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      );
    }
    return (
      <>
        <ul
          aria-busy={isSearching}
          className={cn('divide-y divide-stone-100 transition-opacity', isSearching && 'opacity-60')}
        >
          {results.map((objective) => {
            const isAttached = attachedIds.has(objective.id);
            return (
              <li
                key={objective.id}
                className="flex items-start gap-4 px-6 py-3 transition-colors hover:bg-stone-50/70"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-stone-900">
                    {objective.title}
                  </p>
                  <ObjectiveMeta objective={objective} />
                </div>
                {isAttached ? (
                  <span className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-medium text-brand-700">
                    <Check size={14} aria-hidden="true" />
                    Added
                  </span>
                ) : (
                  <Button
                    size="sm"
                    icon={Plus}
                    loading={busyIds.has(objective.id)}
                    onClick={() => void handleAttach(objective)}
                    aria-label={`Add “${objective.title}” to the course`}
                  >
                    Add
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {totalCatalogPages > 1 && (
          <PaginationFooter
            className="border-t border-stone-100 px-6"
            page={catalogPage}
            pageSize={CATALOG_PAGE_SIZE}
            total={resultsTotal}
            onPageChange={changePage}
            disabled={isSearching}
          />
        )}
      </>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title="Add from catalog"
      description={
        course.curriculumId
          ? 'Scoped to this course’s curriculum.'
          : 'Showing the tenant-wide learning objective catalog.'
      }
      toolbar={
        <div className="space-y-2.5 border-b border-stone-200 px-6 py-3">
          <div className="flex items-center gap-2">
            <SearchInput
              className="flex-1"
              value={query}
              onChange={setQuery}
              placeholder="Search the catalog"
              aria-label="Search the learning objective catalog"
            />
            {hasAnyInput && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select
              aria-label="Organ system"
              value={selectedOrganSystemId}
              onChange={(event) => void handleOrganSystemChange(event.target.value)}
              disabled={isLoadingOrganSystems}
            >
              <option value="">
                {isLoadingOrganSystems ? 'Loading organ systems…' : 'All organ systems'}
              </option>
              {organSystems.map((organSystem) => (
                <option key={organSystem.id} value={organSystem.id}>
                  {organSystem.title}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Topic"
              value={selectedTopicId}
              onChange={(event) => void handleTopicChange(event.target.value)}
              disabled={!selectedOrganSystemId || isLoadingTopics}
            >
              <option value="">{isLoadingTopics ? 'Loading topics…' : 'All topics'}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Syndrome"
              value={selectedSyndromeId}
              onChange={(event) => setSelectedSyndromeId(event.target.value)}
              disabled={!selectedTopicId || isLoadingSyndromes}
            >
              <option value="">
                {isLoadingSyndromes ? 'Loading syndromes…' : 'All syndromes'}
              </option>
              {syndromes.map((syndrome) => (
                <option key={syndrome.id} value={syndrome.id}>
                  {syndrome.title}
                </option>
              ))}
            </Select>
          </div>
        </div>
      }
      footer={
        <>
          <p
            aria-live="polite"
            className="min-w-0 flex-1 truncate text-[13px] tabular-nums text-stone-500"
          >
            {renderStatus()}
          </p>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            icon={CheckCheck}
            loading={isAddingAll}
            disabled={!canAddAll}
            onClick={() => void handleAddAll()}
          >
            {hasActiveCatalogInputs && resultsTotal > 0
              ? `Add all ${resultsTotal.toLocaleString()} matching`
              : 'Add all matching'}
          </Button>
        </>
      }
    >
      <div ref={listTopRef}>{renderBody()}</div>
    </Drawer>
  );
};

export default CatalogDrawer;
