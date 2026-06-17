import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  History,
  Loader2,
  Network,
  Search,
  Tag,
  Target,
  User,
} from 'lucide-react';
import {
  CurriculumVersion,
  CurriculumVersionDetailResponse,
  CurriculumVersionLearningObjectiveSnapshot,
  CurriculumVersionOrganSystemSnapshot,
  CurriculumVersionSyndromeSnapshot,
  CurriculumVersionTopicSnapshot,
} from '../../types/TestsServiceTypes';

interface VersionHistoryProps {
  versions: CurriculumVersion[];
  isLoadingVersions: boolean;
  selectedVersionNumber: number | null;
  selectedVersionDetail: CurriculumVersionDetailResponse | null;
  isLoadingVersionDetail: boolean;
  onSelectVersion: (version: number | null) => void;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const lastSegment = (uri: string): string => {
  if (!uri) return '—';
  const segments = uri.split('/').filter(Boolean);
  return segments.length ? segments[segments.length - 1] : uri;
};

const flattenSnapshotLearningObjectives = (
  detail: CurriculumVersionDetailResponse,
): CurriculumVersionLearningObjectiveSnapshot[] =>
  (detail.snapshot?.organSystems ?? []).flatMap((organSystem) =>
    (organSystem.topics ?? []).flatMap((topic) =>
      (topic.syndromes ?? []).flatMap(
        (syndrome) => syndrome.learningObjectives ?? [],
      ),
    ),
  );

interface SnapshotExplorerProps {
  detail: CurriculumVersionDetailResponse;
}

const matchesSearch = (value: string, search: string): boolean =>
  value.toLowerCase().includes(search.trim().toLowerCase());

const SnapshotCard: React.FC<{
  title: string;
  identifier?: string;
  icon: React.ElementType;
  countLabel?: string;
  onClick: () => void;
}> = ({ title, identifier, icon: Icon, countLabel, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group min-h-[190px] w-full text-left bg-white p-6 rounded-[1.75rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#1BD183] hover:-translate-y-0.5 transition-all"
  >
    <div className="flex items-start justify-between gap-4 mb-8">
      <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-[#1BD183] transition-colors">
        <Icon size={22} className="text-slate-400 group-hover:text-white" />
      </div>
      {countLabel && (
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
          {countLabel}
        </span>
      )}
    </div>
    <h3 className="font-black text-base text-slate-900 leading-tight line-clamp-2">
      {title}
    </h3>
    {identifier && (
      <p className="mt-3 inline-flex max-w-full font-mono text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md truncate">
        {identifier}
      </p>
    )}
  </button>
);

const SnapshotObjectiveList: React.FC<{
  topic: CurriculumVersionTopicSnapshot;
  syndrome: CurriculumVersionSyndromeSnapshot;
  organSystemTitle: string;
  search: string;
  onBack: () => void;
}> = ({ topic, syndrome, organSystemTitle, search, onBack }) => {
  const objectives = (syndrome.learningObjectives ?? []).filter((objective) =>
    matchesSearch(objective.title, search),
  );

  return (
    <div className="animate-in slide-in-from-right-8 duration-300 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={onBack}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-[1.2rem] transition-all shadow-sm group"
        >
          <ChevronLeft size={20} className="text-slate-400 group-hover:text-slate-900" />
        </button>
        <div className="min-w-0">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none truncate">
            {syndrome.title}
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="px-3 py-1 bg-emerald-50 rounded-lg text-[10px] font-black uppercase tracking-widest text-emerald-700">
              {topic.title}
            </span>
            <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">
              {organSystemTitle}
            </span>
            <span className="text-sm font-bold text-slate-400">
              {objectives.length} Objectives
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {objectives.map((objective) => (
          <div
            key={objective.id}
            className="flex items-start gap-5 p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm"
          >
            <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
              <Target size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {objective.exam && (
                  <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-sky-200 bg-sky-50 text-sky-700">
                    {objective.exam}
                  </span>
                )}
                {objective.source && (
                  <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200 bg-slate-50 text-slate-500">
                    {objective.source}
                  </span>
                )}
                {objective.identifier && (
                  <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                    {objective.identifier}
                  </span>
                )}
              </div>
              <p className="text-base text-slate-800 leading-relaxed font-medium">
                {objective.title}
              </p>
            </div>
          </div>
        ))}

        {objectives.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Filter size={24} className="mb-2 opacity-50" />
            <p className="text-xs font-black uppercase tracking-widest">No objectives found</p>
          </div>
        )}
      </div>
    </div>
  );
};

const SnapshotExplorer: React.FC<SnapshotExplorerProps> = ({ detail }) => {
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedSyndromeId, setSelectedSyndromeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSelectedSystemId(null);
    setSelectedTopicId(null);
    setSelectedSyndromeId(null);
    setSearch('');
  }, [detail.version.id, detail.version.version]);

  const organSystems = detail.snapshot?.organSystems ?? [];
  const selectedSystem = useMemo(
    () => organSystems.find((system) => system.id === selectedSystemId),
    [organSystems, selectedSystemId],
  );
  const selectedTopic = useMemo(
    () => selectedSystem?.topics?.find((topic) => topic.id === selectedTopicId),
    [selectedSystem, selectedTopicId],
  );
  const selectedSyndrome = useMemo(
    () => selectedTopic?.syndromes?.find((syndrome) => syndrome.id === selectedSyndromeId),
    [selectedTopic, selectedSyndromeId],
  );
  const learningObjectiveCount = flattenSnapshotLearningObjectives(detail).length;

  const handleSystemSelect = (system: CurriculumVersionOrganSystemSnapshot) => {
    setSelectedSystemId(system.id);
    setSelectedTopicId(null);
    setSelectedSyndromeId(null);
    setSearch('');
  };

  const handleTopicSelect = (topic: CurriculumVersionTopicSnapshot) => {
    setSelectedTopicId(topic.id);
    setSelectedSyndromeId(null);
    setSearch('');
  };

  const handleSyndromeSelect = (syndrome: CurriculumVersionSyndromeSnapshot) => {
    setSelectedSyndromeId(syndrome.id);
    setSearch('');
  };

  const visibleSystems = organSystems.filter((system) => matchesSearch(system.title, search));
  const visibleTopics = (selectedSystem?.topics ?? []).filter((topic) =>
    matchesSearch(topic.title, search),
  );
  const visibleSyndromes = (selectedTopic?.syndromes ?? []).filter((syndrome) =>
    matchesSearch(syndrome.title, search),
  );

  const searchPlaceholder = !selectedSystem
    ? 'Filter organ systems...'
    : !selectedTopic
    ? 'Filter topics...'
    : !selectedSyndrome
    ? 'Filter subtopics...'
    : 'Search objectives...';

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center text-sm text-slate-500 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide">
          {selectedSystem && (
            <button
              type="button"
              onClick={() => {
                setSelectedTopicId(null);
                setSelectedSyndromeId(null);
              }}
              className="font-black text-slate-900 uppercase tracking-wide hover:text-[#1BD183] transition-colors flex items-center gap-2"
            >
              <Activity size={16} className="text-[#1BA6D1]" />
              {selectedSystem.title}
            </button>
          )}
          {selectedTopic && (
            <>
              <ChevronRight size={14} className="mx-2 flex-shrink-0 text-slate-300" />
              <button
                type="button"
                onClick={() => setSelectedSyndromeId(null)}
                className={`font-bold uppercase tracking-wide transition-colors ${
                  selectedSyndrome
                    ? 'text-slate-900 hover:text-[#1BD183]'
                    : 'text-[#1BD183] bg-[#1BD183]/5 px-3 py-1 rounded-lg text-xs border border-[#1BD183]/10'
                }`}
              >
                {selectedTopic.title}
              </button>
            </>
          )}
          {selectedSyndrome && (
            <>
              <ChevronRight size={14} className="mx-2 flex-shrink-0 text-slate-300" />
              <span className="font-bold text-[#1BD183] bg-[#1BD183]/5 px-3 py-1 rounded-lg text-xs uppercase tracking-wide border border-[#1BD183]/10 flex items-center gap-2">
                <Network size={12} />
                {selectedSyndrome.title}
              </span>
            </>
          )}
          {!selectedSystem && (
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">
              Snapshot content
            </span>
          )}
        </div>

        <div className="relative w-full xl:w-80">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-700 pl-11 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1BD183] transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {!selectedSystem ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Select an Organ System
            </h2>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">
              {organSystems.length} systems · {learningObjectiveCount} objectives
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {visibleSystems.map((system) => (
              <SnapshotCard
                key={system.id}
                title={system.title}
                identifier={system.identifier}
                icon={Activity}
                countLabel={`${system.topics?.length ?? 0} topics`}
                onClick={() => handleSystemSelect(system)}
              />
            ))}
          </div>
        </div>
      ) : !selectedTopic ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-4 mb-8">
            <button
              type="button"
              onClick={() => setSelectedSystemId(null)}
              className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-[1.2rem] transition-all shadow-sm group"
            >
              <ChevronLeft size={20} className="text-slate-400 group-hover:text-slate-900" />
            </button>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                Select a Topic
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-1">{selectedSystem.title}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {visibleTopics.map((topic) => (
              <SnapshotCard
                key={topic.id}
                title={topic.title}
                identifier={topic.identifier}
                icon={FileText}
                countLabel={`${topic.syndromes?.length ?? 0} subtopics`}
                onClick={() => handleTopicSelect(topic)}
              />
            ))}
          </div>
        </div>
      ) : !selectedSyndrome ? (
        <div className="animate-in fade-in slide-in-from-right-8 duration-300">
          <div className="flex items-center gap-4 mb-8">
            <button
              type="button"
              onClick={() => setSelectedTopicId(null)}
              className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-[1.2rem] transition-all shadow-sm group"
            >
              <ChevronLeft size={20} className="text-slate-400 group-hover:text-slate-900" />
            </button>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                Select Specific Subtopic
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-1">{selectedTopic.title}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {visibleSyndromes.map((syndrome) => (
              <SnapshotCard
                key={syndrome.id}
                title={syndrome.title}
                identifier={syndrome.identifier}
                icon={Network}
                countLabel={`${syndrome.learningObjectives?.length ?? 0} objectives`}
                onClick={() => handleSyndromeSelect(syndrome)}
              />
            ))}
          </div>
        </div>
      ) : (
        <SnapshotObjectiveList
          topic={selectedTopic}
          syndrome={selectedSyndrome}
          organSystemTitle={selectedSystem.title}
          search={search}
          onBack={() => setSelectedSyndromeId(null)}
        />
      )}

      {((!selectedSystem && visibleSystems.length === 0) ||
        (selectedSystem && !selectedTopic && visibleTopics.length === 0) ||
        (selectedTopic && !selectedSyndrome && visibleSyndromes.length === 0)) && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Filter size={24} className="mb-2 opacity-50" />
          <p className="text-xs font-black uppercase tracking-widest">No snapshot content found</p>
        </div>
      )}
    </div>
  );
};

const VersionHistory: React.FC<VersionHistoryProps> = ({
  versions,
  isLoadingVersions,
  selectedVersionNumber,
  selectedVersionDetail,
  isLoadingVersionDetail,
  onSelectVersion,
}) => {
  // Snapshot detail view
  if (selectedVersionNumber) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => onSelectVersion(null)}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-[#1BD183] transition-colors"
        >
          <ChevronLeft size={16} /> Back to all versions
        </button>

        {isLoadingVersionDetail ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={22} className="animate-spin mb-3 text-[#1BD183]" />
            <p className="text-[10px] font-black uppercase tracking-widest">Loading snapshot…</p>
          </div>
        ) : !selectedVersionDetail ? (
          <div className="py-20 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
            Snapshot not found
          </div>
        ) : (
          <>
            <div className="bg-white rounded-[1.75rem] border border-slate-200 shadow-sm p-6">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#0f8f59] bg-[#1BD183]/10 border border-[#1BD183]/20 px-3 py-1.5 rounded-full">
                  <Tag size={13} /> Version {selectedVersionDetail.version.version}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                  <Clock size={13} /> {formatDate(selectedVersionDetail.version.publishedAt)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                  <User size={13} /> {lastSegment(selectedVersionDetail.version.publishedBy)}
                </span>
              </div>
              {selectedVersionDetail.version.summary ? (
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  {selectedVersionDetail.version.summary}
                </p>
              ) : (
                <p className="text-sm text-slate-400 font-medium italic">No release summary.</p>
              )}
            </div>

            <SnapshotExplorer detail={selectedVersionDetail} />
          </>
        )}
      </div>
    );
  }

  // Versions list
  if (isLoadingVersions) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 size={22} className="animate-spin mb-3 text-[#1BD183]" />
        <p className="text-[10px] font-black uppercase tracking-widest">Loading versions…</p>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-[1.75rem] border border-dashed border-slate-200">
        <History size={32} className="mb-3 opacity-30" />
        <p className="text-xs font-black uppercase tracking-widest">No published versions yet</p>
        <p className="text-[11px] font-medium mt-2 max-w-xs text-center">
          Publishing freezes the current working state into a versioned, immutable snapshot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <button
          key={v.id}
          onClick={() => onSelectVersion(v.version)}
          className="w-full text-left bg-white rounded-[1.5rem] border border-slate-200 shadow-sm p-5 hover:border-[#1BD183]/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex-shrink-0 inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-[#1BD183]/10 text-[#0f8f59] font-black text-sm">
                v{v.version}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900 group-hover:text-[#0f8f59] transition-colors">
                  {v.summary || `Version ${v.version}`}
                </p>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} /> {formatDate(v.publishedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User size={11} /> {lastSegment(v.publishedBy)}
                  </span>
                </p>
              </div>
            </div>
            <ChevronLeft
              size={16}
              className="rotate-180 text-slate-300 group-hover:text-[#1BD183] transition-colors flex-shrink-0"
            />
          </div>
        </button>
      ))}
    </div>
  );
};

export default VersionHistory;
