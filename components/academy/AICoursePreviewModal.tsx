import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { academyStudioService } from '@/services/academyStudioService';
import { testsService } from '@/services/testsService';
import {
  CourseContentDraft,
  CourseSourceFile,
  TeacherCourse,
} from '@/types/AcademyStudioTypes';

interface AICoursePreviewModalProps {
  isOpen: boolean;
  course: TeacherCourse | null;
  onClose: () => void;
  onSave: (
    sourceFile: CourseSourceFile,
    contentDrafts: CourseContentDraft[],
  ) => void;
}

const AICoursePreviewModal: React.FC<AICoursePreviewModalProps> = ({
  isOpen,
  course,
  onClose,
  onSave,
}) => {
  const [draftTitle, setDraftTitle] = useState('');
  const [contentDrafts, setContentDrafts] = useState<CourseContentDraft[]>([]);
  const [sourceFile, setSourceFile] = useState<CourseSourceFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  useEffect(() => {
    if (!course || !isOpen) return;
    setDraftTitle(course.title);
    setContentDrafts(course.contentDrafts || []);
    setSourceFile(course.sourceFiles[0] || null);
    setError(null);
    setEditingDraftId(null);
  }, [course, isOpen]);

  const canSave = useMemo(
    () => Boolean(sourceFile && contentDrafts.length > 0 && draftTitle.trim()),
    [contentDrafts.length, draftTitle, sourceFile],
  );

  if (!isOpen || !course) return null;

  const handleClose = () => {
    if (isGenerating) return;
    onClose();
  };

  const handleUpload = async (file: File) => {
    setIsGenerating(true);
    setError(null);

    try {
      let uploadedFileId: string | undefined;
      try {
        const uploaded = await testsService.uploadFile(file);
        uploadedFileId = uploaded.id;
      } catch (uploadError) {
        console.warn('PDF upload failed, continuing with local draft only.', uploadError);
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1300));

      const nextFile: CourseSourceFile = {
        id: academyStudioService.makeId('source'),
        name: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedFileId,
      };

      const nextDrafts = academyStudioService.generateContentDraftsFromSource(
        { ...course, title: draftTitle.trim() || course.title },
        file.name,
      );

      setSourceFile(nextFile);
      setContentDrafts(nextDrafts);
      setEditingDraftId(nextDrafts[0]?.id || null);
    } catch (generationError) {
      console.error(generationError);
      setError('Unable to create an AI draft from this file. Try another PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateDraft = (
    draftId: string,
    nextDraft: Partial<CourseContentDraft>,
  ) => {
    setContentDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              ...nextDraft,
            }
          : draft,
      ),
    );
  };

  const addDraft = () => {
    const nextDraft: CourseContentDraft = {
      id: academyStudioService.makeId('content-draft'),
      title: `Learning Objective Set ${contentDrafts.length + 1}`,
      objectives: ['Describe the key learning objective this draft should support.'],
    };
    setContentDrafts((current) => [...current, nextDraft]);
    setEditingDraftId(nextDraft.id);
  };

  const removeDraft = (draftId: string) => {
    setContentDrafts((current) => current.filter((draft) => draft.id !== draftId));
    if (editingDraftId === draftId) {
      setEditingDraftId(null);
    }
  };

  const saveDraft = () => {
    if (!sourceFile) return;

    onSave(sourceFile, contentDrafts.map((draft) => ({
      ...draft,
      title: draft.title.trim() || 'Untitled Learning Objective Set',
      objectives: draft.objectives.map((objective) => objective.trim()).filter(Boolean),
    })));
    onClose();
  };

  const modal = (
    <div className="teacher-readable fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/82 backdrop-blur-lg"
        onClick={handleClose}
      />

      <div className="relative z-10 w-full max-w-6xl rounded-[2.5rem] border border-white/40 bg-[#F4F5F2] shadow-[0_40px_120px_rgba(15,17,16,0.24)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-slate-900 text-white shadow-lg">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">
                AI Course Preview
              </p>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Build course content from a source PDF
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-400 transition hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 px-8 py-8 lg:grid-cols-[320px_1fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
              <label className="mb-3 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                Course name
              </label>
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
                placeholder="Course title"
              />

              <div className="mt-6 rounded-[1.75rem] border border-dashed border-emerald-300 bg-emerald-50/70 p-5">
                <p className="text-sm font-bold text-slate-800">
                  Upload a PDF to draft learning objectives and course content.
                </p>
               

                <label className="mt-5 flex cursor-pointer items-center justify-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-white transition hover:bg-slate-800">
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                  {isGenerating ? 'Generating draft' : 'Upload PDF'}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUpload(file);
                      }
                    }}
                  />
                </label>

                {sourceFile && (
                  <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                    <p className="font-bold text-slate-900">{sourceFile.name}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                      Source attached {sourceFile.uploadedFileId ? 'and synced' : 'locally'}
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                  {error}
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-[#101311] p-6 text-white">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-400">
                Draft logic
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>1. PDF upload creates a source anchor for this course.</p>
                <p>2. Existing learning objectives are organized into editable learning objective sets.</p>
                <p>3. The saved AI draft stays attached to the course content workspace.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Course structure
                </p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                  Review the generated learning objective sets
                </h3>
              </div>

              <button
                type="button"
                onClick={addDraft}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
              >
                <Plus size={14} />
                Add learning objective set
              </button>
            </div>

            <div className="mt-6 max-h-[60vh] space-y-4 overflow-y-auto pr-2 modal-custom-scrollbar">
              {contentDrafts.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
                  <p className="text-lg font-black text-slate-800">
                    Upload a PDF to generate the first learning objective draft.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    The preview will appear here with editable learning objective sets and grouped outcomes.
                  </p>
                </div>
              ) : (
                contentDrafts.map((draft, index) => {
                  const isEditing = editingDraftId === draft.id;
                  return (
                    <div
                      key={draft.id}
                      className="rounded-[2rem] border border-slate-200 bg-[#F7F8F5] p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="mt-1 text-slate-300">⋮⋮</div>
                          <div className="min-w-0">
                            {isEditing ? (
                              <input
                                value={draft.title}
                                onChange={(event) =>
                                  updateDraft(draft.id, { title: event.target.value })
                                }
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                              />
                            ) : (
                              <h4 className="text-base font-black text-slate-900">
                                Learning objective set {index + 1}: {draft.title}
                              </h4>
                            )}

                            <p className="mt-3 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                              Learning objectives
                            </p>

                            {isEditing ? (
                              <textarea
                                value={draft.objectives.join('\n')}
                                onChange={(event) =>
                                  updateDraft(draft.id, {
                                    objectives: event.target.value
                                      .split('\n')
                                      .map((objective) => objective.trim())
                                      .filter(Boolean),
                                  })
                                }
                                className="mt-3 min-h-[120px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-700"
                              />
                            ) : (
                              <div className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
                                {draft.objectives.map((objective) => (
                                  <p key={`${draft.id}-${objective}`}>{objective}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingDraftId(isEditing ? null : draft.id)}
                            className="rounded-2xl p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeDraft(draft.id)}
                            className="rounded-2xl p-2 text-slate-500 transition hover:bg-white hover:text-rose-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={saveDraft}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#16324F] px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Save size={16} />
                Save AI draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
};

export default AICoursePreviewModal;
