import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  Download,
  Eye,
  GitCompare,
  Lightbulb,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import MarkdownContent from '@/components/MarkdownContent';
import SkillDiff, { type DiffSide } from '@/components/tutor-skills/SkillDiff';
import SkillEditor from '@/components/tutor-skills/SkillEditor';
import SkillStatusBadge from '@/components/tutor-skills/SkillStatusBadge';
import { Toast, useToast } from '@/components/admin/AdminFeedback';
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  InlineAlert,
  PageHeader,
  SegmentedControl,
  Select,
  SwitchRow,
  Spinner,
  cn,
} from '@/components/ui';
import {
  skillProblemOf,
  tutorSkillsService,
  type SkillDetail,
  type SkillDraft,
  type SkillEvent,
  type SkillSummary,
  type SkillVersion,
} from '@/services/tutorSkillsService';

// Tutor skills: the written methods the AI tutor loads when a student's request
// matches one, kept in medai-agent-v2 with every version and change recorded
// (agent-v2 DECISIONS → SKILL §9). Saving keeps every version; students get the
// published one, from their next message.

const dateTime = (value: string) => new Date(value).toLocaleString();
const who = (id: string, email: string | null) => email ?? id;

const NotConnected: React.FC = () => (
  <EmptyState
    icon={Lightbulb}
    title="Tutor skills are not connected on this site"
    description="This build has no agent-v2 address (VITE_AGENT_V2_API_URL), so there is nowhere to keep skills."
  />
);

const Forbidden: React.FC = () => (
  <EmptyState
    icon={Lightbulb}
    title="Only a superadmin can manage tutor skills"
    description="The tutor refused this account's token for skill management."
  />
);

const BackLink: React.FC = () => (
  <Link to="/tutor-skills" className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-800">
    <ChevronLeft size={14} />
    Tutor skills
  </Link>
);

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

const TutorSkillsView: React.FC = () => {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await tutorSkillsService.list(showArchived);
      setSkills(result.skills ?? []);
    } catch (failure) {
      const problem = skillProblemOf(failure);
      if (problem?.code === 'superadmin_required') setForbidden(true);
      else setError(problem?.message ?? (failure as Error).message ?? 'The skills could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    if (tutorSkillsService.isConfigured()) void load();
  }, [load]);

  if (!tutorSkillsService.isConfigured()) return <NotConnected />;
  if (forbidden) return <Forbidden />;

  return (
    <div>
      <PageHeader
        title="Tutor skills"
        description="Methods the tutor follows when a student's request matches one — running an OSCE station, taking an exam question apart. Saving keeps every version; students get only the published one, from their next message."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => navigate('/tutor-skills/new')}>
            New skill
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-60">
          <SwitchRow checked={showArchived} onChange={setShowArchived} label="Show archived" />
        </div>
        <Button
          aria-label="Refresh tutor skills"
          title="Refresh tutor skills"
          icon={RefreshCw}
          loading={loading}
          onClick={() => void load()}
          className="ml-auto w-9 px-0"
        />
      </div>

      <div className="mt-5 space-y-4">
        {error && (
          <InlineAlert tone="error" title="Could not load tutor skills">
            {error}
          </InlineAlert>
        )}
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
          {loading && skills.length === 0 ? (
            <Spinner label="Loading tutor skills…" className="py-20" />
          ) : skills.length === 0 ? (
            !error && (
              <EmptyState
                icon={Lightbulb}
                title="No tutor skills yet"
                description="Write a method the tutor should follow for one kind of request, then publish it."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => navigate('/tutor-skills/new')}>
                    New skill
                  </Button>
                }
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500">
                    <th scope="col" className="px-4 py-2.5 font-medium">Skill</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Modes</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Students get</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Latest</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Last saved by</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-stone-100 transition-opacity', loading && 'opacity-60')}>
                  {skills.map((skill) => (
                    <tr
                      key={skill.name}
                      className="cursor-pointer transition-colors hover:bg-stone-50"
                      onClick={() => navigate(`/tutor-skills/${skill.name}`)}
                    >
                      <td className="max-w-[28rem] px-4 py-3">
                        <Link
                          to={`/tutor-skills/${skill.name}`}
                          className="font-mono text-sm font-medium text-stone-900 underline-offset-2 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {skill.name}
                        </Link>
                        <p className="mt-0.5 truncate text-stone-500" title={skill.description}>
                          {skill.description}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <SkillStatusBadge
                          status={skill.status}
                          publishedNumber={skill.publishedNumber}
                          latestNumber={skill.latestNumber}
                        />
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {skill.modes.map((mode) => (
                            <Badge key={mode} tone="neutral">{mode}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {skill.publishedNumber === null ? <span className="text-stone-400">—</span> : `v${skill.publishedNumber}`}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">v{skill.latestNumber}</td>
                      <td className="hidden px-4 py-3 text-stone-600 lg:table-cell">{who(skill.latestBy, skill.latestByEmail)}</td>
                      <td className="hidden whitespace-nowrap px-4 py-3 tabular-nums text-stone-600 lg:table-cell">
                        {dateTime(skill.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorSkillsView;

// ---------------------------------------------------------------------------
// A new skill
// ---------------------------------------------------------------------------

const EMPTY_DRAFT: SkillDraft = { name: '', description: '', modes: [], body: '' };

export const TutorSkillCreateView: React.FC = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState('');

  if (!tutorSkillsService.isConfigured()) return <NotConnected />;

  const save = async (draft: SkillDraft & { message: string }) => {
    setSaving(true);
    setProblems([]);
    setError('');
    try {
      await tutorSkillsService.create(draft);
      navigate(`/tutor-skills/${draft.name}`, { state: { notice: `Saved ${draft.name} as v1. Publish it when it is ready for students.` } });
    } catch (failure) {
      const problem = skillProblemOf(failure);
      if (problem?.code === 'invalid_skill') setProblems(problem.problems ?? []);
      else setError(problem?.message ?? (failure as Error).message ?? 'The skill could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow={<BackLink />} title="New tutor skill" description="Saved as v1. Nothing reaches students until you publish it." />
      <div className="mt-6 space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        {error && <InlineAlert tone="error">{error}</InlineAlert>}
        <SkillEditor
          initial={EMPTY_DRAFT}
          submitLabel="Save as v1"
          saving={saving}
          problems={problems}
          onSubmit={save}
          onChange={() => setProblems([])}
          onCancel={() => navigate('/tutor-skills')}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// One skill
// ---------------------------------------------------------------------------

type Tab = 'edit' | 'history' | 'activity';

type PendingAction =
  | { kind: 'publish'; number: number }
  | { kind: 'unpublish' }
  | { kind: 'archive' };

const describeEvent = (event: SkillEvent): string => {
  const previous = event.detail?.previous;
  switch (event.action) {
    case 'created':
      return `Created v${event.versionNumber}`;
    case 'saved':
      return `Saved v${event.versionNumber}`;
    case 'published':
      if (previous === null || previous === undefined) return `Published v${event.versionNumber} (first time)`;
      return (event.versionNumber ?? 0) < previous
        ? `Rolled back to v${event.versionNumber} (from v${previous})`
        : `Published v${event.versionNumber} (was v${previous})`;
    case 'unpublished':
      return `Unpublished (was v${previous})`;
    case 'archived':
      return previous === null || previous === undefined ? 'Archived' : `Archived (was publishing v${previous})`;
    case 'restored':
      return 'Restored';
    default:
      return event.action;
  }
};

const EVENT_DOT: Record<string, string> = {
  created: 'bg-sky-500',
  saved: 'bg-stone-400',
  published: 'bg-brand-500',
  unpublished: 'bg-amber-500',
  archived: 'bg-stone-400',
  restored: 'bg-sky-500',
};

const sideOf = (label: string, version: SkillVersion | SkillDraft): DiffSide => ({
  label,
  description: version.description,
  modes: version.modes,
  body: version.body,
});

export const TutorSkillView: React.FC = () => {
  const { name = '' } = useParams();
  const navigate = useNavigate();
  const { toast, showToast } = useToast(5000);

  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<'forbidden' | 'missing' | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('edit');
  const [busy, setBusy] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);

  // A version never changes, so each is fetched once.
  const versionCache = useRef(new Map<number, SkillVersion>());
  const fullVersion = useCallback(
    async (number: number) => {
      const cached = versionCache.current.get(number);
      if (cached) return cached;
      const fetched = await tutorSkillsService.getVersion(name, number);
      versionCache.current.set(number, fetched);
      return fetched;
    },
    [name],
  );

  // Edit
  const [editorBase, setEditorBase] = useState<number | null>(null);
  const [editorInitial, setEditorInitial] = useState<SkillDraft | null>(null);
  const draft = useRef<SkillDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveProblems, setSaveProblems] = useState<string[]>([]);
  const [conflict, setConflict] = useState<{ latestNumber: number } | null>(null);
  const [conflictCompare, setConflictCompare] = useState<{ before: DiffSide; after: DiffSide } | null>(null);

  // History
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);
  const [comparison, setComparison] = useState<{ before: DiffSide; after: DiffSide } | null>(null);
  const [viewing, setViewing] = useState<SkillVersion | null>(null);

  // Activity
  const [events, setEvents] = useState<SkillEvent[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);

  const skill = detail?.skill ?? null;
  const archived = skill?.status === 'archived';

  const report = useCallback((failed: unknown, fallback: string) => {
    const problem = skillProblemOf(failed);
    if (problem?.code === 'superadmin_required') setFailure('forbidden');
    else setError(problem?.message ?? (failed as Error).message ?? fallback);
    return problem;
  }, []);

  const loadEditor = useCallback(
    async (latestNumber: number) => {
      const latest = await fullVersion(latestNumber);
      const initial = { name, description: latest.description, modes: latest.modes, body: latest.body };
      setEditorBase(latest.number);
      setEditorInitial(initial);
      draft.current = initial;
      setConflict(null);
      setConflictCompare(null);
      setSaveProblems([]);
    },
    [fullVersion, name],
  );

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      setEvents((await tutorSkillsService.events(name)).events ?? []);
    } catch (failed) {
      report(failed, 'The activity could not be loaded.');
    } finally {
      setEventsLoading(false);
    }
  }, [name, report]);

  useEffect(() => {
    if (!tutorSkillsService.isConfigured()) return;
    let cancelled = false;
    versionCache.current = new Map();
    setLoading(true);
    void (async () => {
      try {
        const loaded = await tutorSkillsService.get(name);
        if (cancelled) return;
        setDetail(loaded);
        await loadEditor(loaded.skill.latestNumber);
      } catch (failed) {
        if (cancelled) return;
        const problem = skillProblemOf(failed);
        if (problem?.code === 'skill_not_found') setFailure('missing');
        else report(failed, 'The skill could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name, loadEditor, report]);

  useEffect(() => {
    if (tab === 'activity' && events === null) void loadEvents();
  }, [tab, events, loadEvents]);

  // A notice handed over by the create page.
  useEffect(() => {
    const notice = (window.history.state?.usr as { notice?: string } | undefined)?.notice;
    if (notice) showToast(notice);
  }, [showToast]);

  useEffect(() => {
    if (compareFrom === null || compareTo === null) return;
    let cancelled = false;
    void Promise.all([fullVersion(compareFrom), fullVersion(compareTo)])
      .then(([before, after]) => {
        if (!cancelled) setComparison({ before: sideOf(`v${before.number}`, before), after: sideOf(`v${after.number}`, after) });
      })
      .catch((failed) => report(failed, 'The versions could not be compared.'));
    return () => {
      cancelled = true;
    };
  }, [compareFrom, compareTo, fullVersion, report]);

  const versionOptions = useMemo(
    () =>
      (detail?.versions ?? []).map((version) => ({
        value: version.number,
        label: `v${version.number}${version.published ? ' (published)' : ''}`,
      })),
    [detail],
  );

  if (!tutorSkillsService.isConfigured()) return <NotConnected />;
  if (failure === 'forbidden') return <Forbidden />;
  if (failure === 'missing') {
    return (
      <EmptyState
        icon={Lightbulb}
        title={`There is no skill called ${name}`}
        action={<Button onClick={() => navigate('/tutor-skills')}>Back to tutor skills</Button>}
      />
    );
  }
  if (loading || !skill) return <Spinner label="Loading the skill…" className="py-20" />;

  const save = async (edited: SkillDraft & { message: string }) => {
    if (editorBase === null) return;
    setSaving(true);
    setSaveProblems([]);
    setError('');
    try {
      const saved = await tutorSkillsService.save(name, {
        basedOn: editorBase,
        description: edited.description,
        modes: edited.modes,
        body: edited.body,
        message: edited.message,
      });
      setDetail(saved);
      const { publishedNumber, latestNumber } = saved.skill;
      showToast(
        publishedNumber === latestNumber
          ? `Saved v${latestNumber}.`
          : `Saved v${latestNumber}. Students still get ${publishedNumber === null ? 'no version' : `v${publishedNumber}`} until you publish it.`,
      );
      await loadEditor(latestNumber);
      setEvents(null);
    } catch (failed) {
      const problem = skillProblemOf(failed);
      if (problem?.code === 'invalid_skill') setSaveProblems(problem.problems ?? []);
      else if (problem?.code === 'skill_version_conflict' && problem.latestNumber) setConflict({ latestNumber: problem.latestNumber });
      else report(failed, 'The version could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const showConflictCompare = async () => {
    if (!conflict || !draft.current) return;
    const latest = await fullVersion(conflict.latestNumber);
    setConflictCompare({
      before: sideOf(`v${latest.number} (saved by ${who(latest.createdBy, latest.createdByEmail)})`, latest),
      after: sideOf('Your draft', draft.current),
    });
  };

  // Keep the draft and base the next save on the newer version.
  const keepMyDraft = async () => {
    if (!conflict) return;
    setDetail(await tutorSkillsService.get(name));
    setEditorBase(conflict.latestNumber);
    showToast(`Your draft is kept. Saving now makes v${conflict.latestNumber + 1}, based on v${conflict.latestNumber}.`);
    setConflict(null);
    setConflictCompare(null);
  };

  const takeTheirs = async () => {
    const loaded = await tutorSkillsService.get(name);
    setDetail(loaded);
    await loadEditor(loaded.skill.latestNumber);
  };

  const runPending = async () => {
    if (!pending) return;
    const action = pending;
    setBusy(action.kind);
    setError('');
    try {
      if (action.kind === 'publish') {
        const rollback = skill.publishedNumber !== null && action.number < skill.publishedNumber;
        setDetail(await tutorSkillsService.publish(name, action.number));
        showToast(
          rollback
            ? `Rolled back: students get v${action.number} from their next message.`
            : `Published v${action.number}: students get it from their next message.`,
        );
      } else if (action.kind === 'unpublish') {
        setDetail(await tutorSkillsService.unpublish(name));
        showToast("Unpublished. Conversations that already loaded it keep it; new ones won't.");
      } else {
        setDetail(await tutorSkillsService.archive(name));
        showToast('Archived. Its history is kept.');
      }
      setEvents(null);
    } catch (failed) {
      const problem = report(failed, 'That did not go through.');
      if (problem?.code === 'mode_cap_exceeded') setError(problem.message);
    } finally {
      setBusy('');
      setPending(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      setDetail(await tutorSkillsService.restore(name));
      showToast('Restored, unpublished.');
      setEvents(null);
    } catch (failed) {
      report(failed, 'The skill could not be restored.');
    } finally {
      setBusy('');
    }
  };

  const compareWith = (number: number) => {
    const published = skill.publishedNumber;
    setCompareFrom(published !== null && published !== number ? published : Math.max(1, number - 1));
    setCompareTo(number);
  };

  const download = async (number: number) => {
    const version = await fullVersion(number);
    const url = URL.createObjectURL(new Blob([version.source], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}-v${number}-SKILL.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isRollback = (number: number) => skill.publishedNumber !== null && number < skill.publishedNumber;
  const nextNumber = (editorBase ?? 0) + 1;

  const pendingCopy = (() => {
    if (!pending) return { title: '', description: '', confirm: '' };
    if (pending.kind === 'publish') {
      return isRollback(pending.number)
        ? {
            title: `Roll back to v${pending.number}?`,
            description: `Students get v${pending.number} from their next message instead of v${skill.publishedNumber}.`,
            confirm: 'Roll back',
          }
        : { title: `Publish v${pending.number}?`, description: 'Students get it from their next message.', confirm: 'Publish' };
    }
    if (pending.kind === 'unpublish') {
      return {
        title: 'Unpublish this skill?',
        description: 'New conversations stop using it. Conversations that already loaded it keep it.',
        confirm: 'Unpublish',
      };
    }
    return {
      title: 'Archive this skill?',
      description: 'It is unpublished and hidden from the list. Its history is kept and it can be restored.',
      confirm: 'Archive',
    };
  })();

  return (
    <div>
      <PageHeader
        eyebrow={<BackLink />}
        title={<span className="font-mono">{skill.name}</span>}
        meta={<SkillStatusBadge status={skill.status} publishedNumber={skill.publishedNumber} latestNumber={skill.latestNumber} />}
        description={
          <>
            Students get <strong>{skill.publishedNumber === null ? 'no version' : `v${skill.publishedNumber}`}</strong> · latest saved v
            {skill.latestNumber} · modes: {skill.modes.join(', ')}
          </>
        }
        actions={
          archived ? (
            <Button variant="primary" icon={ArchiveRestore} loading={busy === 'restore'} onClick={() => void restore()}>
              Restore
            </Button>
          ) : (
            <>
              {skill.publishedNumber !== skill.latestNumber && (
                <Button variant="primary" icon={Rocket} onClick={() => setPending({ kind: 'publish', number: skill.latestNumber })}>
                  Publish v{skill.latestNumber}
                </Button>
              )}
              {skill.publishedNumber !== null && (
                <Button icon={Undo2} onClick={() => setPending({ kind: 'unpublish' })}>
                  Unpublish
                </Button>
              )}
              <Button variant="danger" icon={Archive} onClick={() => setPending({ kind: 'archive' })}>
                Archive
              </Button>
            </>
          )
        }
      />

      <div className="mt-6 space-y-4">
        {error && (
          <InlineAlert tone="error" onDismiss={() => setError('')}>
            {error}
          </InlineAlert>
        )}

        <SegmentedControl<Tab>
          label="Skill sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'history', label: 'History', count: detail?.versions.length },
            { value: 'activity', label: 'Activity' },
          ]}
        />

        {tab === 'edit' && (
          <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-card">
            {archived && <InlineAlert tone="info">This skill is archived. Restore it to edit or publish it.</InlineAlert>}
            {conflict && (
              <InlineAlert
                tone="warning"
                title={`Someone saved v${conflict.latestNumber} after you started editing v${editorBase}. Your draft was not saved.`}
              >
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" icon={GitCompare} onClick={() => void showConflictCompare()}>
                    Compare v{conflict.latestNumber} with my draft
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => void keepMyDraft()}>
                    Keep my draft and save on top of v{conflict.latestNumber}
                  </Button>
                  <Button size="sm" onClick={() => void takeTheirs()}>
                    Discard my draft and load v{conflict.latestNumber}
                  </Button>
                </div>
                {conflictCompare && (
                  <div className="mt-3 rounded-lg bg-white p-3">
                    <SkillDiff before={conflictCompare.before} after={conflictCompare.after} />
                  </div>
                )}
              </InlineAlert>
            )}
            {!archived && (
              <p className="text-[13px] text-stone-500">
                Editing v{editorBase}. Saving makes v{nextNumber}; students keep getting{' '}
                {skill.publishedNumber === null ? 'nothing' : `v${skill.publishedNumber}`} until you publish.
              </p>
            )}
            {editorInitial && (
              <SkillEditor
                initial={editorInitial}
                nameLocked
                disabled={archived}
                saving={saving}
                problems={saveProblems}
                submitLabel={`Save as v${nextNumber}`}
                onChange={(value) => {
                  draft.current = value;
                  setSaveProblems([]);
                }}
                onSubmit={(edited) => void save(edited)}
                onCancel={() => navigate('/tutor-skills')}
              />
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-stone-600">
                <span className="font-medium text-stone-800">Compare</span>
                <Select
                  aria-label="Older version"
                  value={compareFrom ?? ''}
                  onChange={(event) => setCompareFrom(event.target.value ? Number(event.target.value) : null)}
                  className="h-8 w-40"
                >
                  <option value="">older…</option>
                  {versionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                <span>to</span>
                <Select
                  aria-label="Newer version"
                  value={compareTo ?? ''}
                  onChange={(event) => setCompareTo(event.target.value ? Number(event.target.value) : null)}
                  className="h-8 w-40"
                >
                  <option value="">newer…</option>
                  {versionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>
              {comparison ? (
                <SkillDiff before={comparison.before} after={comparison.after} />
              ) : (
                <p className="text-[13px] text-stone-500">Pick two versions, or use Compare on a row below.</p>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th scope="col" className="px-4 py-2.5 font-medium">Version</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">What changed</th>
                      <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Saved by</th>
                      <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">When</th>
                      <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Text</th>
                      <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(detail?.versions ?? []).map((version) => (
                      <tr key={version.number} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="font-medium text-stone-900">v{version.number}</span>
                          {version.published && (
                            <Badge tone="green" dot className="ml-2">Published</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-700">
                          {version.message || <span className="text-stone-400">—</span>}
                          {version.basedOn !== null && version.basedOn !== version.number - 1 && (
                            <p className="text-stone-400">edited from v{version.basedOn}</p>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-stone-600 md:table-cell">{who(version.createdBy, version.createdByEmail)}</td>
                        <td className="hidden whitespace-nowrap px-4 py-3 tabular-nums text-stone-600 lg:table-cell">{dateTime(version.createdAt)}</td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <span className="font-mono text-xs text-stone-500" title="What a conversation's transcript calls this text">
                            {version.contentHash}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button size="sm" variant="ghost" icon={Eye} onClick={() => void fullVersion(version.number).then(setViewing)}>
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={GitCompare}
                              disabled={(detail?.versions.length ?? 0) < 2}
                              onClick={() => compareWith(version.number)}
                            >
                              Compare
                            </Button>
                            <Button size="sm" variant="ghost" icon={Download} aria-label={`Download v${version.number} as SKILL.md`} onClick={() => void download(version.number)} />
                            {!version.published && !archived && (
                              <Button
                                size="sm"
                                icon={isRollback(version.number) ? RotateCcw : Rocket}
                                onClick={() => setPending({ kind: 'publish', number: version.number })}
                              >
                                {isRollback(version.number) ? 'Roll back to this' : 'Publish'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
            {eventsLoading && events === null ? (
              <Spinner label="Loading activity…" className="py-10" />
            ) : events && events.length > 0 ? (
              <ol className="space-y-4">
                {events.map((event, index) => (
                  <li key={index} className="flex gap-3">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full', EVENT_DOT[event.action] ?? 'bg-stone-400')} />
                    <div>
                      <p className="text-sm font-medium text-stone-900">{describeEvent(event)}</p>
                      <p className="text-[13px] text-stone-500">
                        {who(event.actorId, event.actorEmail)} · {dateTime(event.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState compact title="No activity yet" />
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pendingCopy.title}
        description={pendingCopy.description}
        confirmLabel={pendingCopy.confirm}
        tone={pending?.kind === 'archive' ? 'danger' : 'default'}
        busy={busy !== ''}
        onConfirm={() => void runPending()}
        onCancel={() => setPending(null)}
      />

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? `${name} — v${viewing.number}` : ''}
        description={viewing ? `${who(viewing.createdBy, viewing.createdByEmail)} · ${dateTime(viewing.createdAt)}${viewing.message ? ` · ${viewing.message}` : ''}` : undefined}
        width="max-w-3xl"
      >
        {viewing && (
          <div className="space-y-3">
            <p className="text-[13px] text-stone-600">
              <span className="font-medium text-stone-800">When to use it:</span> {viewing.description}
            </p>
            <p className="text-[13px] text-stone-600">
              <span className="font-medium text-stone-800">Modes:</span> {viewing.modes.join(', ')}
            </p>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-stone-200 px-4 py-3 custom-scrollbar">
              <MarkdownContent content={viewing.body} />
            </div>
          </div>
        )}
      </Dialog>

      <Toast message={toast} />
    </div>
  );
};
