import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Library,
  Loader2,
  Pencil,
  Trash2,
  Rocket,
  History,
  Layers,
  AlertTriangle,
  Activity,
  ChevronRight,
  Network,
  X,
} from 'lucide-react';
import { useCurriculumWorkbench } from '../hooks/useCurriculumWorkbench';
import { useCurriculumContent } from '../hooks/useCurriculumContent';
import WorkbenchSidebar from '../components/curriculum-workbench/WorkbenchSidebar';
import CurriculumFormModal from '../components/curriculum-workbench/CurriculumFormModal';
import PublishModal from '../components/curriculum-workbench/PublishModal';
import AttachOrganSystemModal from '../components/curriculum-workbench/AttachOrganSystemModal';
import VersionHistory from '../components/curriculum-workbench/VersionHistory';
import StatusBadge from '../components/curriculum-workbench/StatusBadge';
import ConfirmationModal from '../components/ConfirmationModal';
import TopicGrid from '../components/curriculum/TopicGrid';
import SubTopicGrid from '../components/curriculum/SubTopicGrid';
import ObjectiveList from '../components/curriculum/ObjectiveList';
import LinkedItemsPanel from '../components/curriculum/LinkedItemsPanel';
import { identifierOf } from '../utils/resourceId';
import { LearningObjective } from '../types';

const CurriculumWorkbenchView: React.FC = () => {
  const navigate = useNavigate();
  const {
    curricula,
    isLoadingList,
    selectedIdentifier,
    selectedCurriculum,
    isLoadingDetail,
    selectCurriculum,
    versions,
    isLoadingVersions,
    selectedVersionNumber,
    selectedVersionDetail,
    isLoadingVersionDetail,
    selectVersion,
    isMutating,
    actionError,
    clearActionError,
    createCurriculum,
    renameCurriculum,
    deleteCurriculum,
    publishCurriculum,
    canManage,
  } = useCurriculumWorkbench();

  const content = useCurriculumContent(selectedCurriculum?.id ?? null);

  const [formModal, setFormModal] = useState<'create' | 'rename' | null>(null);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'content' | 'versions'>('content');
  const [viewLinkedItems, setViewLinkedItems] = useState<LearningObjective | null>(null);

  // Deep-linking to a version snapshot implies the versions view.
  useEffect(() => {
    if (selectedVersionNumber) setViewMode('versions');
  }, [selectedVersionNumber]);

  // Reset to content view when switching curricula.
  useEffect(() => {
    setViewMode('content');
  }, [selectedIdentifier]);

  const effectiveMode = selectedVersionNumber ? 'versions' : viewMode;

  const handleCreateLinkedItem = (obj: LearningObjective, redirectTo?: string) => {
    const context: Record<string, unknown> = {
      questionId: 'new',
      organSystemId: content.activeSystemId,
      topicId: content.activeTopicId,
      syndromeId: content.activeSubTopicId,
      learningObjectiveId: obj.id,
      cognitiveSkillId: (obj as any).cognitiveSkillId || '',
    };
    if (redirectTo) context.redirect = redirectTo;
    setViewLinkedItems(null);
    const params = new URLSearchParams();
    Object.entries(context).forEach(([k, v]) => {
      if (v) params.append(k, String(v));
    });
    navigate(`/workbench?${params.toString()}`);
  };

  // --- Breadcrumb -----------------------------------------------------------
  const renderBreadcrumbs = () => {
    if (!content.activeSystem) return null;
    return (
      <div className="flex items-center text-sm text-slate-500 mb-8 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
        <span
          className="font-black text-slate-900 uppercase tracking-wide cursor-pointer hover:text-[#1BD183] transition-colors flex items-center gap-2"
          onClick={() => {
            content.handleTopicSelect(null);
            content.handleSubTopicSelect(null);
          }}
        >
          <Activity size={16} className="text-[#1BA6D1]" />
          {content.activeSystem.title}
        </span>
        {content.activeTopic && (
          <>
            <ChevronRight size={14} className="mx-2 flex-shrink-0 text-slate-300" />
            <span
              className={`font-bold uppercase tracking-wide cursor-pointer transition-colors ${
                content.activeSubTopicId
                  ? 'text-slate-900 hover:text-[#1BD183]'
                  : 'text-[#1BD183] bg-[#1BD183]/5 px-3 py-1 rounded-lg text-xs border border-[#1BD183]/10'
              }`}
              onClick={() => content.handleSubTopicSelect(null)}
            >
              {content.activeTopic.title}
            </span>
          </>
        )}
        {content.activeSubTopicId && (
          <>
            <ChevronRight size={14} className="mx-2 flex-shrink-0 text-slate-300" />
            <span className="font-bold text-[#1BD183] bg-[#1BD183]/5 px-3 py-1 rounded-lg text-xs uppercase tracking-wide border border-[#1BD183]/10 flex items-center gap-2">
              <Network size={12} />
              {content.activeSubTopic?.title}
            </span>
          </>
        )}
      </div>
    );
  };

  // --- Hierarchy drill-down -------------------------------------------------
  const renderHierarchy = () => {
    if (!content.activeSystemId || !content.activeSystem) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Activity size={40} className="mb-3 opacity-30" />
          <p className="text-xs font-black uppercase tracking-widest">
            Select an organ system from the sidebar
          </p>
          <p className="text-[11px] font-medium mt-2 text-center max-w-xs">
            Create a new organ system (auto-linked to this curriculum) or attach an existing one.
          </p>
        </div>
      );
    }

    // Topic grid
    if (!content.activeTopicId || !content.activeTopic) {
      if (content.areTopicsLoading) {
        return (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#1BD183] mb-4" />
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Topics…</p>
          </div>
        );
      }
      return (
        <TopicGrid
          topics={content.activeSystem.topics || []}
          onSelect={content.handleTopicSelect}
          searchTerm={content.contentSearch}
          onCreateTopic={(data) => content.createTopic(data.name, content.activeSystemId!)}
          onEdit={content.updateTopic}
          onDelete={content.deleteTopic}
          organSystems={content.organSystems}
          currentSystemId={content.activeSystemId}
        />
      );
    }

    // Subtopic grid
    if (!content.activeSubTopic) {
      if (content.areSyndromesLoading) {
        return (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#1BD183] mb-4" />
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Subtopics…</p>
          </div>
        );
      }
      return (
        <SubTopicGrid
          topic={content.activeTopic}
          onSelect={content.handleSubTopicSelect}
          onBack={() => content.handleTopicSelect(null)}
          searchTerm={content.contentSearch}
          onCreateSubTopic={(data) => content.createSubTopic(data.name, content.activeTopic!.id)}
          onEdit={content.updateSubTopic}
          onDelete={content.deleteSubTopic}
          organSystems={content.organSystems}
          currentSystemId={content.activeSystemId}
        />
      );
    }

    // Objective list
    return (
      <ObjectiveList
        organSystemName={content.activeSystem.title}
        topic={content.activeTopic}
        subTopic={content.activeSubTopic}
        searchTerm={content.contentSearch}
        bloomFilter={content.bloomFilter}
        setBloomFilter={content.setBloomFilter}
        onBack={() => content.handleSubTopicSelect(null)}
        onEdit={content.updateObjective}
        onDelete={content.deleteObjective}
        onCreateObjective={content.createObjective}
        onViewLinked={setViewLinkedItems}
        isLoading={content.areObjectivesLoading}
        currentPage={content.objectivesPage}
        totalItems={content.objectivesTotal}
        itemsPerPage={content.objectivesLimit}
        onPageChange={content.setObjectivesPage}
        onRefresh={content.refreshObjectives}
      />
    );
  };

  const renderMain = () => {
    if (!selectedIdentifier) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 px-8">
          <div className="p-6 rounded-[2rem] bg-slate-100 mb-6">
            <Library size={48} className="opacity-40" />
          </div>
          <p className="text-sm font-black uppercase tracking-widest text-slate-500">
            Select a curriculum
          </p>
          <p className="text-xs font-medium mt-2 text-center max-w-sm">
            Pick a curriculum from the dropdown to manage its organ systems, drill into topics and
            learning objectives, and publish versioned snapshots.
          </p>
        </div>
      );
    }

    if (isLoadingDetail && !selectedCurriculum) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin mb-3 text-[#1BD183]" />
          <p className="text-[10px] font-black uppercase tracking-widest">Loading curriculum…</p>
        </div>
      );
    }

    if (!selectedCurriculum) {
      return (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-black uppercase tracking-widest">
          Curriculum not found
        </div>
      );
    }

    return (
      <>
        {/* Curriculum toolbar */}
        <div className="border-b border-slate-100 px-8 py-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-black text-slate-900 truncate">
                {selectedCurriculum.title}
              </h2>
              <StatusBadge
                status={selectedCurriculum.status}
                currentVersion={selectedCurriculum.currentVersion}
                size="md"
              />
              <span className="font-mono text-[11px] bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md text-slate-500">
                {identifierOf(selectedCurriculum)}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => {
                    if (selectedVersionNumber) selectVersion(null);
                    setViewMode('content');
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                    effectiveMode === 'content'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Layers size={14} /> Content
                </button>
                <button
                  onClick={() => setViewMode('versions')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                    effectiveMode === 'versions'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <History size={14} /> Versions
                  {versions.length > 0 && (
                    <span className="ml-0.5 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                      {versions.length}
                    </span>
                  )}
                </button>
              </div>

              {canManage && (
                <>
                  <button
                    onClick={() => setFormModal('rename')}
                    disabled={isMutating}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    <Pencil size={14} /> Rename
                  </button>
                  <button
                    onClick={() => setIsDeleteOpen(true)}
                    disabled={isMutating}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => setIsPublishOpen(true)}
                    disabled={isMutating}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white bg-gradient-to-r from-[#1BD183] to-[#15a968] shadow-lg shadow-[#1BD183]/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    {isMutating ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                    Publish
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {actionError && (
          <div className="mx-8 mt-5 flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <AlertTriangle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
            <p className="flex-1 text-sm text-rose-700 font-medium">{actionError}</p>
            <button onClick={clearActionError} className="p-1 hover:bg-rose-100 rounded-lg transition-colors">
              <X size={16} className="text-rose-400" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {effectiveMode === 'versions' ? (
            <VersionHistory
              versions={versions}
              isLoadingVersions={isLoadingVersions}
              selectedVersionNumber={selectedVersionNumber}
              selectedVersionDetail={selectedVersionDetail}
              isLoadingVersionDetail={isLoadingVersionDetail}
              onSelectVersion={selectVersion}
            />
          ) : (
            <>
              {renderBreadcrumbs()}
              {/* Content search */}
              {content.activeSystemId && (
                <div className="mb-6 max-w-md">
                  <input
                    type="text"
                    value={content.contentSearch}
                    onChange={(e) => content.setContentSearch(e.target.value)}
                    placeholder={
                      !content.activeTopicId
                        ? 'Filter topics…'
                        : !content.activeSubTopic
                        ? 'Filter subtopics…'
                        : 'Search objectives…'
                    }
                    className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-700 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1BD183] transition-all placeholder:text-slate-400"
                  />
                </div>
              )}
              {renderHierarchy()}
            </>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-slate-50 overflow-hidden font-sans text-slate-900 rounded-[2rem] border border-slate-200 shadow-sm relative">
      <WorkbenchSidebar
        curricula={curricula}
        isLoadingCurricula={isLoadingList}
        activeCurriculumIdentifier={selectedIdentifier}
        onCurriculumChange={selectCurriculum}
        onCreateCurriculum={() => setFormModal('create')}
        organSystems={content.organSystems}
        isLoadingOrganSystems={content.isLoadingOrganSystems}
        activeSystemId={content.activeSystemId}
        onSelectSystem={content.handleSystemSelect}
        onCreateSystem={content.createOrganSystem}
        onOpenAttach={() => setIsAttachOpen(true)}
        onEditSystem={content.updateOrganSystem}
        onDeleteSystem={content.deleteOrganSystem}
        canManage={canManage}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/50 backdrop-blur-sm">
        {renderMain()}
      </div>

      {/* Curriculum create / rename */}
      <CurriculumFormModal
        isOpen={formModal !== null}
        mode={formModal ?? 'create'}
        initialTitle={formModal === 'rename' ? selectedCurriculum?.title ?? '' : ''}
        onClose={() => setFormModal(null)}
        onSubmit={async (title) => {
          if (formModal === 'rename' && selectedCurriculum) {
            await renameCurriculum(selectedCurriculum.id, title);
          } else {
            await createCurriculum(title);
          }
        }}
      />

      {/* Publish */}
      <PublishModal
        isOpen={isPublishOpen}
        curriculum={selectedCurriculum}
        organSystemCount={content.organSystems.length}
        learningObjectiveCount={selectedCurriculum?.learningObjectives?.length ?? 0}
        onClose={() => setIsPublishOpen(false)}
        onSubmit={async (summary) => {
          if (selectedCurriculum) {
            await publishCurriculum(identifierOf(selectedCurriculum), summary);
          }
        }}
      />

      {/* Attach existing organ systems */}
      <AttachOrganSystemModal
        isOpen={isAttachOpen}
        curriculumId={selectedCurriculum?.id ?? null}
        linkedIds={content.organSystems.map((s) => s.id)}
        onClose={() => setIsAttachOpen(false)}
        onAttach={content.attachOrganSystems}
      />

      {/* Delete curriculum */}
      <ConfirmationModal
        isOpen={isDeleteOpen}
        title="Delete Curriculum"
        message={`Delete "${selectedCurriculum?.title ?? ''}"? This removes the curriculum and its draft. Published version snapshots remain immutable but the curriculum will no longer be listed. Organ systems are not deleted. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={async () => {
          setIsDeleteOpen(false);
          if (selectedCurriculum) {
            try {
              await deleteCurriculum(identifierOf(selectedCurriculum));
            } catch {
              /* surfaced via actionError */
            }
          }
        }}
      />

      {/* Linked items panel */}
      {viewLinkedItems && (
        <LinkedItemsPanel
          objective={viewLinkedItems}
          onClose={() => setViewLinkedItems(null)}
          onCreateNew={handleCreateLinkedItem}
        />
      )}
    </div>
  );
};

export default CurriculumWorkbenchView;
