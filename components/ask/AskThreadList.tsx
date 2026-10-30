import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { MessagesSquare } from 'lucide-react';
import { Badge, Button, EmptyState, InlineAlert, Spinner, cn } from '@/components/ui';
import type { UseFacultyThreadsResult } from '@/hooks/useFacultyThreads';
import { threadTitleOf } from '@/services/facultyChatContext';
import { facultyChatErrorCopy } from '@/services/facultyChatErrors';
import type { ListedThread } from '@/services/facultyChatWire';

interface AskThreadListProps {
  list: UseFacultyThreadsResult;
  activeThreadId: string | null;
  onOpen: (thread: ListedThread) => void;
}

const lastActiveLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDistanceToNowStrict(date, { addSuffix: true });
};

/** The dean's own conversations. Private to them, and never in their learner chats (plan §2.1). */
export const AskThreadList: React.FC<AskThreadListProps> = ({ list, activeThreadId, onOpen }) => {
  if (list.status === 'loading') {
    return <Spinner label="Loading conversations…" className="py-10" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {list.error && (
        <InlineAlert
          className="m-2"
          action={
            <Button size="sm" variant="secondary" onClick={list.refresh}>
              Retry
            </Button>
          }
        >
          {facultyChatErrorCopy(list.error)}
        </InlineAlert>
      )}
      {list.threads.length === 0 && !list.error ? (
        <EmptyState
          compact
          icon={MessagesSquare}
          title="No conversations yet"
          description="Your questions will be listed here. Only you can see them."
        />
      ) : (
        <ul aria-label="Your conversations" className="min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto custom-scrollbar">
          {list.threads.map((thread) => {
            const active = thread.threadId === activeThreadId;
            const lastActive = lastActiveLabel(thread.lastTurnAt);
            return (
              <li key={thread.threadId}>
                <button
                  type="button"
                  onClick={() => onOpen(thread)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'block w-full px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                    active ? 'bg-stone-100' : 'hover:bg-stone-50',
                  )}
                >
                  <span dir="auto" className="line-clamp-2 break-words text-sm font-medium text-stone-900">
                    {threadTitleOf(thread.title) || 'Untitled conversation'}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-stone-500">
                    {thread.activeOperationId ? (
                      <Badge tone="blue" dot>
                        Answering
                      </Badge>
                    ) : (
                      lastActive
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list.hasMore && (
        <div className="border-t border-stone-100 p-2">
          <Button
            size="sm"
            variant="ghost"
            className="w-full"
            loading={list.isLoadingMore}
            onClick={list.loadMore}
          >
            Show older
          </Button>
        </div>
      )}
    </div>
  );
};
