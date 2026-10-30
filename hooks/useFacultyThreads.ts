import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { facultyChatClient, type FacultyChatClient } from '@/services/facultyChatClient';
import { isAbortError, toFacultyChatError, type FacultyChatErrorInfo } from '@/services/facultyChatErrors';
import type { ListedThread } from '@/services/facultyChatWire';

const THREAD_PAGE_SIZE = 50;

export interface UseFacultyThreadsResult {
  readonly threads: readonly ListedThread[];
  readonly status: 'loading' | 'ready' | 'failed';
  readonly error: FacultyChatErrorInfo | null;
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  /** Reload the first page. Keeps showing what it has meanwhile. */
  readonly refresh: () => void;
  readonly loadMore: () => void;
}

interface ThreadListState {
  readonly threads: readonly ListedThread[];
  readonly status: UseFacultyThreadsResult['status'];
  readonly error: FacultyChatErrorInfo | null;
  readonly nextCursor: string | null;
  readonly isLoadingMore: boolean;
}

/** The dean's own conversations, newest first (`GET /v1/threads?surface=faculty`). */
export function useFacultyThreads(client: FacultyChatClient = facultyChatClient): UseFacultyThreadsResult {
  const [state, setState] = useState<ThreadListState>({
    threads: [],
    status: 'loading',
    error: null,
    nextCursor: null,
    isLoadingMore: false,
  });
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (cursor: string | null) => {
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      try {
        const page = await client.listFacultyThreads({
          limit: THREAD_PAGE_SIZE,
          cursor,
          signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        setState((current) => ({
          threads: cursor === null ? page.threads : [...current.threads, ...page.threads],
          status: 'ready',
          error: null,
          nextCursor: page.nextCursor,
          isLoadingMore: false,
        }));
      } catch (error) {
        if (isAbortError(error, abort.signal)) return;
        const info = toFacultyChatError(error).toInfo();
        setState((current) => ({ ...current, status: 'failed', error: info, isLoadingMore: false }));
      }
    },
    [client],
  );

  useEffect(() => {
    void load(null);
    return () => abortRef.current?.abort();
  }, [load]);

  const refresh = useCallback(() => {
    void load(null);
  }, [load]);

  const { nextCursor } = state;
  const loadMore = useCallback(() => {
    if (nextCursor === null) return;
    setState((current) => ({ ...current, isLoadingMore: true }));
    void load(nextCursor);
  }, [load, nextCursor]);

  return useMemo(
    () => ({
      threads: state.threads,
      status: state.status,
      error: state.error,
      hasMore: state.nextCursor !== null,
      isLoadingMore: state.isLoadingMore,
      refresh,
      loadMore,
    }),
    [state, refresh, loadMore],
  );
}
