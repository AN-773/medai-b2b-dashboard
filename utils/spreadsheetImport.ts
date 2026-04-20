import UZIP from 'uzip';
import { ImportedStudentRow } from '@/types/AcademyStudioTypes';

const headerAliases: Record<string, Array<keyof ImportedStudentRow>> = {
  name: ['name'],
  fullname: ['name'],
  'full name': ['name'],
  student: ['name'],
  learner: ['name'],
  email: ['email'],
  'email address': ['email'],
  mail: ['email'],
  id: ['learnerCode'],
  code: ['learnerCode'],
  'student id': ['learnerCode'],
  'learner id': ['learnerCode'],
  'student code': ['learnerCode'],
  'learner code': ['learnerCode'],
  program: ['program'],
  track: ['program'],
  course: ['program'],
  notes: ['notes'],
  note: ['notes'],
  comments: ['notes'],
};

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const splitDelimitedLine = (line: string, delimiter: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, '').trim());
};

const detectDelimiter = (text: string) => {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || '';
  const candidates = [',', '\t', ';'];
  return candidates.reduce(
    (best, candidate) => {
      const count = firstLine.split(candidate).length;
      return count > best.count ? { delimiter: candidate, count } : best;
    },
    { delimiter: ',', count: 0 },
  ).delimiter;
};

const mapRowsToStudents = (rows: string[][]): ImportedStudentRow[] => {
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const columnMap = new Map<number, keyof ImportedStudentRow>();

  headers.forEach((header, index) => {
    const mapped = headerAliases[header];
    if (!mapped || mapped.length === 0) return;
    columnMap.set(index, mapped[0]);
  });

  return rows
    .slice(1)
    .map((row) => {
      const student: ImportedStudentRow = {
        name: '',
        email: '',
      };

      row.forEach((cell, index) => {
        const target = columnMap.get(index);
        if (!target || !cell.trim()) return;
        student[target] = cell.trim();
      });

      if (!student.name && row[0]) student.name = row[0].trim();
      if (!student.email && row[1]) student.email = row[1].trim();
      return student;
    })
    .filter((student) => student.name && student.email);
};

const parseDelimitedText = (text: string) => {
  const delimiter = detectDelimiter(text);
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitDelimitedLine(line, delimiter));

  return mapRowsToStudents(rows);
};

const readZipText = (files: Record<string, Uint8Array>, path: string) => {
  const file = files[path];
  if (!file) return '';
  return new TextDecoder().decode(file);
};

const cellReferenceToIndex = (reference: string) => {
  const letters = reference.replace(/\d+/g, '');
  return letters.split('').reduce((accumulator, character) => accumulator * 26 + (character.charCodeAt(0) - 64), 0) - 1;
};

const parseSharedStrings = (sharedStringsXml: string) => {
  if (!sharedStringsXml) return [];

  const document = new DOMParser().parseFromString(sharedStringsXml, 'application/xml');
  return Array.from(document.getElementsByTagName('si')).map((node) =>
    Array.from(node.getElementsByTagName('t'))
      .map((textNode) => textNode.textContent || '')
      .join(''),
  );
};

const parseWorksheetRows = (sheetXml: string, sharedStrings: string[]) => {
  const document = new DOMParser().parseFromString(sheetXml, 'application/xml');
  const rowNodes = Array.from(document.getElementsByTagName('row'));

  return rowNodes.map((rowNode) => {
    const row: string[] = [];
    const cells = Array.from(rowNode.getElementsByTagName('c'));
    cells.forEach((cellNode) => {
      const reference = cellNode.getAttribute('r') || '';
      const columnIndex = cellReferenceToIndex(reference);
      const cellType = cellNode.getAttribute('t');
      const valueNode = cellNode.getElementsByTagName('v')[0];
      const inlineTextNode = cellNode.getElementsByTagName('t')[0];
      const rawValue = valueNode?.textContent || inlineTextNode?.textContent || '';

      let value = rawValue;
      if (cellType === 's') {
        value = sharedStrings[Number(rawValue)] || '';
      }

      row[columnIndex] = value;
    });

    return row.map((cell) => cell || '');
  });
};

const parseXlsx = async (file: File) => {
  const files = UZIP.parse(await file.arrayBuffer());
  const sharedStrings = parseSharedStrings(readZipText(files, 'xl/sharedStrings.xml'));
  const worksheetPath = Object.keys(files)
    .filter((path) => path.startsWith('xl/worksheets/sheet'))
    .sort()[0];

  if (!worksheetPath) {
    throw new Error('The spreadsheet does not contain a readable worksheet.');
  }

  const worksheetRows = parseWorksheetRows(readZipText(files, worksheetPath), sharedStrings);
  return mapRowsToStudents(worksheetRows);
};

export const parseStudentSpreadsheet = async (file: File): Promise<ImportedStudentRow[]> => {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')) {
    return parseDelimitedText(await file.text());
  }

  if (lowerName.endsWith('.xlsx')) {
    return parseXlsx(file);
  }

  throw new Error('Unsupported spreadsheet format. Please upload .csv, .tsv, or .xlsx.');
};
