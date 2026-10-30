import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Lock, MessagesSquare, Plus, SearchX, Sparkles } from 'lucide-react';
import { AskAnswerCard } from '@/components/ask/AskAnswerCard';
import { AskComposer } from '@/components/ask/AskComposer';
import { AskThreadList } from '@/components/ask/AskThreadList';
import { Button, Drawer, EmptyState, InlineAlert, PageHeader, Spinner } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useFacultyChat } from '@/hooks/useFacultyChat';
import { useFacultyThreads } from '@/hooks/useFacultyThreads';
import { facultyChatClient, type FacultyChatClient } from '@/services/facultyChatClient';
import { normalizeContext, type FacultyPageContext } from '@/services/facultyChatContext';
import { facultyChatErrorCopy } from '@/services/facultyChatErrors';
import type { FacultyTurn } from '@/services/facultyChatReducer';
import type { FacultyFeedbackBody, ListedThread } from '@/services/facultyChatWire';

const STARTER_QUESTIONS = [
  'Which students need attention before the next exam, and why?',
  'Which topics did students find hardest this term?',
  'Which learning objectives have no questions yet?',
  'Who hasn’t practised in the last 10 days?',
];

const CONTEXT_PAGES = new Set(['cohort', 'mastery']);
const COHORT_ID = /^[\w:/.~%-]+$/;

/**
 * The context in a link. Anyone can write that link, and the context reaches
 * the agent, so it has to look like what this app puts there: a cohort id and
 * a page name, never words.
 */
export const pageContextFrom = (search: URLSearchParams): FacultyPageContext | null => {
  const cohortId = search.get('cohortId') ?? '';
  const page = search.get('page') ?? '';
  return normalizeContext({
    cohortId: COHORT_ID.test(cohortId) ? cohortId : '',
    page: CONTEXT_PAGES.has(page) ? page : '',
  });
};

/** Refusals that hold for the whole page, not one question. */
const PAGE_REFUSALS = new Set(['forbidden', 'not_configured']);

/** How close to the bottom counts as following along. */
const FOLLOW_THRESHOLD_PX = 120;

interface AskViewProps {
  /** For tests. */
  client?: FacultyChatClient;
}

/**
 * Ask: a tenant admin or owner questions their own institution's data.
 *
 * - `/ask` is a new conversation; `/ask?cohortId=&page=` one about a cohort.
 * - `/ask/:threadId` reopens a conversation. A question from `/ask` moves here
 *   as soon as its thread exists, so a reload keeps the conversation.
 *
 * A running turn is picked up from `activeOperationId` on the thread list, so
 * the conversation waits for the list before it opens: its transcript would
 * otherwise show the half-written answer as finished.
 */
const AskView: React.FC<AskViewProps> = ({ client = facultyChatClient }) => {
  const { threadId: routeThreadId = null } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const list = useFacultyThreads(client);
  const listSettled = list.status !== 'loading';
  const openRow = list.threads.find((thread) => thread.threadId === routeThreadId);

  const chat = useFacultyChat({
    threadId: listSettled ? routeThreadId : null,
    activeOperationId: openRow?.activeOperationId ?? null,
    client,
  });

  const [draft, setDraft] = useState('');
  const [isThreadDrawerOpen, setIsThreadDrawerOpen] = useState(false);

  const cohortTitle = (location.state as { cohortTitle?: string } | null)?.cohortTitle;
  const pageContext = useMemo(() => pageContextFrom(searchParams), [searchParams]);
  const contextLabel = pageContext?.cohortId ? cohortTitle || 'this cohort' : null;

  const { threadId: chatThreadId, activeTurn, send } = chat;
  const { refresh: refreshList } = list;

  // A first question has no thread until the server names one. Only then does
  // the URL follow, carrying the cohort along.
  const awaitingThread = useRef(false);
  useEffect(() => {
    if (!awaitingThread.current || !chatThreadId) return;
    awaitingThread.current = false;
    refreshList();
    navigate(
      { pathname: `/ask/${encodeURIComponent(chatThreadId)}`, search: location.search },
      { replace: true, state: location.state },
    );
  }, [chatThreadId, location.search, location.state, navigate, refreshList]);

  // Follow a streaming answer, unless the dean has scrolled up to read.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);
  const handleScroll = () => {
    const pane = scrollRef.current;
    if (!pane) return;
    followRef.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < FOLLOW_THRESHOLD_PX;
  };

  // The last pass covers the card's footer, which arrives with the ending. It
  // also moves the finished thread up the list and clears its "Answering".
  const wasAnswering = useRef(false);
  useEffect(() => {
    const pane = scrollRef.current;
    if (pane && (activeTurn || wasAnswering.current) && followRef.current) pane.scrollTop = pane.scrollHeight;
    if (activeTurn) {
      wasAnswering.current = true;
    } else if (wasAnswering.current) {
      wasAnswering.current = false;
      refreshList();
    }
  }, [activeTurn, chat.state.turns, refreshList]);

  // A reopened conversation starts at its last question, not the end of its table.
  const { transcript } = chat.state;
  useEffect(() => {
    const pane = scrollRef.current;
    const lastCard = pane?.lastElementChild;
    if (pane && transcript === 'loaded' && lastCard instanceof HTMLElement) pane.scrollTop = lastCard.offsetTop;
  }, [transcript, chatThreadId]);

  const ask = useCallback(
    (question: string) => {
      if (!chatThreadId) awaitingThread.current = true;
      followRef.current = true;
      void send(question, pageContext);
    },
    [chatThreadId, pageContext, send],
  );

  const handleSubmit = () => {
    ask(draft);
    setDraft('');
  };

  const handleAskAgain = useCallback(
    (turn: FacultyTurn) => ask(turn.question.text),
    [ask],
  );

  const handleFeedback = useCallback(
    (body: FacultyFeedbackBody) => client.submitFacultyFeedback(body),
    [client],
  );

  const openThread = (thread: ListedThread) => {
    awaitingThread.current = false;
    setIsThreadDrawerOpen(false);
    navigate(`/ask/${encodeURIComponent(thread.threadId)}`);
  };

  const startNewConversation = useCallback(() => {
    awaitingThread.current = false;
    setIsThreadDrawerOpen(false);
    setDraft('');
    navigate('/ask');
  }, [navigate]);

  const clearContext = () => navigate({ pathname: location.pathname }, { replace: true });

  if (list.error && PAGE_REFUSALS.has(list.error.kind)) {
    return (
      <EmptyState icon={Lock} title="Ask isn’t available" description={facultyChatErrorCopy(list.error)} />
    );
  }

  const threadList = <AskThreadList list={list} activeThreadId={routeThreadId} onOpen={openThread} />;
  const { state, canSend, cancel, retry, dismissError } = chat;
  const isLoading = !listSettled && routeThreadId !== null;
  const isTranscriptLoading = state.transcript === 'loading' || isLoading;
  const isMissing = state.transcript === 'failed' && state.error?.kind === 'not_found';
  const isEmpty = state.turns.length === 0 && !isTranscriptLoading && routeThreadId === null;

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col gap-4 xl:h-[calc(100dvh-7.5rem)]">
      <PageHeader
        title="Ask"
        description="Questions about your curriculum and students, answered from your institution’s data."
        actions={
          <>
            <Button
              variant="ghost"
              icon={MessagesSquare}
              className="lg:hidden"
              onClick={() => setIsThreadDrawerOpen(true)}
            >
              Conversations
            </Button>
            <Button variant="secondary" icon={Plus} onClick={startNewConversation}>
              New question
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 gap-5">
        <aside
          aria-label="Conversations"
          className="hidden w-72 flex-shrink-0 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card lg:flex"
        >
          {threadList}
        </aside>

        <section aria-label="Conversation" className="flex min-w-0 flex-1 flex-col gap-3">
          {state.error && !isMissing && (
            <InlineAlert
              onDismiss={state.transcript === 'failed' ? undefined : dismissError}
              action={
                state.transcript === 'failed' ? (
                  <Button size="sm" variant="secondary" onClick={retry}>
                    Retry
                  </Button>
                ) : undefined
              }
            >
              {facultyChatErrorCopy(state.error)}
            </InlineAlert>
          )}

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="relative min-h-0 flex-1 space-y-6 overflow-y-auto pr-1 custom-scrollbar"
          >
            {isTranscriptLoading && state.turns.length === 0 && (
              <Spinner label="Loading conversation…" className="py-16" />
            )}

            {isMissing && (
              <EmptyState
                icon={SearchX}
                title="That conversation could not be found"
                description="It may belong to another account, or the link may be out of date."
                action={
                  <Button variant="secondary" onClick={startNewConversation}>
                    New question
                  </Button>
                }
              />
            )}

            {isEmpty && (
              <EmptyState
                icon={Sparkles}
                title={contextLabel ? `What would you like to know about ${contextLabel}?` : 'What would you like to know?'}
                description="Each answer shows the data behind it and how it was computed. Only you can see your conversations."
                action={
                  <div className="flex max-w-xl flex-wrap justify-center gap-2">
                    {STARTER_QUESTIONS.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => setDraft(question)}
                        className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-stone-800 shadow-card transition-colors hover:border-stone-300 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                }
              />
            )}

            {state.turns.map((turn) => (
              <AskAnswerCard
                key={turn.key}
                turn={turn}
                onFeedback={handleFeedback}
                onReconnect={retry}
                onAskAgain={canSend ? handleAskAgain : undefined}
                onNewConversation={startNewConversation}
              />
            ))}
          </div>

          <AskComposer
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onStop={() => void cancel()}
            canSend={canSend && !isLoading && !isMissing}
            isAnswering={activeTurn !== null && activeTurn.phase !== 'disconnected'}
            contextLabel={contextLabel}
            onClearContext={clearContext}
          />
        </section>
      </div>

      <Drawer
        open={isThreadDrawerOpen}
        onClose={() => setIsThreadDrawerOpen(false)}
        title="Conversations"
        width="max-w-sm"
      >
        {threadList}
      </Drawer>
    </div>
  );
};

/** Ask, for an account that may use it. Anyone else is sent home, as on the superadmin pages. */
export const AskRoute: React.FC = () => {
  const { canAsk, isSuperadmin } = useAuth();
  return canAsk ? <AskView /> : <Navigate to={isSuperadmin ? '/tenants' : '/faculty'} replace />;
};

export default AskView;
