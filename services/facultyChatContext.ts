/**
 * Page context for a faculty question ("Ask about this cohort").
 *
 * agent-v2's create-turn body has no field for which screen a question came
 * from: `clinicalContext` is the clinic's patient identifier and nothing else.
 * So the context rides inside `message`, as a fixed trailer after the dean's
 * own words:
 *
 * ```
 * Which students need attention before the renal exam?
 *
 * <dashboard_context>{"cohortId":"c_123","cohortName":"Year 2"}</dashboard_context>
 * ```
 *
 * - **After the question**, so the thread title (the opening message,
 *   truncated) still starts with what the dean typed.
 * - **Tagged JSON**, so the model reads it unambiguously and this file can
 *   split it back off a transcript exactly ({@link splitFoldedContext}). `<` is
 *   escaped inside the JSON, so a cohort named `</dashboard_context>` cannot end
 *   the block early.
 * - **A hint, never an authorisation.** The dean could type the same text.
 *   Tenancy is enforced by the database views and the signed tenant token
 *   (plan §3.2), not by anything a client says.
 *
 * FAG-6's faculty prompt should tell the model what this block is. If agent-v2
 * later grows a context field, this module is the one place to change.
 */

import { MAX_IDENTIFIER_CHARS } from './facultyChatWire';

/** Where on the dashboard a question was asked from. Every field is optional. */
export interface FacultyPageContext {
  /** The cohort the dean was looking at. */
  readonly cohortId?: string;
  /** Its display name, so the model can say it back without a lookup. */
  readonly cohortName?: string;
  /** Which page: `cohort`, `mastery`, ... Wording only. */
  readonly page?: string;
}

const CONTEXT_KEYS = ['cohortId', 'cohortName', 'page'] as const;

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

/** The message agent-v2 receives: the dean's text, then the context trailer if there is any context. */
export const foldContextIntoMessage = (text: string, context?: FacultyPageContext | null): string => {
  const normalized = normalizeContext(context);
  if (normalized === null) return text;
  const json = JSON.stringify(normalized).replace(/</g, '\\u003c');
  return `${text}${SEPARATOR}${OPEN_TAG}${json}${CLOSE_TAG}`;
};

/**
 * The dean's text and the context, read back off a stored user message.
 *
 * Only an exact trailer this module wrote is split off; anything else is
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
