/**
 * One faculty conversation, driven: the client and the reducer wired together.
 *
 * Framework-free so it can be tested in node; `hooks/useFacultyChat.ts` is a
 * thin React binding over it (`useSyncExternalStore`).
 *
 * ## Reading a turn is not owning it
 *
 * A turn runs on agent-v2 whether or not anyone is reading its stream. So
 * {@link FacultyChatController.detach} (unmount, thread switch) only stops
 * reading; it never cancels. Only {@link FacultyChatController.cancel} does.
 *
 * ## Resuming
 *
 * A turn is re-attached from what the controller knows, in this order:
 *
 * 1. **The same controller** (an effect re-run, a StrictMode double mount, a
 *    `threadId` prop catching up with the thread the first turn created): its
 *    state still holds the turn and its cursor, so the stream resumes from
 *    `Last-Event-ID` with nothing replayed.
 * 2. **A fresh controller in the same tab** (the page was left and reopened):
 *    a module-level map remembers which operation was in flight per thread.
 *    The transcript is reloaded without that turn's answer, and the stream is
 *    replayed from its start into it.
 * 3. **Another tab or a reload:** the page passes `ListedThread.activeOperationId`
 *    from `GET /v1/threads`, and (2) follows.
 *
 * The map is memory, not browser storage: what is actually running is the
 * server's to say (`activeOperationId`), and this is only a shortcut to it.
 */

import { facultyChatClient, type FacultyChatClient } from './facultyChatClient';
import { normalizeContext, type FacultyPageContext } from './facultyChatContext';
import { isAbortError, toFacultyChatError } from './facultyChatErrors';
import {
  activeTurnOf,
  canSend,
  facultyChatReducer,
  initialFacultyChatState,
  type FacultyChatAction,
  type FacultyChatState,
  type FacultyTurn,
} from './facultyChatReducer';
import type { CreatedTurn } from './facultyChatWire';

/** threadId → operationId of the turn this tab last saw running there. */
const inFlightByThread = new Map<string, string>();

/** For tests. */
export const forgetInFlightTurns = (): void => inFlightByThread.clear();

/** The operation this tab believes is still running on a thread, if any. */
export const inFlightTurnFor = (threadId: string): string | null => inFlightByThread.get(threadId) ?? null;

const forgetOperation = (operationId: string): void => {
  for (const [threadId, id] of inFlightByThread) {
    if (id === operationId) inFlightByThread.delete(threadId);
  }
};

export interface FacultyChatControllerOptions {
  readonly client?: FacultyChatClient;
  /** The clock for a question's `askedAt`. */
  readonly now?: () => string;
  /** Defaults to `crypto.randomUUID()`; `null` lets the server mint the id. */
  readonly newOperationId?: () => string | null;
}

export interface OpenOptions {
  /** The conversation to show; `null` for a new one. */
  readonly threadId?: string | null;
  /** `ListedThread.activeOperationId`: a turn still running there. */
  readonly activeOperationId?: string | null;
}

let localKeys = 0;

const defaultNewOperationId = (): string | null => {
  const crypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : null;
};

export class FacultyChatController {
  private state: FacultyChatState = initialFacultyChatState();
  private readonly listeners = new Set<() => void>();
  private readonly client: FacultyChatClient;
  private readonly now: () => string;
  private readonly newOperationId: () => string | null;

  /** The stream being read, and for which operation. */
  private streamAbort: AbortController | null = null;
  private streamOperation: string | null = null;
  private loadAbort: AbortController | null = null;
  /** Bumped on every thread switch; async results from an older one are dropped. */
  private generation = 0;
  /** Turn keys whose stop was pressed before the POST came back. */
  private readonly pendingCancel = new Set<string>();
  /** Set by `detach`, cleared by `open`: an unmounted controller starts no streams. */
  private detached = false;

  constructor(options: FacultyChatControllerOptions = {}) {
    this.client = options.client ?? facultyChatClient;
    this.now = options.now ?? (() => new Date().toISOString());
    this.newOperationId = options.newOperationId ?? defaultNewOperationId;
  }

  // --- store ---------------------------------------------------------------

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getState = (): FacultyChatState => this.state;

  private dispatch(action: FacultyChatAction): void {
    const next = facultyChatReducer(this.state, action);
    if (next === this.state) return;
    this.state = next;
    for (const listener of [...this.listeners]) listener();
  }

  private findTurn(operationId: string): FacultyTurn | undefined {
    return this.state.turns.find((turn) => turn.operationId === operationId);
  }

  // --- lifecycle -----------------------------------------------------------

  /**
   * Show a conversation. Idempotent for the one already shown: then it only
   * makes sure a turn in flight is being read.
   */
  readonly open = ({ threadId = null, activeOperationId = null }: OpenOptions = {}): void => {
    this.detached = false;
    const target = threadId?.trim() || null;
    const active = activeOperationId?.trim() || null;

    if (target !== null && target === this.state.threadId && this.state.transcript !== 'failed') {
      this.resumeInFlight(active);
      return;
    }
    if (target === null && this.state.threadId === null && this.state.turns.length === 0) return;

    this.stopStream();
    this.loadAbort?.abort();
    this.loadAbort = null;
    this.pendingCancel.clear();
    this.generation += 1;
    this.dispatch({ type: 'thread.opened', threadId: target });

    if (target !== null) void this.loadThread(target, active ?? inFlightTurnFor(target), this.generation);
  };

  /** Stop reading (unmount). The turn keeps running; `open` picks it up again. */
  readonly detach = (): void => {
    this.detached = true;
    this.stopStream();
  };

  /** A new, empty conversation. */
  readonly startNewThread = (): void => this.open({ threadId: null });

  readonly dismissError = (): void => this.dispatch({ type: 'error.dismissed' });

  /** Re-attach a turn whose stream was lost, or reload a transcript that failed. */
  readonly retry = (): void => {
    this.detached = false;
    const active = activeTurnOf(this.state);
    if (active?.operationId && active.phase !== 'submitting') {
      this.attach(active.operationId, true);
      return;
    }
    if (this.state.transcript === 'failed' && this.state.threadId) {
      this.generation += 1;
      void this.loadThread(this.state.threadId, inFlightTurnFor(this.state.threadId), this.generation);
    }
  };

  private async loadThread(threadId: string, activeOperationId: string | null, generation: number): Promise<void> {
    const abort = new AbortController();
    this.loadAbort?.abort();
    this.loadAbort = abort;
    this.dispatch({ type: 'transcript.loading' });

    try {
      const response = await this.client.getThreadMessages(threadId, { signal: abort.signal });
      if (generation !== this.generation) return;
      this.dispatch({
        type: 'transcript.loaded',
        threadId,
        messages: Array.isArray(response?.messages) ? response.messages : [],
        activeOperationId,
      });
      this.resumeInFlight(activeOperationId);
    } catch (error) {
      if (generation !== this.generation || isAbortError(error, abort.signal)) return;
      this.dispatch({ type: 'transcript.failed', error: toFacultyChatError(error).toInfo() });
    } finally {
      if (this.loadAbort === abort) this.loadAbort = null;
    }
  }

  /** Read whichever turn here is still running: one this state holds, else the one named. */
  private resumeInFlight(activeOperationId: string | null): void {
    if (this.detached) return;
    const active = activeTurnOf(this.state);
    if (active?.operationId && active.phase !== 'submitting') {
      this.attach(active.operationId, false);
      return;
    }
    if (activeOperationId && this.findTurn(activeOperationId)?.phase !== 'done') {
      this.attach(activeOperationId, false);
    }
  }

  // --- streaming -------------------------------------------------------------

  private stopStream(): void {
    this.streamAbort?.abort();
    this.streamAbort = null;
    this.streamOperation = null;
  }

  /**
   * Read a turn's stream from the cursor this state holds for it (or from the
   * start). `force` reopens even if a read is already running.
   */
  private attach(operationId: string, force: boolean): void {
    if (this.detached) return;
    if (!force && this.streamOperation === operationId && this.streamAbort && !this.streamAbort.signal.aborted) return;

    this.stopStream();
    const abort = new AbortController();
    this.streamAbort = abort;
    this.streamOperation = operationId;

    this.dispatch({ type: 'turn.attached', operationId });
    const lastEventId = this.findTurn(operationId)?.lastEventId ?? null;
    if (this.state.threadId) inFlightByThread.set(this.state.threadId, operationId);

    void this.pump(operationId, lastEventId, abort);
  }

  private async pump(operationId: string, lastEventId: string | null, abort: AbortController): Promise<void> {
    try {
      for await (const item of this.client.streamTurn(operationId, { lastEventId, signal: abort.signal })) {
        if (abort.signal.aborted) return;
        this.dispatch({ type: 'stream.item', operationId, item });
      }
    } catch (error) {
      if (isAbortError(error, abort.signal)) return;
      this.dispatch({ type: 'stream.lost', operationId, error: toFacultyChatError(error).toInfo() });
    } finally {
      if (this.streamAbort === abort) {
        this.streamAbort = null;
        this.streamOperation = null;
      }
      if (this.findTurn(operationId)?.phase === 'done') forgetOperation(operationId);
    }
  }

  // --- asking and stopping ---------------------------------------------------

  /**
   * Ask a question in this conversation (a new one if there is none yet).
   * Resolves `true` once the turn is accepted; `false` when it could not be
   * sent (busy, blank, or refused: the refusal is on the turn as `rejected`).
   */
  readonly send = async (text: string, context: FacultyPageContext | null = null): Promise<boolean> => {
    const question = typeof text === 'string' ? text.trim() : '';
    if (!question || !canSend(this.state)) return false;

    this.detached = false;
    const generation = this.generation;
    const operationId = this.newOperationId();
    const key = operationId ?? `local-${String((localKeys += 1))}`;
    const pageContext = normalizeContext(context);

    this.dispatch({ type: 'turn.submitted', key, operationId, text: question, context: pageContext, at: this.now() });

    let created: CreatedTurn;
    try {
      created = await this.client.createFacultyTurn({
        threadId: this.state.threadId,
        text: question,
        context: pageContext,
        ...(operationId ? { operationId } : {}),
      });
    } catch (error) {
      this.pendingCancel.delete(key);
      if (generation === this.generation) {
        this.dispatch({ type: 'turn.rejected', key, error: toFacultyChatError(error).toInfo() });
      }
      return false;
    }

    // Remembered even if the dean has moved on: reopening that thread finds it.
    inFlightByThread.set(created.threadId, created.operationId);
    if (generation !== this.generation) return true;

    this.dispatch({ type: 'turn.accepted', key, operationId: created.operationId, threadId: created.threadId });
    this.attach(created.operationId, false);
    if (this.pendingCancel.delete(key)) await this.cancelOperation(created.operationId);
    return true;
  };

  /** Stop the turn in flight. The ending arrives on the stream as `cancelled`. */
  readonly cancel = async (): Promise<void> => {
    const turn = activeTurnOf(this.state);
    if (!turn || turn.phase === 'cancelling') return;
    this.dispatch({ type: 'turn.cancel_requested', key: turn.key });
    if (turn.phase === 'submitting' || !turn.operationId) {
      this.pendingCancel.add(turn.key);
      return;
    }
    await this.cancelOperation(turn.operationId);
  };

  private async cancelOperation(operationId: string): Promise<void> {
    try {
      const result = await this.client.cancelTurn(operationId);
      this.dispatch({ type: 'turn.cancel_settled', operationId, result });
      if (this.findTurn(operationId)?.phase === 'done') forgetOperation(operationId);
    } catch (error) {
      this.dispatch({ type: 'turn.cancel_failed', operationId, error: toFacultyChatError(error).toInfo() });
    }
  }
}
