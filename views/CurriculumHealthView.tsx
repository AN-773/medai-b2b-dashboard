import React, { useState, useRef, useEffect } from 'react';
import { Activity, ChevronRight, Network } from 'lucide-react';
import { useCurriculum } from '../hooks/useCurriculum';
import Sidebar from '../components/curriculum/Sidebar';
import WorkbenchHeader from '../components/curriculum/WorkbenchHeader';
import TopicGrid from '../components/curriculum/TopicGrid';
import SubTopicGrid from '../components/curriculum/SubTopicGrid';
import ObjectiveList from '../components/curriculum/ObjectiveList';
import LinkedItemsPanel from '../components/curriculum/LinkedItemsPanel';
import { exportToCSV, processCSV } from '../utils/csvUtils';
import { LearningObjective, Taxonomy, View } from '../types';

interface CurriculumHealthViewProps {
  onNavigate?: (view: View, context?: Partial<Taxonomy> | null) => void;
}

const CurriculumHealthView: React.FC<CurriculumHealthViewProps> = ({
  onNavigate,
}) => {
  const {
    curriculumData,
    setCurriculumData,
    activeSystem,
    activeTopic,
    activeSystemId,
    activeTopicId,
    activeSubTopic,
    setActiveSubTopic,
    setActiveTopicId,
    contentSearch,
    setContentSearch,
    bloomFilter,
    setBloomFilter,
    handleSystemSelect,
    updateObjective,
    deleteObjective,
    isLoading,
    areTopicsLoading,
    areSubTopicsLoading,
  } = useCurriculum();

  const [viewLinkedItems, setViewLinkedItems] =
    useState<LearningObjective | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTopicId, activeSubTopic, activeSystemId]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = processCSV(
          event.target?.result as string,
          curriculumData,
        );
        if (result.success) {
          setCurriculumData(result.data);
          alert(`Imported ${result.count} objectives.`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const handleCreateLinkedItem = (obj: LearningObjective) => {
    const context: Partial<Taxonomy> = {
      organSystemId: activeSystemId,
      syndromeTopicId: activeTopicId || '',
      subTopicId: obj.subTopic,
      objectiveId: obj.id,
      bloomLevel: obj.bloomLevel,
    };
    setViewLinkedItems(null);
    if (onNavigate) {
      onNavigate('WORKBENCH', context);
    }
  };

  const renderBreadcrumbs = () => (
    <div className="flex items-center text-sm text-slate-500 mb-8 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
      <span
        className="font-black text-slate-900 uppercase tracking-wide cursor-pointer hover:text-[#1BD183] transition-colors flex items-center gap-2"
        onClick={() => {
          setActiveTopicId(null);
          setActiveSubTopic(null);
        }}
      >
        <Activity size={16} className="text-[#1BA6D1]" />
        {activeSystem?.name}
      </span>
      {activeTopic && (
        <>
          <ChevronRight
            size={14}
            className="mx-2 flex-shrink-0 text-slate-300"
          />
          <span
            className={`font-bold uppercase tracking-wide cursor-pointer transition-colors ${
              activeSubTopic
                ? 'text-slate-900 hover:text-[#1BD183]'
                : 'text-[#1BD183] bg-[#1BD183]/5 px-3 py-1 rounded-lg text-xs border border-[#1BD183]/10'
            }`}
            onClick={() => setActiveSubTopic(null)}
          >
            {activeTopic.name}
          </span>
        </>
      )}
      {activeSubTopic && (
        <>
          <ChevronRight
            size={14}
            className="mx-2 flex-shrink-0 text-slate-300"
          />
          <span className="font-bold text-[#1BD183] bg-[#1BD183]/5 px-3 py-1 rounded-lg text-xs uppercase tracking-wide border border-[#1BD183]/10 flex items-center gap-2">
            <Network size={12} />
            {activeSubTopic}
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
          <p className="text-slate-500 font-bold text-sm uppercase tracking-wide">
            Loading Curriculum...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] bg-slate-50 overflow-hidden font-sans text-slate-900 rounded-[2rem] border border-slate-200 shadow-sm relative">
      <Sidebar
        systems={curriculumData}
        activeId={activeSystemId}
        onSelect={handleSystemSelect}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/50 backdrop-blur-sm relative">
        <WorkbenchHeader
          onImport={() => fileInputRef.current?.click()}
          onExport={() => exportToCSV(curriculumData)}
          searchTerm={contentSearch}
          setSearch={setContentSearch}
          searchPlaceholder={
              !activeTopicId 
              ? "Filter Topics..." 
              : !activeSubTopic 
                  ? "Filter Subtopics..." 
                  : "Search Objectives..."
          }
        />

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-10 custom-scrollbar"
        >
          {renderBreadcrumbs()}

          {!activeTopicId || !activeTopic ? (
            areTopicsLoading ? (
               <div className="flex flex-col items-center justify-center py-20">
                 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1BD183] mb-4"></div>
                 <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Topics...</p>
               </div>
            ) : (
                <TopicGrid
                topics={activeSystem?.topics || []}
                onSelect={setActiveTopicId}
                searchTerm={contentSearch}
                />
            )
          ) : !activeSubTopic ? (
            areSubTopicsLoading ? (
               <div className="flex flex-col items-center justify-center py-20">
                 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1BD183] mb-4"></div>
                 <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Syndromes...</p>
               </div>
            ) : (
                <SubTopicGrid
                topic={activeTopic!}
                onSelect={setActiveSubTopic}
                onBack={() => setActiveTopicId(null)}
                searchTerm={contentSearch}
                />
            )
          ) : (
            <ObjectiveList
              topic={activeTopic!}
              subTopic={activeSubTopic}
              searchTerm={contentSearch}
              bloomFilter={bloomFilter}
              setBloomFilter={setBloomFilter}
              onBack={() => setActiveSubTopic(null)}
              onEdit={updateObjective}
              onDelete={deleteObjective}
              onViewLinked={setViewLinkedItems}
            />
          )}
        </div>
      </div>

      {viewLinkedItems && (
        <LinkedItemsPanel
          objective={viewLinkedItems}
          onClose={() => setViewLinkedItems(null)}
          onCreateNew={handleCreateLinkedItem}
        />
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        className="hidden"
        accept=".csv"
      />
    </div>
  );
};

export default CurriculumHealthView;
