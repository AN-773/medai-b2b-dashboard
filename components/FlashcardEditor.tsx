import React, { useState, useEffect } from 'react';
import { Eye, Layers, Lightbulb, RotateCw } from 'lucide-react';
import { useQuestionEditorData } from '../hooks/useQuestionEditorData';
import {
  BackendApiItem,
  ItemUpsertRequest,
  ApiItemStatus,
  LearningObjective,
} from '../types/TestsServiceTypes';
import { Badge, Button, Field, InlineAlert, cn } from '@/components/ui';
import {
  AutoGrowTextarea,
  EditorSaveActions,
  EditorSection,
  EditorShell,
  StatusControl,
  useLeaveGuard,
  type EditorHint,
} from './editors/EditorShell';
import { ObjectivePicker } from './editors/ObjectivePicker';

interface FlashcardEditorProps {
  onBack: () => void;
  onSave: (request: ItemUpsertRequest) => void | Promise<void>;
  initialQuestion?: BackendApiItem | null;
}

const TIPS = [
  'Keep the front to a single, focused question — one concept per card.',
  "Make the back a concise, atomic answer that's easy to self-grade.",
  'Map every card to a learning objective so it surfaces in spaced review.',
];

const faceStyle: React.CSSProperties = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
};

const FlashcardEditor: React.FC<FlashcardEditorProps> = ({
  onBack,
  onSave,
  initialQuestion,
}) => {
  const editorData = useQuestionEditorData();
  const { selectedObjectiveId, fillFiltersFromObjective } = editorData;

  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ApiItemStatus>('draft');
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set by any user edit; reset when a (new) item is loaded.
  const [isDirty, setIsDirty] = useState(false);
  const touch = () => setIsDirty(true);
  const { requestLeave, leaveDialog } = useLeaveGuard(isDirty, onBack);

  const isEditing = Boolean(initialQuestion?.identifier);

  // Initialize from BackendApiItem
  useEffect(() => {
    if (initialQuestion) {
      setFrontText(initialQuestion.flashcard?.front || '');
      setBackText(initialQuestion.flashcard?.back || '');
      setSelectedStatus(initialQuestion.status || 'draft');
      if (initialQuestion.tags) {
        setSelectedTags(initialQuestion.tags.map((t) => t.id));
      }
      if (initialQuestion.learningObjectiveId) {
        const loStub: LearningObjective = {
          id: initialQuestion.learningObjectiveId,
          title: '',
          identifier: '',
          createdAt: '',
          updatedAt: '',
        };
        fillFiltersFromObjective(loStub);
      }
    }
    setIsDirty(false);
  }, [initialQuestion, fillFiltersFromObjective]);

  const frontCount = frontText.trim().length;
  const backCount = backText.trim().length;

  const handleSaveClick = async () => {
    if (isSaving) return;
    if (!frontText.trim() || !backText.trim()) {
      setError('Both the front (prompt) and back (answer) are required.');
      return;
    }
    if (!selectedObjectiveId) {
      setError('Map this card to a learning objective before saving.');
      return;
    }
    setError(null);
    const request: ItemUpsertRequest = {
      item: {
        ...(initialQuestion?.id ? { id: initialQuestion.id } : {}),
        type: 'flashcard',
        status: selectedStatus,
        flashcard: {
          front: frontText.trim(),
          back: backText.trim(),
        },
      },
      learningObjectiveId: selectedObjectiveId || undefined,
      tags: selectedTags,
    };
    setIsSaving(true);
    try {
      await Promise.resolve(onSave(request));
    } finally {
      setIsSaving(false);
    }
  };

  const validationIssue = !frontText.trim()
    ? 'Add the front of the card'
    : !backText.trim()
      ? 'Add the back of the card'
      : !selectedObjectiveId
        ? 'Choose a learning objective'
        : null;
  const hint: EditorHint | null = isSaving
    ? null
    : validationIssue
      ? { text: validationIssue }
      : isDirty
        ? { text: 'Unsaved changes', tone: 'amber' }
        : null;

  const flip = () => setIsFlipped((f) => !f);

  const preview = (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white shadow-card">
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
            <Eye size={15} className="text-stone-500" aria-hidden="true" />
            Learner preview
          </p>
          <Button variant="secondary" size="sm" icon={RotateCw} onClick={flip}>
            {isFlipped ? 'Show front' : 'Show back'}
          </Button>
        </div>
        <div className="p-4" style={{ perspective: '1600px' }}>
          <div
            role="button"
            tabIndex={0}
            aria-label={isFlipped ? 'Card back. Flip to the front' : 'Card front. Flip to the back'}
            onClick={flip}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                flip();
              }
            }}
            className="grid cursor-pointer select-none rounded-xl transition-transform duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Both faces share one grid cell, so the card grows with the longer side. */}
            <div
              className="flex min-h-[240px] flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-card [grid-area:1/1]"
              style={faceStyle}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge>Front</Badge>
                <span className="text-xs text-stone-400">Click to flip</span>
              </div>
              <div className="flex flex-1 items-center justify-center py-4">
                <p
                  className={cn(
                    'whitespace-pre-wrap break-words text-center',
                    frontText ? 'text-base font-medium leading-7 text-stone-900' : 'text-sm text-stone-400',
                  )}
                >
                  {frontText || 'Your prompt appears here.'}
                </p>
              </div>
            </div>
            <div
              className="flex min-h-[240px] flex-col rounded-xl border border-brand-200 bg-brand-50 p-5 shadow-card [grid-area:1/1]"
              style={{ ...faceStyle, transform: 'rotateY(180deg)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone="green">Back</Badge>
                <span className="text-xs text-brand-800/70">Click to flip</span>
              </div>
              <div className="flex flex-1 items-center justify-center py-4">
                <p
                  className={cn(
                    'whitespace-pre-wrap break-words text-center',
                    backText ? 'text-base font-medium leading-7 text-stone-900' : 'text-sm text-stone-500',
                  )}
                >
                  {backText || 'Your answer appears here.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-card">
        <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
          <Lightbulb size={15} className="text-amber-500" aria-hidden="true" />
          Active-recall tips
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-5 text-stone-600 marker:text-stone-300">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      <EditorShell
        kind={{ label: 'Flashcard', icon: Layers }}
        title={isEditing ? 'Edit flashcard' : 'New flashcard'}
        identifier={initialQuestion?.identifier}
        status={
          <StatusControl
            value={selectedStatus}
            editable={isEditing}
            onChange={(status) => {
              setSelectedStatus(status);
              touch();
            }}
          />
        }
        onBack={requestLeave}
        hint={hint}
        actions={
          <EditorSaveActions
            isDirty={isDirty}
            saving={isSaving}
            saveLabel={isEditing ? 'Save changes' : 'Create card'}
            onDiscard={requestLeave}
            onSave={() => void handleSaveClick()}
          />
        }
        alert={error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
        aside={preview}
      >
        <EditorSection
          title="Card"
          description="A focused prompt on the front, a short answer on the back."
        >
          <div className="space-y-5">
            <Field label="Front" description={`The prompt or cue · ${frontCount} characters`}>
              {(id) => (
                <AutoGrowTextarea
                  id={id}
                  minRows={3}
                  value={frontText}
                  onChange={(e) => {
                    setFrontText(e.target.value);
                    touch();
                  }}
                  onFocus={() => setIsFlipped(false)}
                  placeholder="e.g. What is the mechanism of action of acetazolamide?"
                />
              )}
            </Field>
            <Field label="Back" description={`The answer to recall · ${backCount} characters`}>
              {(id) => (
                <AutoGrowTextarea
                  id={id}
                  minRows={4}
                  value={backText}
                  onChange={(e) => {
                    setBackText(e.target.value);
                    touch();
                  }}
                  onFocus={() => setIsFlipped(true)}
                  placeholder="e.g. Carbonic anhydrase inhibitor — reduces H⁺ secretion and HCO₃⁻ reabsorption in the proximal tubule."
                />
              )}
            </Field>
          </div>
        </EditorSection>

        <EditorSection
          title="Classification"
          description="Every card is mapped to a learning objective."
          meta={
            selectedObjectiveId ? (
              <Badge tone="green" dot>
                Objective set
              </Badge>
            ) : (
              <Badge tone="amber" dot>
                Required
              </Badge>
            )
          }
        >
          <ObjectivePicker data={editorData} onEdit={touch} />
        </EditorSection>
      </EditorShell>
      {leaveDialog}
    </>
  );
};

export default FlashcardEditor;
