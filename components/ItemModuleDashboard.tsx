import React, { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArrowUpRight, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { Question, Issue, ItemType } from '../types';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Menu,
  ProgressBar,
  StatusDot,
  cn,
  type BadgeTone,
} from '@/components/ui';
import { ITEM_TYPE_SPEC } from '@/components/workbench/itemTypes';

interface ItemModuleDashboardProps {
  onCreateClick: () => void;
  onViewAllClick: () => void;
  onEditClick: (question: Question) => void;
  onDelete: (id: string) => void | Promise<void>;
  onIssueClick: (issue: Issue) => void;
  onItemClick?: (question: Question) => void;
  questions: Question[];
  totalQuestions?: number;
  totalDraftQuestions?: number;
  totalLiveQuestions?: number;
  issues: Issue[];
  itemType: ItemType;
}

const PAGE_SIZE = 10;

const STATUS: Record<Question['status'], { label: string; tone: BadgeTone }> = {
  Published: { label: 'Live', tone: 'green' },
  Draft: { label: 'Draft', tone: 'neutral' },
  Archived: { label: 'Archived', tone: 'neutral' },
};

const SEVERITY_TONE: Record<Issue['severity'], BadgeTone> = {
  High: 'red',
  Medium: 'amber',
  Low: 'neutral',
};

const relativeTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : formatDistanceToNowStrict(date, { addSuffix: true });
};

interface FigureProps {
  label: string;
  value: number;
  detail?: React.ReactNode;
  children?: React.ReactNode;
}

const Figure: React.FC<FigureProps> = ({ label, value, detail, children }) => (
  <div className="min-w-0 p-5">
    <p className="text-[13px] text-stone-500">{label}</p>
    <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] text-stone-900 tabular-nums">
      {value.toLocaleString()}
    </p>
    {detail && <p className="mt-2 text-xs text-stone-500">{detail}</p>}
    {children}
  </div>
);

/** The workbench's Items tab: bank figures for one item type and its recent items. */
const ItemModuleDashboard: React.FC<ItemModuleDashboardProps> = ({
  onCreateClick,
  onViewAllClick,
  onEditClick,
  onDelete,
  onIssueClick,
  onItemClick,
  questions,
  totalQuestions,
  totalDraftQuestions,
  totalLiveQuestions,
  issues,
  itemType,
}) => {
  const spec = ITEM_TYPE_SPEC[itemType];
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingDelete, setPendingDelete] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const total = totalQuestions ?? questions.length;
  const live = totalLiveQuestions ?? 0;
  const drafts = totalDraftQuestions ?? 0;
  const activeIssues = issues.filter((issue) => issue.status === 'Open').slice(0, 5);
  const visibleQuestions = questions.slice(0, visibleCount);

  const openItem = (question: Question) =>
    onItemClick ? onItemClick(question) : onEditClick(question);

  const confirmDelete = async () => {
    const identifier = pendingDelete?.identifier;
    if (!identifier) return;
    setIsDeleting(true);
    try {
      await onDelete(identifier);
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bank figures for this type */}
      <div
        className={cn(
          'grid divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card sm:divide-x sm:divide-y-0',
          issues.length > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
        )}
      >
        <Figure label={`${spec.plural} in the bank`} value={total} detail={spec.description} />
        <Figure
          label="Live"
          value={live}
          detail={total > 0 ? `${Math.round((live / total) * 100)}% of ${spec.plural}` : 'None yet'}
        >
          <ProgressBar value={live} max={total} className="mt-3" label={`Live ${spec.plural}`} />
        </Figure>
        <Figure label="Drafts" value={drafts} detail="Draft or pending review" />
        {issues.length > 0 && (
          <Figure label="Open issues" value={issues.filter((issue) => issue.status === 'Open').length} />
        )}
      </div>

      {activeIssues.length > 0 && (
        <section aria-labelledby="workbench-open-issues">
          <h3 id="workbench-open-issues" className="mb-3 text-[15px] font-semibold text-stone-900">
            Open issues
          </h3>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
            {activeIssues.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  onClick={() => onIssueClick(issue)}
                  className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-stone-900">{issue.title}</span>
                    <span className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-stone-500">
                      {issue.description}
                    </span>
                  </span>
                  <StatusDot tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</StatusDot>
                  <ChevronRight
                    size={16}
                    className="mt-0.5 flex-shrink-0 text-stone-300 transition-colors group-hover:text-stone-500"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent items */}
      <section
        aria-labelledby="workbench-recent-items"
        className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <div className="min-w-0">
            <h3 id="workbench-recent-items" className="text-[15px] font-semibold text-stone-900">
              Recent {spec.plural}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" iconRight={ArrowUpRight} onClick={onViewAllClick}>
              View all in item bank
            </Button>
            <Button size="sm" icon={Plus} onClick={onCreateClick}>
              New {spec.label}
            </Button>
          </div>
        </div>

        {questions.length === 0 ? (
          <EmptyState
            icon={spec.icon}
            title={`No ${spec.plural} yet`}
            description={`Write your first ${spec.label} here. Everything you save goes to your item bank.`}
            action={
              <Button variant="primary" icon={Plus} onClick={onCreateClick}>
                New {spec.label}
              </Button>
            }
          />
        ) : (
          <>
            <div
              aria-hidden="true"
              className="hidden items-center gap-4 border-b border-stone-100 bg-stone-50/60 py-2 pl-4 pr-10 text-xs font-medium text-stone-500 sm:flex"
            >
              <span className="flex-1">{spec.textLabel}</span>
              <span className="w-20">Status</span>
              <span className="hidden w-28 text-right md:block">Created</span>
            </div>
            <ul className="divide-y divide-stone-100">
              {visibleQuestions.map((question) => {
                const status = STATUS[question.status] ?? STATUS.Draft;
                const created = relativeTime(question.createdAt);
                const title = question.text.trim();
                return (
                  <li
                    key={question.id}
                    className="group flex items-center gap-1 pr-2 transition-colors hover:bg-stone-50"
                  >
                    <button
                      type="button"
                      onClick={() => openItem(question)}
                      className="flex min-w-0 flex-1 items-center gap-4 py-3 pl-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'line-clamp-2 text-sm leading-5',
                            title ? 'text-stone-900' : 'text-stone-400',
                          )}
                        >
                          {title || `Untitled ${spec.label}`}
                        </span>
                        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-stone-500">
                          <span className="truncate font-mono text-stone-400">
                            {question.identifier || question.id.slice(0, 8)}
                          </span>
                          {question.tags.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{question.tags.slice(0, 3).join(', ')}</span>
                            </>
                          )}
                          {created && (
                            <span className="flex-shrink-0 md:hidden">
                              <span aria-hidden="true">· </span>
                              {created}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="w-20 flex-shrink-0">
                        <StatusDot tone={status.tone}>{status.label}</StatusDot>
                      </span>
                      <span className="hidden w-28 flex-shrink-0 text-right text-xs text-stone-500 md:block">
                        {created}
                      </span>
                    </button>
                    <Menu
                      size="sm"
                      label={`Actions for ${spec.label} ${question.identifier || ''}`.trim()}
                      items={[
                        {
                          label: 'Edit',
                          icon: Pencil,
                          onSelect: () => onEditClick(question),
                        },
                        {
                          label: 'Delete',
                          icon: Trash2,
                          tone: 'danger',
                          disabled: !question.identifier,
                          hint: question.identifier ? undefined : 'This item has no identifier yet',
                          onSelect: () => setPendingDelete(question),
                        },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-2.5 text-[13px] text-stone-500">
              <span className="tabular-nums">
                Showing {visibleQuestions.length.toLocaleString()} of {total.toLocaleString()}
              </span>
              {visibleCount < questions.length ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Show more
                </Button>
              ) : total > questions.length ? (
                <Button variant="ghost" size="sm" iconRight={ArrowUpRight} onClick={onViewAllClick}>
                  See the rest in the item bank
                </Button>
              ) : null}
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete this ${spec.label}?`}
        description={
          <>
            {pendingDelete?.text.trim() && (
              <span className="mb-2 line-clamp-2 block font-medium text-stone-900">
                {pendingDelete.text.trim()}
              </span>
            )}
            It will be permanently removed from the item bank. This can't be undone.
          </>
        }
        confirmLabel={`Delete ${spec.label}`}
        busy={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default ItemModuleDashboard;
