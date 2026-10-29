import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import type { FacultyChatClient } from '@/services/facultyChatClient';
import type { FacultyPageContext } from '@/services/facultyChatContext';
import { FacultyChatController } from '@/services/facultyChatController';
import {
  activeTurnOf,
  canSend,
  type FacultyChatState,
  type FacultyTurn,
} from '@/services/facultyChatReducer';

export interface UseFacultyChatOptions {
  /** The faculty conversation to show; `null`/absent for a new one. */
  readonly threadId?: string | null;
  /** `ListedThread.activeOperationId` for that thread, so a running answer is picked up. */
  readonly activeOperationId?: string | null;
  /** For tests and stories. Read once, on first render. */
  readonly client?: FacultyChatClient;
}

export interface UseFacultyChatResult {
  readonly state: FacultyChatState;
  /** The conversation id, including one the first question just created (put it in the URL). */
  readonly threadId: string | null;
  /** The turn being answered (or whose stream was lost), if any. */
  readonly activeTurn: FacultyTurn | null;
  readonly canSend: boolean;
  /** Ask. Resolves `true` once accepted; a refusal lands on the turn as `outcome: 'rejected'`. */
  readonly send: (text: string, context?: FacultyPageContext | null) => Promise<boolean>;
  /** Stop the answer in flight. */
  readonly cancel: () => Promise<void>;
  /** Reconnect a lost answer, or reload a transcript that failed. */
  readonly retry: () => void;
  readonly startNewThread: () => void;
  readonly dismissError: () => void;
}

/**
 * The faculty "Ask" chat for one conversation: send, stream, stop, resume.
 *
 * State lives in a {@link FacultyChatController} (one per component), read
 * with `useSyncExternalStore`. Unmounting stops reading the stream but never
 * cancels the turn; remounting, or passing the `threadId` the first question
 * created, picks the answer up where it was. See `facultyChatController.ts`.
 */
export function useFacultyChat({
  threadId = null,
  activeOperationId = null,
  client,
}: UseFacultyChatOptions = {}): UseFacultyChatResult {
  const controllerRef = useRef<FacultyChatController | null>(null);
  if (controllerRef.current === null) controllerRef.current = new FacultyChatController({ client });
  const controller = controllerRef.current;

  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => {
    controller.open({ threadId, activeOperationId });
    return () => controller.detach();
  }, [controller, threadId, activeOperationId]);

  return useMemo(
    () => ({
      state,
      threadId: state.threadId,
      activeTurn: activeTurnOf(state),
      canSend: canSend(state),
      send: controller.send,
      cancel: controller.cancel,
      retry: controller.retry,
      startNewThread: controller.startNewThread,
      dismissError: controller.dismissError,
    }),
    [state, controller],
  );
}
