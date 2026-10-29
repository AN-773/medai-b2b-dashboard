import { beforeEach, describe, expect, it } from 'vitest';

import { ev, helloTurn, OP, scriptedClient, settle, THREAD } from './facultyChatFakes';

import type { FacultyStreamItem } from '../facultyChatClient';
import { FacultyChatController, forgetInFlightTurns, inFlightTurnFor } from '../facultyChatController';
import { FacultyChatError } from '../facultyChatErrors';
import { answerTextOf } from '../facultyChatReducer';
import type { FacultyStreamEvent, TranscriptMessageView } from '../facultyChatWire';

const event = (e: FacultyStreamEvent): FacultyStreamItem => ({ kind: 'event', event: e, id: String(e.seq) });

const controllerWith = (fake: ReturnType<typeof scriptedClient>) =>
  new FacultyChatController({ client: fake.client, newOperationId: () => OP, now: () => 'now' });

beforeEach(() => forgetInFlightTurns());

describe('FacultyChatController', () => {
  it('sends a first question, starts a thread, and reads the answer to its end', async () => {
    const fake = scriptedClient();
    const chat = controllerWith(fake);
    let notified = 0;
    chat.subscribe(() => (notified += 1));
    chat.open({ threadId: null });

    const sent = chat.send('Who needs attention?', { cohortId: 'c_1' });
    expect(chat.getState().turns[0].phase).toBe('submitting');
    await expect(sent).resolves.toBe(true);

    expect(fake.calls.create).toEqual([
      { threadId: null, text: 'Who needs attention?', context: { cohortId: 'c_1' }, operationId: OP },
    ]);
    expect(chat.getState().threadId).toBe(THREAD);
    expect(fake.streams).toHaveLength(1);
    expect(fake.streams[0].options.lastEventId).toBeNull();
    expect(inFlightTurnFor(THREAD)).toBe(OP);

    fake.streams[0].queue.push(...helloTurn().map(event));
    fake.streams[0].queue.close();
    await settle();

    const [turn] = chat.getState().turns;
    expect(turn).toMatchObject({ phase: 'done', outcome: 'completed' });
    expect(answerTextOf(turn)).toBe('Hello');
    expect(inFlightTurnFor(THREAD)).toBeNull();
    expect(notified).toBeGreaterThan(3);
  });

  it('refuses a second question while one is in flight, and a blank one', async () => {
    const fake = scriptedClient();
    const chat = controllerWith(fake);
    await chat.send('First');
    await expect(chat.send('Second')).resolves.toBe(false);
    await expect(chat.send('   ')).resolves.toBe(false);
    expect(fake.calls.create).toHaveLength(1);
  });

  it('a refused POST becomes a rejected turn with the typed error', async () => {
    const fake = scriptedClient();
    fake.replies.create = async () => {
      throw new FacultyChatError('forbidden', 'no', { status: 403, code: 'faculty_forbidden' });
    };
    const chat = controllerWith(fake);
    await expect(chat.send('Hi')).resolves.toBe(false);
    expect(chat.getState().turns[0]).toMatchObject({
      phase: 'done',
      outcome: 'rejected',
      error: { kind: 'forbidden', code: 'faculty_forbidden' },
    });
    expect(fake.streams).toHaveLength(0);
  });

  it('detaching stops reading without cancelling; reopening resumes from the cursor', async () => {
    const fake = scriptedClient();
    const chat = controllerWith(fake);
    await chat.send('Hi');
    fake.streams[0].queue.push(...helloTurn().slice(0, 3).map(event));
    await settle();

    chat.detach();
    expect(fake.streams[0].options.signal?.aborted).toBe(true);
    expect(fake.calls.cancel).toEqual([]);

    // The page catches up with the thread the first question created.
    chat.open({ threadId: THREAD });
    expect(fake.calls.messages).toEqual([]); // nothing reloaded: this controller holds the thread
    expect(fake.streams).toHaveLength(2);
    expect(fake.streams[1].options.lastEventId).toBe('2');

    fake.streams[1].queue.push(...helloTurn().slice(3).map(event));
    fake.streams[1].queue.close();
    await settle();
    expect(answerTextOf(chat.getState().turns[0])).toBe('Hello');
  });

  it('a fresh controller re-attaches a turn this tab saw running, replaying it into the reloaded transcript', async () => {
    const first = scriptedClient();
    const before = controllerWith(first);
    await before.send('And why?');
    before.detach(); // the page was left mid-answer

    const fake = scriptedClient();
    const transcript: TranscriptMessageView[] = [
      {
        messageId: 'u1',
        role: 'user',
        content: 'And why?',
        operationId: OP,
        stepIndex: null,
        ordinal: 0,
        finishReason: null,
        toolCalls: null,
        toolCallId: null,
        anchorMessageId: null,
        createdAt: 'then',
      },
      {
        messageId: 'm1',
        role: 'assistant',
        content: 'Hel',
        operationId: OP,
        stepIndex: 0,
        ordinal: 1,
        finishReason: null,
        toolCalls: null,
        toolCallId: null,
        anchorMessageId: null,
        createdAt: 'then',
      },
    ];
    fake.replies.messages = async (threadId) => ({ threadId, messages: transcript as never[] });

    const after = controllerWith(fake);
    after.open({ threadId: THREAD });
    expect(after.getState().transcript).toBe('loading');
    await settle();

    expect(fake.calls.messages).toEqual([THREAD]);
    expect(fake.streams).toHaveLength(1);
    expect(fake.streams[0].operationId).toBe(OP);
    expect(fake.streams[0].options.lastEventId).toBeNull(); // replay from the start
    expect(after.getState().turns[0]).toMatchObject({ question: { text: 'And why?' }, messages: [] });

    fake.streams[0].queue.push(...helloTurn().map(event));
    fake.streams[0].queue.close();
    await settle();
    expect(after.getState().turns).toHaveLength(1);
    expect(answerTextOf(after.getState().turns[0])).toBe('Hello');
  });

  it("attaches the page's activeOperationId (another tab's turn) after loading the transcript", async () => {
    const fake = scriptedClient();
    const chat = controllerWith(fake);
    chat.open({ threadId: THREAD, activeOperationId: 'op-from-list' });
    await settle();
    expect(fake.streams.map((stream) => stream.operationId)).toEqual(['op-from-list']);
  });

  it('a stop pressed before the POST returns is sent once the turn is accepted', async () => {
    const fake = scriptedClient();
    let accept: () => void = () => undefined;
    const original = fake.replies.create;
    fake.replies.create = (input) =>
      new Promise((resolve) => {
        accept = () => resolve(original(input));
      });

    const chat = controllerWith(fake);
    const sent = chat.send('Hi');
    await chat.cancel();
    expect(chat.getState().turns[0].phase).toBe('cancelling');
    expect(fake.calls.cancel).toEqual([]);

    accept();
    await sent;
    expect(fake.calls.cancel).toEqual([OP]);

    fake.streams[0].queue.push(event(ev(0, 'turn.completed', { reason: 'cancelled' })));
    fake.streams[0].queue.close();
    await settle();
    expect(chat.getState().turns[0]).toMatchObject({ phase: 'done', outcome: 'cancelled' });
  });

  it('a lost stream leaves the turn disconnected; retry re-attaches from the cursor', async () => {
    const fake = scriptedClient();
    const chat = controllerWith(fake);
    await chat.send('Hi');
    fake.streams[0].queue.push(...helloTurn().slice(0, 2).map(event));
    fake.streams[0].queue.fail(new FacultyChatError('stream_lost', 'gone'));
    await settle();

    expect(chat.getState().turns[0]).toMatchObject({ phase: 'disconnected', error: { kind: 'stream_lost' } });

    chat.retry();
    expect(fake.streams).toHaveLength(2);
    expect(fake.streams[1].options.lastEventId).toBe('1');
    expect(chat.getState().turns[0]).toMatchObject({ phase: 'streaming', error: null });
  });

  it('an unmounted controller registers an accepted turn but opens no stream', async () => {
    const fake = scriptedClient();
    let accept: () => void = () => undefined;
    const original = fake.replies.create;
    fake.replies.create = (input) =>
      new Promise((resolve) => {
        accept = () => resolve(original(input));
      });

    const chat = controllerWith(fake);
    const sent = chat.send('Hi');
    chat.detach();
    accept();
    await sent;

    expect(fake.streams).toHaveLength(0);
    expect(inFlightTurnFor(THREAD)).toBe(OP);
  });

  it('switching to a new conversation stops reading the old one and clears the state', async () => {
    const fake = scriptedClient();
    const chat = controllerWith(fake);
    await chat.send('Hi');
    chat.startNewThread();
    expect(fake.streams[0].options.signal?.aborted).toBe(true);
    expect(fake.calls.cancel).toEqual([]);
    expect(chat.getState()).toMatchObject({ threadId: null, turns: [] });
    expect(inFlightTurnFor(THREAD)).toBe(OP);
  });
});
