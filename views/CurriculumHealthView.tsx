import React, { useState, useRef, useEffect } from 'react';
import { Activity, ChevronRight, Network } from 'lucide-react';
import { useCurriculum } from '../hooks/useCurriculum';
import Sidebar from '../components/curriculum/Sidebar';
import WorkbenchHeader from '../components/curriculum/WorkbenchHeader';
import TopicGrid from '../components/curriculum/TopicGrid';
import SubTopicGrid from '../components/curriculum/SubTopicGrid';
import ObjectiveList from '../components/curriculum/ObjectiveList';
import LinkedItemsPanel from '../components/curriculum/LinkedItemsPanel';
import ImportLearningObjectivesModal from '../components/curriculum/ImportLearningObjectivesModal';
import { LearningObjective, Taxonomy, View } from '../types';

interface CurriculumHealthViewProps {
  onNavigate?: (view: View, context?: Partial<Taxonomy> | null) => void;
}

const CurriculumHealthView: React.FC<CurriculumHealthViewProps> = ({ onNavigate }) => {
  const {
    curriculumData,
    activeSystem,
    activeTopic,
    activeSubTopic,
    activeSystemId,
    activeTopicId,
    activeSubTopicId,
    contentSearch,
    setContentSearch,
    bloomFilter,
    setBloomFilter,
    handleSystemSelect,
    handleTopicSelect,
    handleSubTopicSelect,
    updateObjective,
    deleteObjective,
    isLoading,
    areTopicsLoading,
    areSyndromesLoading,
    areObjectivesLoading,
    objectivesPage,
    objectivesTotal,
    objectivesLimit,
    setObjectivesPage,
    createOrganSystem,
    updateOrganSystem,
    deleteOrganSystem,
    createTopic,
    updateTopic,
    deleteTopic,
    createSubTopic,
    updateSubTopic,
    deleteSubTopic,
    // Step 2
    curriculumMode,
    handleModeChange,
    subjects,
    activeSubjectId,
    handleSubjectSelect,
    questionStats,
    allowedSystemIds,
    handleReset,
  } = useCurriculum();

  const [viewLinkedItems, setViewLinkedItems] = useState<LearningObjective | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTopicId, activeSubTopicId, activeSystemId, activeSubjectId]);

  const handleCreateLinkedItem = (obj: LearningObjective) => {
    const context: Partial<Taxonomy> | any = {
      questionId: 'new',
      organSystemId: activeSystemId,
      topicId: activeTopicId,
      syndromeId: activeSubTopicId,
      subTopicId: obj.subTopic,
      learningObjectiveId: obj.id,
      bloomLevel: obj.bloomLevel,
    };
    setViewLinkedItems(null);
    if (onNavigate) onNavigate('WORKBENCH', context);
  };

  // Derive active subject name for breadcrumbs
  const activeSubject = subjects.find(s => s.id === activeSubjectId);

  const renderBreadcrumbs = () => (
    <div className="flex items-center text-sm text-slate-500 mb-8 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
      {/* Step 2: show Subject breadcrumb */}
      {curriculumMode === 'step2' && activeSubject && (
        <>
          <span className="font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Activity size={16} className="text-[#1BD183]" />
            {activeSubject.title}
          </span>
          {activeSystemId && <ChevronRight size={14} className="mx-2 flex-shrink-0 text-slate-300" />}
        </>
      )}

      {activeSystemId && (
        <span
          className="font-black text-slate-900 uppercase tracking-wide cursor-pointer hover:text-[#1BD183] transition-colors flex items-center gap-2"
          onClick={() => { handleTopicSelect(null); handleSubTopicSelect(null); }}
        >
          <Activity size={16} className="text-[#1BA6D1]" />
          {activeSystem?.title}
        </span>
      )}

      {activeTopic && (
        <>
          <ChevronRight size={14} className="mx-2 flex-shrink-0 text-slate-300" />
          <span
            className={`font-bold uppercase tracking-wide cursor-pointer transition-colors ${
              activeSubTopicId
                ? 'text-slate-900 hover:text-[#1BD183]'
                : 'text-[#1BD183] bg-[#1BD183]/5 px-3 py-1 rounded-lg text-xs border border-[#1BD183]/10'
            }`}
            onClick={() => handleSubTopicSelect(null)}
          >
            {activeTopic.title}
          </span>
        </>
      )}

      {activeSubTopicId && (
        <>
          <ChevronRight size={14} className="mx-2 flex-shrink-0 text-slate-300" />
          <span className="font-bold text-[#1BD183] bg-[#1BD183]/5 px-3 py-1 rounded-lg text-xs uppercase tracking-wide border border-[#1BD183]/10 flex items-center gap-2">
            <Network size={12} />
            {activeSubTopic?.title}
          </span>
        </>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-slate-50 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1BD183]"></div>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-wide">Loading Curriculum...</p>
        </div>
      </div>
    );
  }

  const renderMainContent = () => {
    // Step 2 — no system selected yet
    if (curriculumMode === 'step2' && !activeSubjectId) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Activity size={40} className="mb-3 opacity-30" />
          <p className="text-xs font-black uppercase tracking-widest">Select a subject from the sidebar to get started</p>
        </div>
      );
    }

    if (curriculumMode === 'step2' && activeSubjectId && !activeSystemId) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Activity size={40} className="mb-3 opacity-30" />
          <p className="text-xs font-black uppercase tracking-widest">Select an organ system from the sidebar</p>
        </div>
      );
    }

    // Topic grid
    if (!activeTopicId || !activeTopic) {
      if (areTopicsLoading) {
        return (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1BD183] mb-4"></div>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Topics...</p>
          </div>
        );
      }
      return (
        <TopicGrid
          topics={activeSystem?.topics || []}
          onSelect={handleTopicSelect}
          searchTerm={contentSearch}
          onCreateTopic={(data) => createTopic(data.name, activeSystemId!)}
          onEdit={updateTopic}
          onDelete={deleteTopic}
          organSystems={curriculumData}
          currentSystemId={activeSystemId}
        />
      );
    }

    if (!activeSubTopic) {
      if (areSyndromesLoading) {
        return (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1BD183] mb-4"></div>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Syndromes...</p>
          </div>
        );
      }
      return (
        <SubTopicGrid
          topic={activeTopic!}
          onSelect={handleSubTopicSelect}
          onBack={() => handleTopicSelect(null)}
          searchTerm={contentSearch}
          onCreateSubTopic={(data) => createSubTopic(data.name, activeTopic!.id)}
          onEdit={updateSubTopic}
          onDelete={deleteSubTopic}
          organSystems={curriculumData}
          currentSystemId={activeSystemId}
        />
      );
    }

    return (
      <ObjectiveList
        topic={activeTopic!}
        subTopic={activeSubTopic}
        searchTerm={contentSearch}
        bloomFilter={bloomFilter}
        setBloomFilter={setBloomFilter}
        onBack={() => handleSubTopicSelect(null)}
        onEdit={updateObjective}
        onDelete={deleteObjective}
        onViewLinked={setViewLinkedItems}
        isLoading={areObjectivesLoading}
        currentPage={objectivesPage}
        totalItems={objectivesTotal}
        itemsPerPage={objectivesLimit}
        onPageChange={setObjectivesPage}
      />
    );
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-slate-50 overflow-hidden font-sans text-slate-900 rounded-[2rem] border border-slate-200 shadow-sm relative">
      <Sidebar
        systems={curriculumData}
        activeId={activeSystemId}
        onSelect={handleSystemSelect}
        onCreate={createOrganSystem}
        onEdit={updateOrganSystem}
        onDelete={deleteOrganSystem}
        mode={curriculumMode}
        onModeChange={handleModeChange}
        filteredSystemIds={curriculumMode === 'step2' ? allowedSystemIds : undefined}
        subjects={subjects}
        activeSubjectId={activeSubjectId}
        onSubjectChange={handleSubjectSelect}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/50 backdrop-blur-sm relative">
        <WorkbenchHeader
          onImport={() => setIsImportModalOpen(true)}
          onExport={() => console.log('export')}
          searchTerm={contentSearch}
          setSearch={setContentSearch}
          searchPlaceholder={
            !activeTopicId
              ? 'Filter Topics...'
              : !activeSubTopic
              ? 'Filter Subtopics...'
              : 'Search Objectives...'
          }
        />

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {renderBreadcrumbs()}
          {renderMainContent()}
        </div>
      </div>

      {viewLinkedItems && (
        <LinkedItemsPanel
          objective={viewLinkedItems}
          onClose={() => setViewLinkedItems(null)}
          onCreateNew={handleCreateLinkedItem}
        />
      )}

      <ImportLearningObjectivesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          // You could trigger a refresh of the curriculum here if needed
          handleReset();
        }}
      />
    </div>
  );
};

export default CurriculumHealthView;
