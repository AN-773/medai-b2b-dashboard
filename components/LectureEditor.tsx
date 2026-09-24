import React, { useId, useState } from 'react';
import { Clock, FileText, MonitorPlay, Plus, Trash2 } from 'lucide-react';
import { MOCK_LEARNING_OBJECTIVES } from '../constants';
import { Badge, Button, EmptyState, Field, IconButton, Input, cn } from '@/components/ui';
import {
  AutoGrowTextarea,
  EditorSaveActions,
  EditorSection,
  EditorShell,
  useLeaveGuard,
  type EditorHint,
} from './editors/EditorShell';

interface LectureEditorProps {
  onBack: () => void;
  onSave: () => void;
  initialData?: any;
}

interface EngagementMarker {
  timestamp: number;
  note: string;
}

/** 210 → "3:30". */
const formatTimestamp = (seconds: number) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
};

const LectureEditor: React.FC<LectureEditorProps> = ({ onBack, onSave, initialData }) => {
  const baseId = useId();
  const [title, setTitle] = useState(initialData?.title || 'New Lecture Asset');
  const [description, setDescription] = useState(initialData?.description || '');
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>(initialData?.linkedObjectiveIds || []);
  const [engagementMarkers, setEngagementMarkers] = useState<EngagementMarker[]>(initialData?.engagementMarkers || [
    { timestamp: 210, note: 'Comparison table hotspot' },
    { timestamp: 1420, note: 'Biopsy walkthrough' }
  ]);

  // Set by any user edit.
  const [isDirty, setIsDirty] = useState(false);
  const touch = () => setIsDirty(true);
  const { requestLeave, leaveDialog } = useLeaveGuard(isDirty, onBack);

  const toggleObjective = (id: string) => {
    setSelectedObjectives(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    );
    touch();
  };

  const addMarker = () => {
    setEngagementMarkers(prev => [...prev, { timestamp: 0, note: '' }]);
    touch();
  };

  const updateMarker = (index: number, field: string, value: any) => {
    setEngagementMarkers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    touch();
  };

  const removeMarker = (index: number) => {
    setEngagementMarkers(prev => prev.filter((_, i) => i !== index));
    touch();
  };

  const hint: EditorHint | null = isDirty ? { text: 'Unsaved changes', tone: 'amber' } : null;

  const files = [
    { icon: MonitorPlay, label: 'Video', value: initialData?.videoUri || 'lecture_v1_final.mp4' },
    { icon: FileText, label: 'Transcript', value: initialData?.transcriptUri || 'transcript_eng.vtt' },
  ];

  return (
    <>
      <EditorShell
        kind={{ label: 'Lecture', icon: MonitorPlay }}
        title="Edit lecture"
        identifier={initialData?.id}
        onBack={requestLeave}
        hint={hint}
        actions={
          <EditorSaveActions
            isDirty={isDirty}
            saving={false}
            saveLabel="Save changes"
            onDiscard={requestLeave}
            onSave={onSave}
          />
        }
        width="narrow"
      >
        <EditorSection title="Details">
          <div className="space-y-4">
            <Field label="Title">
              {(id) => (
                <Input
                  id={id}
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value);
                    touch();
                  }}
                />
              )}
            </Field>
            <Field label="Description">
              {(id) => (
                <AutoGrowTextarea
                  id={id}
                  minRows={4}
                  value={description}
                  onChange={e => {
                    setDescription(e.target.value);
                    touch();
                  }}
                />
              )}
            </Field>
          </div>
        </EditorSection>

        <EditorSection
          title="Engagement markers"
          description="Moments in the video to highlight for learners."
          meta={<Badge>{engagementMarkers.length}</Badge>}
          flush
        >
          {engagementMarkers.length === 0 ? (
            <EmptyState
              compact
              icon={Clock}
              title="No markers yet"
              description="Add a marker to point learners to a key moment."
            />
          ) : (
            <ol className="divide-y divide-stone-100">
              {engagementMarkers.map((m, i) => {
                const timeId = `${baseId}-marker-time-${i}`;
                const noteId = `${baseId}-marker-note-${i}`;
                return (
                  <li key={i} className="flex flex-wrap items-end gap-3 px-5 py-3">
                    <div className="w-32">
                      <label htmlFor={timeId} className="mb-1 block text-xs text-stone-500">
                        Time (seconds)
                      </label>
                      <Input
                        id={timeId}
                        type="number"
                        min={0}
                        value={m.timestamp}
                        onChange={e => updateMarker(i, 'timestamp', Number(e.target.value))}
                        placeholder="Sec"
                        className="tabular-nums"
                      />
                    </div>
                    <div className="min-w-[12rem] flex-1">
                      <label htmlFor={noteId} className="mb-1 flex items-baseline justify-between text-xs text-stone-500">
                        Note
                        <span className="tabular-nums text-stone-400">at {formatTimestamp(m.timestamp)}</span>
                      </label>
                      <Input
                        id={noteId}
                        value={m.note}
                        onChange={e => updateMarker(i, 'note', e.target.value)}
                        placeholder="What happens at this moment"
                      />
                    </div>
                    <IconButton
                      icon={Trash2}
                      tone="danger"
                      label={`Remove marker ${i + 1}`}
                      onClick={() => removeMarker(i)}
                    />
                  </li>
                );
              })}
            </ol>
          )}
          <div className="border-t border-stone-100 px-5 py-2.5">
            <Button variant="ghost" size="sm" icon={Plus} onClick={addMarker} className="-ml-2.5">
              Add marker
            </Button>
          </div>
        </EditorSection>

        <EditorSection
          title="Learning objectives"
          meta={<Badge tone={selectedObjectives.length > 0 ? 'green' : 'neutral'}>{selectedObjectives.length} selected</Badge>}
          flush
        >
          <ul className="custom-scrollbar max-h-96 divide-y divide-stone-100 overflow-y-auto rounded-b-xl">
            {MOCK_LEARNING_OBJECTIVES.map(obj => {
              const checked = selectedObjectives.includes(obj.id);
              const checkboxId = `${baseId}-objective-${obj.id}`;
              return (
                <li key={obj.id}>
                  <label
                    htmlFor={checkboxId}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors hover:bg-stone-50',
                      checked && 'bg-brand-50/50',
                    )}
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-brand-600"
                      checked={checked}
                      onChange={() => toggleObjective(obj.id)}
                    />
                    <span className="text-sm leading-5 text-stone-800">{obj.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </EditorSection>

        <EditorSection title="Files" flush>
          <ul className="divide-y divide-stone-100">
            {files.map(({ icon: Icon, label, value }) => (
              <li key={label} className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900">{label}</p>
                  <p className="truncate text-[13px] text-stone-500">{value}</p>
                </div>
              </li>
            ))}
          </ul>
        </EditorSection>
      </EditorShell>
      {leaveDialog}
    </>
  );
};

export default LectureEditor;
