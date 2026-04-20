import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Database,
  FileSpreadsheet,
  Layers3,
  MailPlus,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import {
  iamService,
  type IamInvite,
} from '@/services/iamService';
import {
  TeacherCohort,
  TeacherStudent,
} from '@/types/AcademyStudioTypes';

const panelClass =
  'rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm';
const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10';

interface InvitePreviewRow {
  email: string;
  role: string;
}

interface RegistryRow {
  id: string;
  displayName: string;
  email: string;
  codeOrRole: string;
  cohortTitles: string[];
  metadataPrimary: string;
  metadataSecondary: string;
  statusLabel: string;
  statusBadgeClass: string;
  sourceLabel: string;
  sourceBadgeClass: string;
  searchText: string;
}

const emptyInviteForm = {
  email: '',
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

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
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const parseInviteCsvPreview = async (file: File): Promise<InvitePreviewRow[]> => {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.csv')) {
    throw new Error('Upload a CSV file for bulk invites.');
  }

  const rows = (await file.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine);

  if (rows.length < 2) {
    throw new Error('The CSV must include a header row and at least one invite.');
  }

  const headers = rows[0].map(normalizeHeader);
  const emailIndex = headers.findIndex((header) => header === 'email');
  const roleIndex = headers.findIndex((header) => header === 'role');

  if (emailIndex < 0) {
    throw new Error('The CSV must include an email column.');
  }

  return rows
    .slice(1)
    .map((row) => ({
      email: row[emailIndex]?.trim() || '',
      role: row[roleIndex]?.trim() || 'user',
    }))
    .filter((row) => row.email);
};

const formatTimestamp = (value?: string) => {
  if (!value) return 'Unknown';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const buildLearnerRegistryRow = (
  student: TeacherStudent,
  cohortTitles: string[],
): RegistryRow => ({
  id: student.id,
  displayName: student.name,
  email: student.email || 'Email not available',
  codeOrRole: student.learnerCode,
  cohortTitles,
  metadataPrimary: student.program || 'No program metadata',
  metadataSecondary: student.notes || 'No local notes',
  statusLabel: 'Synced',
  statusBadgeClass: 'bg-emerald-100 text-emerald-700',
  sourceLabel: 'Backend',
  sourceBadgeClass: 'bg-slate-100 text-slate-600',
  searchText: [
    student.name,
    student.email,
    student.learnerCode,
    student.program,
    student.notes,
    student.id,
    'synced',
    'backend',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase(),
});

const buildInviteRegistryRow = (invite: IamInvite): RegistryRow => ({
  id: invite.id,
  displayName: 'Pending IAM invite',
  email: invite.email,
  codeOrRole: invite.role?.trim() || 'user',
  cohortTitles: [],
  metadataPrimary: `Created ${formatTimestamp(invite.created)}`,
  metadataSecondary: `Expires ${formatTimestamp(invite.expiresAt)}`,
  statusLabel: invite.status || 'pending',
  statusBadgeClass: 'bg-amber-100 text-amber-700',
  sourceLabel: 'IAM invite',
  sourceBadgeClass: 'bg-sky-100 text-sky-700',
  searchText: [
    invite.email,
    invite.role,
    invite.status,
    invite.id,
    'invite',
    'pending',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase(),
});

const StudentRegistryView: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [pendingInvites, setPendingInvites] = useState<IamInvite[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<InvitePreviewRow[]>(
    [],
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadRegistry = async () => {
    setIsLoading(true);
    setLoadError(null);

    const [snapshotResult, invitesResult] = await Promise.allSettled([
      academyStudioBackend.loadSnapshot(),
      iamService.listInvites('pending'),
    ]);

    const errors: string[] = [];

    if (snapshotResult.status === 'fulfilled') {
      setStudents(snapshotResult.value.students);
      setCohorts(snapshotResult.value.cohorts);
    } else {
      console.error('Failed to load student registry:', snapshotResult.reason);
      errors.push(
        getErrorMessage(
          snapshotResult.reason,
          'Unable to load learners from the backend.',
        ),
      );
    }

    if (invitesResult.status === 'fulfilled') {
      setPendingInvites(invitesResult.value.items);
    } else {
      console.error('Failed to load pending invites:', invitesResult.reason);
      errors.push(
        getErrorMessage(
          invitesResult.reason,
          'Unable to load pending invites from IAM.',
        ),
      );
    }

    setLoadError(errors.length > 0 ? errors.join(' ') : null);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadRegistry();
  }, []);

  const cohortTitlesByStudent = useMemo(() => {
    const map = new Map<string, string[]>();

    cohorts.forEach((cohort) => {
      cohort.studentIds.forEach((studentId) => {
        const current = map.get(studentId) || [];
        current.push(cohort.title);
        map.set(studentId, current);
      });
    });

    return map;
  }, [cohorts]);

  const registryRows = useMemo(() => {
    const learnerRows = students.map((student) =>
      buildLearnerRegistryRow(
        student,
        cohortTitlesByStudent.get(student.id) || [],
      ),
    );
    const inviteRows = pendingInvites?.map(buildInviteRegistryRow) ?? [];

    return [...learnerRows, ...inviteRows].sort((left, right) =>
      left.email.localeCompare(right.email),
    );
  }, [cohortTitlesByStudent, pendingInvites, students]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return registryRows;

    return registryRows.filter((row) => row.searchText.includes(query));
  }, [registryRows, searchQuery]);

  const cohortLinkedStudents = students.filter((student) =>
    cohortTitlesByStudent.has(student.id),
  ).length;

  const clearImportSelection = () => {
    setImportFile(null);
    setImportPreviewRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteError(null);
    setImportError(null);
    setMessage(null);

    if (!isValidEmail(inviteForm.email)) {
      setInviteError('Enter a valid learner email address.');
      return;
    }

    setIsInviting(true);

    try {
      await iamService.createInvite(inviteForm.email);
      setInviteForm(emptyInviteForm);
      setMessage(`Invite sent to ${inviteForm.email.trim()}.`);
      await loadRegistry();
    } catch (error) {
      setInviteError(
        getErrorMessage(error, 'Unable to send the learner invite.'),
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleImportFileSelection = async (file: File | null) => {
    if (!file) return;

    setImportError(null);
    setInviteError(null);
    setMessage(null);
    setIsParsingImport(true);

    try {
      const previewRows = await parseInviteCsvPreview(file);

      if (previewRows.length === 0) {
        throw new Error('No invite rows were found in the CSV.');
      }

      setImportFile(file);
      setImportPreviewRows(previewRows);
    } catch (error) {
      clearImportSelection();
      setImportError(
        getErrorMessage(error, 'Unable to parse the uploaded CSV.'),
      );
    } finally {
      setIsParsingImport(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      setImportError('Choose a CSV file before importing invites.');
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setInviteError(null);
    setMessage(null);

    try {
      const fileName = importFile.name;
      await iamService.importInvites(importFile);
      clearImportSelection();
      setMessage(`Invite import uploaded from ${fileName}.`);
      await loadRegistry();
    } catch (error) {
      setImportError(
        getErrorMessage(error, 'Unable to import invites from the CSV file.'),
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="teacher-readable space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={panelClass}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                Synced learners
              </p>
              <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                {students.length}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 p-3 text-white">
              <Users size={18} />
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-600">
                Linked to cohorts
              </p>
              <p className="mt-3 text-3xl font-black tracking-tight text-emerald-900">
                {cohortLinkedStudents}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-3 text-emerald-600 shadow-sm">
              <Layers3 size={18} />
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-amber-100 bg-amber-50/80 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">
                Pending invites
              </p>
              <p className="mt-3 text-3xl font-black tracking-tight text-amber-950">
                {pendingInvites?.length ?? 0}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
              <MailPlus size={18} />
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-[#101311] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                Synced cohorts
              </p>
              <p className="mt-3 text-3xl font-black tracking-tight text-white">
                {cohorts.length}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 text-[#1BD183]">
              <Database size={18} />
            </div>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 shadow-sm">
          {loadError}
        </div>
      )}

      {message && (
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700 shadow-sm">
          {message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className={panelClass}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                Manual invite
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                Send one invite
              </h3>
              <p className="mt-2 max-w-xl text-sm font-medium text-slate-500">
                This creates a pending IAM invite using only the learner email.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-900 p-3 text-white">
              <MailPlus size={18} />
            </div>
          </div>

          {inviteError && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {inviteError}
            </div>
          )}

          <form onSubmit={handleInviteSubmit} className="mt-5 space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-bold text-slate-700">
                Email address
              </span>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(event) =>
                  setInviteForm({
                    email: event.target.value,
                  })
                }
                placeholder="learner@example.com"
                className={inputClass}
              />
            </label>

            <div className="flex flex-col gap-4 border-t border-slate-100 pt-5">
              <p className="text-sm font-medium text-slate-500">
                New invites will appear in the pending list after the request succeeds.
              </p>

              <button
                type="submit"
                disabled={isInviting}
                className="inline-flex items-center justify-center rounded-2xl bg-[#16324F] px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isInviting ? 'Sending invite' : 'Send invite'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                Bulk upload
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                Import invite CSV
              </h3>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Upload the CSV to IAM using `/invites/import`. Expected columns:
                email, role.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm">
              <FileSpreadsheet size={18} />
            </div>
          </div>

          {importError && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {importError}
            </div>
          )}

          <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsingImport}
              className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-[1.75rem] border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center transition hover:border-[#1BD183] hover:bg-[#1BD183]/5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                <Upload size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-900">
                  {isParsingImport
                    ? 'Reading CSV'
                    : importFile?.name || 'Choose invite CSV'}
                </p>
                <p className="text-sm font-medium text-slate-500">
                  Example columns: email, role
                </p>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) =>
                void handleImportFileSelection(event.target.files?.[0] || null)
              }
            />

            {importPreviewRows.length > 0 && (
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Parsed rows
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      {importPreviewRows.length} invites ready to upload
                    </p>
                  </div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-700">
                    Preview
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {importPreviewRows.slice(0, 4).map((row, index) => (
                    <div
                      key={`${row.email}-${index}`}
                      className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <p className="font-black text-slate-900">{row.email}</p>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        Role: {row.role || 'user'}
                      </p>
                    </div>
                  ))}

                  {importPreviewRows.length > 4 && (
                    <p className="text-sm font-medium text-slate-500">
                      {importPreviewRows.length - 4} more invites will be included in
                      the upload.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={clearImportSelection}
                disabled={
                  isImporting || isParsingImport || importPreviewRows.length === 0
                }
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset file
              </button>

              <button
                type="button"
                onClick={() => void handleImportSubmit()}
                disabled={
                  isImporting || isParsingImport || importPreviewRows.length === 0
                }
                className="inline-flex items-center justify-center rounded-2xl bg-[#16324F] px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isImporting ? 'Uploading CSV' : 'Upload invites'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={panelClass}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
              Registry
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              Learners and pending invites
            </h3>
          </div>

          <div className="relative w-full max-w-md">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by email, learner name, code, role, status, or id"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10"
            />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Learner / Invite</th>
                  <th className="px-5 py-4">Code / Role</th>
                  <th className="px-5 py-4">Cohorts</th>
                  <th className="px-5 py-4">Metadata</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm font-semibold text-slate-500"
                    >
                      {isLoading
                        ? 'Loading registry data.'
                        : 'No learners or invites matched the current search.'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-black text-slate-900">
                            {row.displayName}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            {row.email}
                          </p>
                          <p className="mt-2 text-xs font-medium text-slate-400">
                            {row.id}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-600">
                        {row.codeOrRole}
                      </td>
                      <td className="px-5 py-4">
                        {row.cohortTitles.length === 0 ? (
                          <span className="text-sm font-semibold text-slate-500">
                            Not assigned
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {row.cohortTitles.map((cohortTitle) => (
                              <span
                                key={`${row.id}-${cohortTitle}`}
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                              >
                                {cohortTitle}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1 text-sm font-semibold text-slate-600">
                          <p>{row.metadataPrimary}</p>
                          <p className="text-xs font-medium text-slate-400">
                            {row.metadataSecondary}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${row.statusBadgeClass}`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${row.sourceBadgeClass}`}
                        >
                          {row.sourceLabel}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentRegistryView;
