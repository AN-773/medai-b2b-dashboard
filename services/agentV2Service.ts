/**
 * The tutor agent (agent-v2), as far as course resources are concerned.
 *
 * Course resources are the files a learner's tutor should be able to read, and
 * the agent is what reads them: a file becomes searchable by being ingested
 * into a **knowledge base**, which parses, chunks and embeds it. That pipeline
 * accepts a specific set of document formats and a much smaller file than the
 * Tests service's own store does, and this module is where the dashboard asks
 * what those limits are instead of assuming them.
 *
 * ## Why the format list is fetched and not written down here
 *
 * `GET /v1/documents/formats` exists precisely so that a client does not keep
 * its own copy. The agent's own notes on that route describe the defect it was
 * built to retire: two Nuxt clients had each hand-written an accept list, one
 * offering `.doc` and `.xls` that the parser has never read, so a person could
 * pick a file the picker approved of and be told `415` after spending the
 * upload. A list hardcoded here would be the third copy and would be correct
 * only until the parser learns a ninth format.
 *
 * So the picker is built from what this returns. When the agent is not
 * configured, or the call fails, the caller keeps its previous behaviour rather
 * than guessing a list — see {@link getCorpusUploadFormats}.
 *
 * ## `isConfigured()` is the whole of the feature gate
 *
 * There is no agent in every deployment. One env var decides it, and a surface
 * that reads this instead of the variable stays honest about what "the tutor
 * can read this" depends on.
 */
import { apiClient } from './apiClient';

/**
 * The largest file the agent will ingest, in bytes — 150 MiB.
 *
 * The agent's `API_MAX_UPLOAD_BYTES`, whose default this mirrors, and the
 * Document Service's own ceiling behind it. Unlike the format list there is no
 * route that publishes this number, so it is a constant here and a deployment
 * that moves its own ceiling makes this one wrong in the safe direction: the
 * upload's own `413` stays the real answer, and this value only decides what
 * the dashboard refuses before spending a transfer.
 */
export const AGENT_MAX_UPLOAD_BYTES = 150 * 1024 * 1024;

/** How {@link AGENT_MAX_UPLOAD_BYTES} is written for a person. */
export const AGENT_MAX_UPLOAD_SIZE_LABEL = '150 MB';

/** Where the agent publishes what an upload may be. */
const UPLOAD_FORMATS_ENDPOINT = '/v1/documents/formats';

/**
 * How one format is spelled, both ways a browser can match it.
 *
 * Media types *and* suffixes, because an `accept` attribute is matched against
 * either: a `.csv` on a machine where Excel owns the extension is reported as
 * `application/vnd.ms-excel`, and a file with no extension is known only by its
 * type. The agent publishes both because it consults both.
 */
export interface UploadFormatSpellings {
  /** Declared media types, canonical first, lower-case, no parameters. */
  readonly mediaTypes: readonly string[];
  /** Filename suffixes, leading dot, lower-case. */
  readonly suffixes: readonly string[];
}

/** One format a picker may offer. */
export interface AcceptedUploadFormat extends UploadFormatSpellings {
  /** The agent's own name for it — `pdf`, `docx`, `image`, … */
  readonly format: string;
}

/** The formats one upload path takes. */
export interface UploadFormatList {
  /** Which path this list describes. Course resources are `corpus`. */
  readonly scope: string;
  readonly formats: readonly AcceptedUploadFormat[];
}

/** What `GET /v1/documents/formats` answers. */
export interface UploadFormatsResponse {
  /** Chat attachments — not what course resources are. */
  readonly session: UploadFormatList;
  /** Knowledge-base ingestion. The list course resources are bounded by. */
  readonly corpus: UploadFormatList;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    : [];

/**
 * The corpus list read out of an arbitrary response body.
 *
 * Defensive because the answer decides what a picker offers: a malformed body
 * that produced a half-built list would hide formats the agent actually reads,
 * which is invisible until a teacher cannot upload a PDF. A body this cannot
 * make sense of yields no formats, and {@link getCorpusUploadFormats} turns
 * that into `null` — *we do not know* — rather than into an empty allowlist.
 */
const parseCorpusFormats = (body: unknown): AcceptedUploadFormat[] => {
  if (!isPlainObject(body)) return [];
  const corpus = body['corpus'];
  if (!isPlainObject(corpus)) return [];
  const formats = corpus['formats'];
  if (!Array.isArray(formats)) return [];

  return formats.flatMap((entry): AcceptedUploadFormat[] => {
    if (!isPlainObject(entry)) return [];
    const format = entry['format'];
    if (typeof format !== 'string' || format.trim() === '') return [];

    const mediaTypes = stringsOf(entry['mediaTypes']).map((type) => type.toLowerCase());
    const suffixes = stringsOf(entry['suffixes']).map((suffix) => suffix.toLowerCase());
    if (mediaTypes.length === 0 && suffixes.length === 0) return [];

    return [{ format, mediaTypes, suffixes }];
  });
};

/** Whether this deployment has a tutor agent at all. */
export const isAgentV2Configured = (): boolean =>
  Boolean((import.meta.env.VITE_AGENT_V2_API_URL || '').trim());

/**
 * What the agent will ingest, or `null` if it could not be asked.
 *
 * `null` and an empty list are deliberately different answers. `null` means
 * *unknown* — no agent configured, or the call failed — and a caller must then
 * leave its picker as permissive as it was, because narrowing on a guess would
 * refuse files the agent reads perfectly well. An empty list would mean the
 * agent said it reads nothing, which it never does.
 *
 * Not cached here. The panel that needs it fetches once per mount, which is
 * cheap and keeps the answer fresh across a deployment that adds a format.
 */
export const getCorpusUploadFormats = async (
  options: { signal?: AbortSignal } = {},
): Promise<AcceptedUploadFormat[] | null> => {
  if (!isAgentV2Configured()) return null;

  try {
    const body = await apiClient.get<unknown>('AGENT_V2', UPLOAD_FORMATS_ENDPOINT, {
      signal: options.signal,
    });
    const formats = parseCorpusFormats(body);
    return formats.length > 0 ? formats : null;
  } catch {
    // Every failure is the same answer: we do not know what the agent takes.
    // Which of unreachable, unauthorised and malformed it was does not change
    // what the caller should do, and the caller cannot act on the difference.
    return null;
  }
};

/**
 * The value of an `<input type="file" accept="…">` for a list of formats.
 *
 * Suffixes and media types both, comma-separated — the form the HTML
 * specification defines. No wildcards: `image/*` offers a TIFF the parser
 * refuses, which is the whole thing the published list exists to avoid.
 */
export const uploadAcceptAttribute = (formats: readonly AcceptedUploadFormat[]): string =>
  formats.flatMap((accepted) => [...accepted.suffixes, ...accepted.mediaTypes]).join(',');

/**
 * Whether a file is one of these formats, by the two spellings a browser has.
 *
 * Declared type first and suffix as the fallback, which is the order the agent
 * itself consults them in — so a file this admits is one the upload admits, and
 * a file this refuses is one that would have come back `415`.
 */
export const isAcceptedUpload = (
  file: File,
  formats: readonly AcceptedUploadFormat[],
): boolean => {
  const mediaType = (file.type || '').split(';')[0].trim().toLowerCase();
  const name = file.name.toLowerCase();

  return formats.some(
    (accepted) =>
      (mediaType !== '' && accepted.mediaTypes.includes(mediaType)) ||
      accepted.suffixes.some((suffix) => name.endsWith(suffix)),
  );
};

/** The extensions a list covers, for a sentence a person reads. */
export const formatSuffixLabels = (formats: readonly AcceptedUploadFormat[]): string[] => {
  const seen = new Set<string>();
  for (const accepted of formats) {
    for (const suffix of accepted.suffixes) seen.add(suffix.replace(/^\./, '').toUpperCase());
  }
  return [...seen];
};

export const agentV2Service = {
  isConfigured: isAgentV2Configured,
  getCorpusUploadFormats,
};
