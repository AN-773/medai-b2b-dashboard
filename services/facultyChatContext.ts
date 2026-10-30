/**
 * Page context for a faculty question ("Ask about this cohort").
 *
 * It travels as the typed `facultyContext` field of `POST /v1/turns` (FAG-5):
 *
 * - **Identifiers only, no display names.** A free-text name is prompt text a
 *   dean did not type; the agent resolves the cohort from its id.
 * - **A hint, never an authorisation.** The dean could type the same thing.
 *   Tenancy is enforced by the database views and the signed tenant token
 *   (plan §3.2), not by anything a client says.
 *
 * It used to be folded into `message` as a `<dashboard_context>` trailer after
 * the dean's words. {@link splitFoldedContext} stays, to read threads written
 * that way.
 */

import { MAX_IDENTIFIER_CHARS } from './facultyChatWire';

/** Where on the dashboard a question was asked from. Every field is optional. */
export interface FacultyPageContext {
  /** The cohort the dean was looking at. */
  readonly cohortId?: string;
  /** Which page: `cohort`, `mastery`, ... Wording only. */
  readonly page?: string;
}

/** Only these keys are sent, and only these are read back (an older trailer's other keys are dropped). */
const CONTEXT_KEYS = ['cohortId', 'page'] as const;

/** The retired trailer: `\n\n<dashboard_context>{json}</dashboard_context>`. */
const OPEN_TAG = '<dashboard_context>';
const CLOSE_TAG = '</dashboard_context>';
const SEPARATOR = '\n\n';

/** The context with blank and non-string fields dropped and each value capped. `null` when nothing is left. */
export const normalizeContext = (context: FacultyPageContext | null | undefined): FacultyPageContext | null => {
  if (!context || typeof context !== 'object') return null;
  const cleaned: Record<string, string> = {};
  for (const key of CONTEXT_KEYS) {
    const value = (context as Record<string, unknown>)[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) cleaned[key] = trimmed.slice(0, MAX_IDENTIFIER_CHARS);
  }
  return Object.keys(cleaned).length > 0 ? (cleaned as FacultyPageContext) : null;
};

/**
 * The dean's text and the context, read back off a stored user message.
 *
 * Only an exact trailer is split off; anything else is
 * returned whole as `text`, so a message the dean typed that merely mentions
 * the tag is never cut.
 */
export const splitFoldedContext = (message: string): { text: string; context: FacultyPageContext | null } => {
  const whole = { text: message, context: null };
  if (!message.endsWith(CLOSE_TAG)) return whole;

  const open = message.lastIndexOf(`${SEPARATOR}${OPEN_TAG}`);
  if (open === -1) return whole;

  const json = message.slice(open + SEPARATOR.length + OPEN_TAG.length, message.length - CLOSE_TAG.length);
  try {
    const parsed: unknown = JSON.parse(json);
    const context = normalizeContext(parsed as FacultyPageContext);
    if (context === null) return whole;
    return { text: message.slice(0, open), context };
  } catch {
    return whole;
  }
};

/** A thread's title without a trailer, which truncation may have left half-written. */
export const threadTitleOf = (title: string | null | undefined): string => {
  const text = typeof title === 'string' ? title : '';
  const cut = text.indexOf(OPEN_TAG);
  return (cut === -1 ? text : text.slice(0, cut)).trim();
};
