import type { BadgeTone } from '@/components/ui';
import type { IamInvite, InviteImportResponse } from '@/services/iamService';
import type { TeacherStudent } from '@/types/AcademyStudioTypes';

export interface InvitePreviewRow {
  email: string;
  role: string;
}

export const plural = (count: number, word: string, pluralWord = `${word}s`) =>
  `${count.toLocaleString()} ${count === 1 ? word : pluralWord}`;

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

export const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() || '';

export const formatSkippedInviteSummary = (response: InviteImportResponse) => {
  if (response.skipped <= 0) {
    return '';
  }

  const skippedEmails = response.results
    .filter((result) => result.status === 'skipped')
    .slice(0, 5)
    .map((result) => result.email);

  if (skippedEmails.length === 0) {
    return `${response.skipped} invite${response.skipped === 1 ? '' : 's'} skipped.`;
  }

  const moreCount = response.skipped - skippedEmails.length;
  const moreLabel = moreCount > 0 ? ` and ${moreCount} more` : '';
  return `Skipped ${skippedEmails.join(', ')}${moreLabel}.`;
};

const splitCsvLine = (line: string) => {
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

    if (character === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, '').trim());
};

const normalizeHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

/** Validates an invite CSV locally so problems surface before anything is sent. */
export const parseInviteCsvPreview = async (file: File): Promise<InvitePreviewRow[]> => {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.csv')) {
    throw new Error('Please upload a CSV file.');
  }

  const rows = (await file.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine);

  if (rows.length < 2) {
    throw new Error('Your CSV needs a header row and at least one email.');
  }

  const headers = rows[0].map(normalizeHeader);
  const emailIndex = headers.findIndex((header) => header === 'email');
  const roleIndex = headers.findIndex((header) => header === 'role');

  if (emailIndex < 0) {
    throw new Error('Your CSV needs an email column.');
  }

  const uniqueEmails = new Set<string>();

  return rows
    .slice(1)
    .map((row) => ({
      email: row[emailIndex]?.trim() || '',
      role: row[roleIndex]?.trim() || 'user',
    }))
    .filter((row) => row.email)
    .filter((row) => {
      const normalizedEmail = normalizeEmail(row.email);

      if (!isValidEmail(normalizedEmail)) {
        throw new Error(`The CSV contains an invalid email: ${row.email}`);
      }

      if (uniqueEmails.has(normalizedEmail)) {
        throw new Error(`The CSV contains a duplicate email: ${row.email}`);
      }

      uniqueEmails.add(normalizedEmail);
      return true;
    });
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** "Mar 4, 2026", or null when the value is missing or unparseable. */
export const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
};

export const formatTimestamp = (value?: string) => formatDate(value) ?? 'Not available';

export const formatDateRange = (start?: string, end?: string) => {
  const from = formatDate(start);
  const to = formatDate(end);
  if (from && to) return `${from} – ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return null;
};

export const buildInviteSearchText = (invite: IamInvite) =>
  [
    invite.email,
    invite.role,
    invite.status,
    invite.id,
    formatTimestamp(invite.created),
    formatTimestamp(invite.expiresAt),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const getStudentSourceLabel = (source: TeacherStudent['source']) => {
  if (source === 'manual') return 'Added here';
  if (source === 'spreadsheet') return 'CSV import';
  return 'Synced';
};

export const getInviteRoleLabel = (role?: string | null) => {
  const normalizedRole = role?.trim().toLowerCase();
  if (!normalizedRole || normalizedRole === 'user') {
    return 'Standard';
  }

  return normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
};

export const getInviteStatusLabel = (status?: string | null) => {
  const normalizedStatus = status?.trim().toLowerCase();

  if (!normalizedStatus || normalizedStatus === 'pending') {
    return 'Waiting';
  }

  return normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
};

export const getInviteStatusTone = (status?: string | null): BadgeTone => {
  const normalizedStatus = status?.trim().toLowerCase();
  if (!normalizedStatus || normalizedStatus === 'pending') return 'amber';
  if (normalizedStatus === 'accepted') return 'green';
  if (normalizedStatus === 'expired') return 'red';
  return 'neutral';
};

export const getInitials = (name?: string, email?: string) => {
  const source = name?.trim() || email?.trim() || '';
  if (!source) return '?';
  const words = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word.charAt(0).toUpperCase()).join('') || '?';
};
