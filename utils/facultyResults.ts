/**
 * Reading a faculty query's result: cell text, sorting, the CSV download, and
 * the lines under an answer ("Data as of ...", sample sizes).
 *
 * Every value here came out of a database, and every column name was written
 * by the model. Nothing is trusted to be the type its column claims, and
 * nothing is ever treated as markup: a page renders these strings as text.
 */

import type { FacultyColumn, FacultyRow, FacultyTable, JsonValue } from '@/services/facultyChatWire';

/** A row's value for a column. Own keys only: a column called `constructor` is not a function. */
export const cellOf = (row: FacultyRow, name: string): JsonValue =>
  Object.prototype.hasOwnProperty.call(row, name) ? row[name] : null;

const NUMERIC_TYPE = /^(int|smallint|bigint|numeric|decimal|real|double|float|money)/i;
const TEMPORAL_TYPE = /^(date|time)/i;
const NUMBER_TEXT = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;

/** A number, or text that is exactly one (Postgres `numeric` arrives as a string). */
export const toNumber = (value: JsonValue): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !NUMBER_TEXT.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isNumericColumn = (column: FacultyColumn): boolean => NUMERIC_TYPE.test(column.dataType);

/** `pct_correct` → `% correct`, `learnerId` → `Learner ID`. For display; the SQL keeps the real name. */
export const humanizeColumn = (name: string): string => {
  const words = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase()
    .replace(/\bpct\b/g, '%')
    .replace(/\bid\b/g, 'ID');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : name;
};

const ID_COLUMN = /(^|_)id$/i;

/**
 * The columns worth a dean's screen: an id means nothing next to a name, so it
 * is left out when another text column can say which row this is. The CSV and
 * the SQL keep every column.
 */
export const displayColumnsOf = (columns: readonly FacultyColumn[]): readonly FacultyColumn[] => {
  const shown = columns.filter((column) => !ID_COLUMN.test(column.name));
  return shown.some((column) => !isNumericColumn(column)) ? shown : columns;
};

const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 });
export const formatNumber = (value: number): string => numberFormat.format(value);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (value: number) => String(value).padStart(2, '0');

const parseDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `29 Oct, 02:00 UTC`: when a snapshot was taken. UTC, as the jobs are scheduled. */
export const formatUtcMoment = (value: string): string | null => {
  const date = parseDate(value);
  if (!date) return null;
  return `${String(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
};

const formatTemporal = (value: string): string => {
  const date = parseDate(value);
  if (!date) return value;
  const day = `${String(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${String(date.getUTCFullYear())}`;
  const midnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
  return midnight ? day : `${day}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
};

/** A cell as the dean reads it. Plain text, always. */
export const formatCell = (value: JsonValue, column: FacultyColumn): string => {
  if (value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value !== 'string') return JSON.stringify(value);
  if (isNumericColumn(column)) {
    const number = toNumber(value);
    if (number !== null) return formatNumber(number);
  }
  return TEMPORAL_TYPE.test(column.dataType) ? formatTemporal(value) : value;
};

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type SortDirection = 'asc' | 'desc';

const sortKey = (value: JsonValue, column: FacultyColumn): number | string | null => {
  if (value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const number = isNumericColumn(column) || typeof value === 'number' ? toNumber(value) : null;
  if (number !== null) return number;
  if (typeof value === 'string' && TEMPORAL_TYPE.test(column.dataType)) {
    return parseDate(value)?.getTime() ?? value;
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const compareKeys = (left: number | string, right: number | string): number =>
  typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });

/** A sorted copy. Empty cells go last in both directions; equal rows keep their order. */
export const sortRows = (
  rows: readonly FacultyRow[],
  column: FacultyColumn,
  direction: SortDirection,
): FacultyRow[] => {
  const sign = direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, key: sortKey(cellOf(row, column.name), column) }))
    .sort((left, right) => {
      if (left.key === null || right.key === null) {
        return left.key === right.key ? left.index - right.index : left.key === null ? 1 : -1;
      }
      return sign * compareKeys(left.key, right.key) || left.index - right.index;
    })
    .map(({ row }) => row);
};

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Excel, Sheets and LibreOffice run a cell that starts with one of these, tab and CR included. */
const FORMULA_START = /^[\t\r\n]|^\s*[=+\-@＝＋－＠]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

/**
 * Spreadsheet formula injection: a learner named `=HYPERLINK(...)` must arrive
 * as text. A leading apostrophe makes a spreadsheet read the cell literally.
 * A plain number is left alone, since it can run nothing and `-0.12` should
 * still add up.
 */
export const neutralizeCsvCell = (text: string): string =>
  FORMULA_START.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;

/** Quoted when a spreadsheet could split it: `;` is the field separator in many locales. */
const quoteCsvCell = (text: string): string =>
  /[",;\t\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

const csvCell = (value: JsonValue): string => {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return quoteCsvCell(neutralizeCsvCell(text));
};

/** The whole result as CSV, with a BOM so Excel reads non-Latin names correctly. */
export const tableToCsv = (table: Pick<FacultyTable, 'columns' | 'rows'>): string => {
  const header = table.columns.map((column) => csvCell(humanizeColumn(column.name)));
  const rows = table.rows.map((row) => table.columns.map((column) => csvCell(cellOf(row, column.name))));
  return `﻿${[header, ...rows].map((cells) => cells.join(',')).join('\r\n')}\r\n`;
};

/** `ask-readiness-snapshot-2026-10-30.csv`. The purpose is the model's words, so only its plain letters survive. */
export const csvFileName = (purpose: string, now: Date = new Date()): string => {
  const slug = purpose
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return `ask-${slug || 'results'}-${now.toISOString().slice(0, 10)}.csv`;
};

export const downloadTableCsv = (table: FacultyTable): void => {
  const url = URL.createObjectURL(new Blob([tableToCsv(table)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFileName(table.purpose);
  link.click();
  URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------------------
// The lines under an answer
// ---------------------------------------------------------------------------

/** "3 rows", or "Showing the first 500 rows. There are more." Only the server knows how many more. */
export const rowCountLine = (table: Pick<FacultyTable, 'rows' | 'truncated'>): string => {
  const shown = table.rows.length;
  if (table.truncated) return `Showing the first ${formatNumber(shown)} rows. There are more.`;
  return `${formatNumber(shown)} ${shown === 1 ? 'row' : 'rows'}`;
};

export const AS_OF_UNKNOWN = 'As of unknown';
export const LIVE_DATA = 'Live data';

type TableFreshness = Pick<FacultyTable, 'asOf' | 'asOfUnknown'>;

const isLive = (table: TableFreshness) => !table.asOfUnknown && table.asOf.length === 0;

/**
 * The "as of" line for a whole answer: the oldest snapshot behind it, "Live
 * data" when every source is live, and "Data as of unknown" when any part of
 * it cannot say. An empty `asOf` alone never means live. `null` when no data
 * was read.
 */
export const asOfLine = (tables: readonly TableFreshness[]): string | null => {
  if (tables.length === 0) return null;
  if (tables.every(isLive)) return LIVE_DATA;
  if (tables.some((table) => table.asOfUnknown)) return 'Data as of unknown';

  const moments = tables.flatMap((table) => table.asOf).map((entry) => entry.computedAt);
  const times = moments.map((value) => parseDate(value)?.getTime() ?? Number.NaN);
  if (times.some(Number.isNaN)) return 'Data as of unknown';
  return `Data as of ${String(formatUtcMoment(moments[times.indexOf(Math.min(...times))]))}`;
};

/** One table's freshness, a line per snapshot kind. */
export const asOfDetail = (table: TableFreshness): string[] => {
  if (isLive(table)) return [LIVE_DATA];
  const stamped = table.asOf.flatMap((entry) => {
    const moment = formatUtcMoment(entry.computedAt);
    return moment ? [`${humanizeColumn(entry.kind)}: ${moment}`] : [];
  });
  return table.asOfUnknown || stamped.length < table.asOf.length ? [...stamped, AS_OF_UNKNOWN] : stamped;
};

const SAMPLE_COLUMN =
  /^(n|n_\w+|\w+_count|count|sample_size|items_answered|items_total|los_touched|los_total|learners_touched)$/i;

/**
 * What each row of a result rests on, from whichever columns the query
 * selected, e.g. "N responses: 12 to 340". Empty when it selected none.
 */
export const sampleSizesOf = (table: Pick<FacultyTable, 'columns' | 'rows'>): string[] => {
  const sizes = table.columns
    .filter((column) => SAMPLE_COLUMN.test(column.name))
    .flatMap((column) => {
      const values = table.rows.flatMap((row) => toNumber(cellOf(row, column.name)) ?? []);
      if (values.length === 0) return [];
      const low = Math.min(...values);
      const high = Math.max(...values);
      const range = low === high ? formatNumber(low) : `${formatNumber(low)} to ${formatNumber(high)}`;
      return [`${humanizeColumn(column.name)}: ${range}`];
    });

  if (table.columns.some((column) => column.name === 'insufficient_data')) {
    const thin = table.rows.filter((row) => cellOf(row, 'insufficient_data') === true).length;
    if (thin > 0) sizes.push(`${formatNumber(thin)} of ${formatNumber(table.rows.length)} rows have too few answers to rely on`);
  }
  return sizes;
};

// ---------------------------------------------------------------------------
// "Needs attention" rows
// ---------------------------------------------------------------------------

const LEARNER_ID_COLUMNS = ['learner_id', 'student_id', 'user_id'];

/** The dashboard's rule (plan §2.3), for a query that selected `readiness` but not the flag. */
export const NEEDS_ATTENTION_READINESS = 0.4;

/** The student a row flags as needing attention, or `null`: a row is rated only when it can name one. */
export const flaggedLearnerOf = (table: Pick<FacultyTable, 'columns'>, row: FacultyRow): string | null => {
  const names = new Set(table.columns.map((column) => column.name));
  const idColumn = LEARNER_ID_COLUMNS.find((name) => names.has(name));
  if (!idColumn) return null;

  const id = cellOf(row, idColumn);
  if ((typeof id !== 'string' || !id.trim()) && typeof id !== 'number') return null;

  const flagged = names.has('needs_attention')
    ? cellOf(row, 'needs_attention') === true
    : names.has('readiness') && (toNumber(cellOf(row, 'readiness')) ?? Infinity) < NEEDS_ATTENTION_READINESS;
  return flagged ? String(id) : null;
};
