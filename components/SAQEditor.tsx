import React, { useState, useEffect, useId } from 'react';
import { FileText } from 'lucide-react';
import { useQuestionEditorData } from '../hooks/useQuestionEditorData';
import { BackendApiItem, ItemUpsertRequest, ApiItemStatus, LearningObjective } from '../types/TestsServiceTypes';
import { Badge, InlineAlert } from '@/components/ui';
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

interface SAQEditorProps {
  onBack: () => void;
  onSave: (request: ItemUpsertRequest) => void | Promise<void>;
  initialQuestion?: BackendApiItem | null;
}

const SAQEditor: React.FC<SAQEditorProps> = ({ onBack, onSave, initialQuestion }) => {
  const baseId = useId();
  const editorData = useQuestionEditorData();
  const { selectedObjectiveId, fillFiltersFromObjective } = editorData;

  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ApiItemStatus>('draft');
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
      setQuestionText(initialQuestion.saq?.question || '');
      setAnswerText(initialQuestion.saq?.answer || '');
      setSelectedStatus(initialQuestion.status || 'draft');
      if (initialQuestion.tags) setSelectedTags(initialQuestion.tags.map(t => t.id));

      // Populate hierarchy from LO
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

  const handleSaveClick = async () => {
    if (isSaving) return;
    if (!questionText.trim() || !answerText.trim()) {
      setError('Both the question prompt and answer guidelines are required.');
      return;
    }
    if (!selectedObjectiveId) {
      setError('Map this SAQ to a learning objective before saving.');
      return;
    }
    setError(null);
    const request: ItemUpsertRequest = {
      item: {
        ...(initialQuestion?.id ? { id: initialQuestion.id } : {}),
        type: 'saq',
        status: selectedStatus,
        saq: {
          question: questionText.trim(),
          answer: answerText.trim(),
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

  const validationIssue = !questionText.trim()
    ? 'Add the question'
    : !answerText.trim()
      ? 'Add the model answer'
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

  const questionId = `${baseId}-question`;
  const answerId = `${baseId}-answer`;

  return (
    <>
      <EditorShell
        kind={{ label: 'SAQ', icon: FileText }}
        title={isEditing ? 'Edit SAQ' : 'New SAQ'}
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
            saveLabel={isEditing ? 'Save changes' : 'Create SAQ'}
            onDiscard={requestLeave}
            onSave={() => void handleSaveClick()}
          />
        }
        alert={error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}
        width="narrow"
      >
        <EditorSection
          title="Question"
          labelFor={questionId}
          description="The prompt learners answer in their own words."
        >
          <AutoGrowTextarea
            id={questionId}
            minRows={4}
            value={questionText}
            onChange={e => {
              setQuestionText(e.target.value);
              touch();
            }}
            placeholder="e.g. Explain why metformin is first-line therapy in type 2 diabetes."
          />
        </EditorSection>

        <EditorSection
          title="Model answer"
          labelFor={answerId}
          description="The expected answer or grading rubric. Learners compare their response against it."
        >
          <AutoGrowTextarea
            id={answerId}
            minRows={6}
            value={answerText}
            onChange={e => {
              setAnswerText(e.target.value);
              touch();
            }}
            placeholder="Key points a complete answer covers"
          />
        </EditorSection>

        <EditorSection
          title="Classification"
          description="Every SAQ is mapped to a learning objective."
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

export default SAQEditor;
