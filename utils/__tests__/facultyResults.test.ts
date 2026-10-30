import { describe, expect, it } from 'vitest';

import type { FacultyColumn, FacultyRow, FacultyTable } from '@/services/facultyChatWire';
import {
  asOfLine,
  cellOf,
  csvFileName,
  displayColumnsOf,
  flaggedLearnerOf,
  formatCell,
  formatUtcMoment,
  humanizeColumn,
  neutralizeCsvCell,
  rowCountLine,
  sampleSizesOf,
  sortRows,
  tableToCsv,
} from '../facultyResults';

const text: FacultyColumn = { name: 'name', dataType: 'text' };
const numeric: FacultyColumn = { name: 'score', dataType: 'numeric' };
const stamped: FacultyColumn = { name: 'at', dataType: 'timestamptz' };

const cols = (...names: string[]): FacultyColumn[] => names.map((name) => ({ name, dataType: 'text' }));

describe('cells', () => {
  it('reads a value as plain text, whatever its type', () => {
    expect(formatCell(null, text)).toBe('—');
    expect(formatCell('', text)).toBe('—');
    expect(formatCell(true, text)).toBe('Yes');
    expect(formatCell(false, text)).toBe('No');
    expect(formatCell(1234.56789, numeric)).toBe('1,234.568');
    expect(formatCell('1234.5', numeric)).toBe('1,234.5');
    expect(formatCell(['a', 1], text)).toBe('["a",1]');
    expect(formatCell('2026-10-29T02:30:00Z', stamped)).toBe('29 Oct 2026, 02:30 UTC');
    expect(formatCell('2026-10-29', { name: 'day', dataType: 'date' })).toBe('29 Oct 2026');
  });

  it('leaves markup as the literal text it is', () => {
    expect(formatCell('<img src=x onerror=alert(1)>', text)).toBe('<img src=x onerror=alert(1)>');
  });

  it('keeps text that merely looks like a number, in a text column', () => {
    expect(formatCell('0012', text)).toBe('0012');
  });

  it('only reads a row’s own keys', () => {
    expect(cellOf({}, 'constructor')).toBeNull();
    expect(cellOf({ constructor: 'x' }, 'constructor')).toBe('x');
  });

  it('names columns in words', () => {
    expect(humanizeColumn('pct_correct')).toBe('% correct');
    expect(humanizeColumn('learner_id')).toBe('Learner ID');
    expect(humanizeColumn('cohortMedianMastery')).toBe('Cohort median mastery');
    expect(humanizeColumn('___')).toBe('___');
  });
});

describe('displayColumnsOf', () => {
  const id: FacultyColumn = { name: 'learner_id', dataType: 'text' };

  it('leaves out an id when a name says which row this is', () => {
    expect(displayColumnsOf([id, text, numeric])).toEqual([text, numeric]);
  });

  it('keeps an id when nothing else could', () => {
    expect(displayColumnsOf([id, numeric])).toEqual([id, numeric]);
  });

  it('does not mistake a word ending in id', () => {
    const fluid: FacultyColumn = { name: 'fluid', dataType: 'text' };
    expect(displayColumnsOf([fluid, text])).toEqual([fluid, text]);
  });
});

describe('sortRows', () => {
  const rows: FacultyRow[] = [{ score: '10' }, { score: null }, { score: '9.5' }, { score: 100 }];

  it('sorts numeric text as numbers, with empty cells last either way', () => {
    expect(sortRows(rows, numeric, 'asc').map((row) => row.score)).toEqual(['9.5', '10', 100, null]);
    expect(sortRows(rows, numeric, 'desc').map((row) => row.score)).toEqual([100, '10', '9.5', null]);
  });

  it('sorts timestamps by time and text naturally', () => {
    const times = [{ at: '2026-10-29T10:00:00+02:00' }, { at: '2026-10-29T09:00:00Z' }];
    expect(sortRows(times, stamped, 'asc')).toEqual([times[0], times[1]]);
    const names = [{ name: 'Year 10' }, { name: 'year 2' }];
    expect(sortRows(names, text, 'asc')).toEqual([names[1], names[0]]);
  });

  it('keeps equal rows in order, and does not touch the input', () => {
    const tied = [{ name: 'a', score: 1 }, { name: 'b', score: 1 }];
    expect(sortRows(tied, numeric, 'desc')).toEqual(tied);
    const copy = [...rows];
    sortRows(rows, numeric, 'asc');
    expect(rows).toEqual(copy);
  });
});

describe('CSV', () => {
  it.each([
    ['=HYPERLINK("http://evil.example","click")'],
    ['+1+1'],
    ['-2+3+cmd|\' /C calc\'!A0'],
    ['@SUM(1,1)'],
    ['  =1+1'],
    ['\t=1+1'],
    ['\r=1+1'],
    ['＝1+1'],
    ['-'],
  ])('neutralises %j', (cell) => {
    expect(neutralizeCsvCell(cell)).toBe(`'${cell}`);
  });

  it.each(['Sara', '0.42', '-0.42', '+20', '3 = 3', 'a@b.example'])('leaves %j alone', (cell) => {
    expect(neutralizeCsvCell(cell)).toBe(cell);
  });

  it('writes a BOM, words for the header, raw values, and neutralised text', () => {
    const csv = tableToCsv({
      columns: [
        { name: 'name', dataType: 'text' },
        { name: 'pct_correct', dataType: 'numeric' },
        { name: 'needs_attention', dataType: 'bool' },
        { name: 'note', dataType: 'text' },
      ],
      rows: [
        { name: '=cmd()', pct_correct: -0.25, needs_attention: true, note: null },
        { name: 'Smith, "Sam"', pct_correct: '0.5', needs_attention: false, note: 'line\nbreak' },
      ],
    });
    expect(csv).toBe(
      '﻿Name,% correct,Needs attention,Note\r\n' +
        "'=cmd(),-0.25,Yes,\r\n" +
        '"Smith, ""Sam""",0.5,No,"line\nbreak"\r\n',
    );
  });

  it('neutralises a header too: column names are the model’s', () => {
    const csv = tableToCsv({ columns: [{ name: '=evil()', dataType: 'text' }], rows: [] });
    expect(csv).toBe("﻿'=evil()\r\n");
  });

  it('quotes a cell a semicolon could split, so nothing starts a new cell in a ; locale', () => {
    const csv = tableToCsv({ columns: cols('note'), rows: [{ note: 'a;=1+1' }] });
    expect(csv).toContain('"a;=1+1"');
  });

  it('never leaves a formula at the start of any cell', () => {
    const payloads = ['=1+1', '+1+1', '-1+1', '@A1'];
    const csv = tableToCsv({
      columns: cols('a', 'b', 'c', 'd'),
      rows: [{ a: payloads[0], b: payloads[1], c: payloads[2], d: payloads[3] }],
    });
    const cells = csv.split('\r\n')[1].split(',');
    expect(cells).toEqual(payloads.map((payload) => `'${payload}`));
  });

  it('names the file from the purpose’s plain letters only', () => {
    const now = new Date('2026-10-30T12:00:00Z');
    expect(csvFileName('Checking readiness: Year 2!', now)).toBe('ask-checking-readiness-year-2-2026-10-30.csv');
    expect(csvFileName('../../etc/passwd', now)).toBe('ask-etc-passwd-2026-10-30.csv');
    expect(csvFileName('طلاب', now)).toBe('ask-results-2026-10-30.csv');
  });
});

describe('the lines under an answer', () => {
  const table = (fields: Partial<FacultyTable>): Pick<FacultyTable, 'asOf' | 'rows' | 'rowCount' | 'truncated' | 'columns'> => ({
    asOf: [],
    rows: [],
    rowCount: 0,
    truncated: false,
    columns: [],
    ...fields,
  });

  it('says when a snapshot was taken, in UTC', () => {
    expect(formatUtcMoment('2026-10-29T02:00:00Z')).toBe('29 Oct, 02:00 UTC');
    expect(formatUtcMoment('2026-10-29T04:30:00+02:00')).toBe('29 Oct, 02:30 UTC');
    expect(formatUtcMoment('nonsense')).toBeNull();
  });

  it('takes the oldest snapshot behind an answer, or says live, or nothing', () => {
    expect(asOfLine([])).toBeNull();
    expect(asOfLine([table({})])).toBe('Live data');
    expect(
      asOfLine([
        table({ asOf: [{ kind: 'readiness', computedAt: '2026-10-29T08:00:00Z' }] }),
        table({ asOf: [{ kind: 'item_stats', computedAt: '2026-10-29T02:00:00Z' }] }),
      ]),
    ).toBe('Data as of 29 Oct, 02:00 UTC');
  });

  it('counts rows, and says when there are more than it holds', () => {
    expect(rowCountLine(table({ rows: [{}], rowCount: 1 }))).toBe('1 row');
    expect(rowCountLine(table({ rows: [{}, {}], rowCount: 2 }))).toBe('2 rows');
    expect(rowCountLine(table({ rows: [{}], rowCount: 1204, truncated: true }))).toBe('Showing the first 1 of 1,204 rows');
    expect(rowCountLine(table({ rows: [{}, {}], rowCount: 2, truncated: true }))).toBe('Showing the first 2 rows. There are more.');
  });

  it('reports sample sizes from the columns a query selected', () => {
    expect(
      sampleSizesOf({
        columns: cols('topic', 'n_responses', 'items_answered', 'insufficient_data'),
        rows: [
          { topic: 'Renal', n_responses: 12, items_answered: '40', insufficient_data: true },
          { topic: 'Cardio', n_responses: 340, items_answered: '40', insufficient_data: false },
        ],
      }),
    ).toEqual(['N responses: 12 to 340', 'Items answered: 40', '1 of 2 rows have too few answers to rely on']);
    expect(sampleSizesOf({ columns: cols('topic'), rows: [{ topic: 'Renal' }] })).toEqual([]);
  });
});

describe('flaggedLearnerOf', () => {
  const flagged = { columns: cols('learner_id', 'needs_attention', 'readiness') };

  it('uses the view’s flag when the query selected it', () => {
    expect(flaggedLearnerOf(flagged, { learner_id: 'u1', needs_attention: true, readiness: 0.9 })).toBe('u1');
    expect(flaggedLearnerOf(flagged, { learner_id: 'u1', needs_attention: false, readiness: 0.1 })).toBeNull();
  });

  it('falls back to the dashboard’s threshold', () => {
    const table = { columns: cols('learner_id', 'readiness') };
    expect(flaggedLearnerOf(table, { learner_id: 'u1', readiness: '0.39' })).toBe('u1');
    expect(flaggedLearnerOf(table, { learner_id: 'u1', readiness: 0.4 })).toBeNull();
    expect(flaggedLearnerOf(table, { learner_id: 'u1', readiness: null })).toBeNull();
  });

  it('cannot rate a row that does not name a student', () => {
    expect(flaggedLearnerOf({ columns: cols('name', 'needs_attention') }, { name: 'Sara', needs_attention: true })).toBeNull();
    expect(flaggedLearnerOf(flagged, { learner_id: '', needs_attention: true })).toBeNull();
  });
});
