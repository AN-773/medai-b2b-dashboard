import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FileSpreadsheet,
  Search,
  Upload,
} from 'lucide-react';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import {
  iamService,
  type IamInvite,
  type InviteImportResponse,
} from '@/services/iamService';
import {
  TeacherCohort,
  TeacherStudent,
} from '@/types/AcademyStudioTypes';

const STUDENT_PAGE_SIZE = 25;

const panelClass =
  'rounded-[1.75rem] border border-slate-200/90 bg-white p-5 shadow-sm md:p-6';
const summaryCardClass =
  'rounded-[1.35rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4';
const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10';
const tabButtonClass =
  'inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition';
const sectionTitleClass = 'text-xl font-semibold tracking-tight text-slate-900';
const sectionDescriptionClass = 'mt-1 text-sm leading-6 text-slate-500';
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-2xl bg-[#16324F] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300';
const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50';

interface InvitePreviewRow {
  email: string;
  role: string;
}

type RegistryTab = 'learners' | 'invites';

const emptyInviteForm = {
  email: '',
};

const formatSkippedInviteSummary = (response: InviteImportResponse) => {
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

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());

const normalizeEmail = (value?: string | null) =>
  value?.trim().toLowerCase() || '';

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

const formatTimestamp = (value?: string) => {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const buildInviteSearchText = (invite: IamInvite) =>
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

const getStudentSourceBadgeClass = (source: TeacherStudent['source']) => {
  if (source === 'manual') {
    return 'bg-sky-100 text-sky-700';
  }

  if (source === 'spreadsheet') {
    return 'bg-violet-100 text-violet-700';
  }

  return 'bg-emerald-100 text-emerald-700';
};

const getStudentSourceLabel = (source: TeacherStudent['source']) => {
  if (source === 'manual') return 'Added here';
  if (source === 'spreadsheet') return 'CSV import';
  return 'Synced';
};

const getInviteRoleLabel = (role?: string | null) => {
  const normalizedRole = role?.trim().toLowerCase();
  if (!normalizedRole || normalizedRole === 'user') {
    return 'Standard';
  }

  return normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
};

const getInviteStatusBadgeClass = (status?: string | null) => {
  const normalizedStatus = status?.trim().toLowerCase();

  if (!normalizedStatus || normalizedStatus === 'pending') {
    return 'bg-amber-100 text-amber-700';
  }

  if (normalizedStatus === 'accepted') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (normalizedStatus === 'expired') {
    return 'bg-rose-100 text-rose-700';
  }

  return 'bg-slate-100 text-slate-600';
};

const getInviteStatusLabel = (status?: string | null) => {
  const normalizedStatus = status?.trim().toLowerCase();

  if (!normalizedStatus || normalizedStatus === 'pending') {
    return 'Waiting';
  }

  return normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
};

const resolveExistingLearnerEmailsForInvites = async (
  invites: IamInvite[],
) => {
  const uniqueEmails = Array.from(
    new Set(
      invites
        .map((invite) => normalizeEmail(invite.email))
        .filter(Boolean),
    ),
  );

  if (uniqueEmails.length === 0) {
    return new Set<string>();
  }

  const results = await Promise.allSettled(
    uniqueEmails.map(async (email) => {
      const response = await iamService.listUsers({
        search: email,
        limit: 10,
        page: 1,
      });

      const hasExactMatch = response.items.some(
        (user) => normalizeEmail(user.email) === email,
      );

      return hasExactMatch ? email : null;
    }),
  );

  const learnerEmails = new Set<string>();

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      learnerEmails.add(result.value);
      return;
    }

    if (result.status === 'rejected') {
      console.error(
        `Failed to verify learner email for pending invite "${uniqueEmails[index]}".`,
        result.reason,
      );
    }
  });

  return learnerEmails;
};

const StudentRegistryView: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const learnerRequestIdRef = useRef(0);
  const inviteRequestIdRef = useRef(0);
  const [activeTab, setActiveTab] = useState<RegistryTab>('learners');
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotal, setStudentTotal] = useState(0);
  const [cohorts, setCohorts] = useState<TeacherCohort[]>([]);
  const [learnerSearchQuery, setLearnerSearchQuery] = useState('');
  const [isStudentLoading, setIsStudentLoading] = useState(true);
  const [studentLoadError, setStudentLoadError] = useState<string | null>(null);
  const [studentWarning, setStudentWarning] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<IamInvite[]>([]);
  const [pendingInviteTotal, setPendingInviteTotal] = useState(0);
  const [hiddenInviteCount, setHiddenInviteCount] = useState(0);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [isInviteLoading, setIsInviteLoading] = useState(true);
  const [inviteLoadError, setInviteLoadError] = useState<string | null>(null);
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
  const deferredLearnerSearch = useDeferredValue(learnerSearchQuery.trim());
  const deferredInviteSearch = useDeferredValue(inviteSearchQuery.trim());

  const loadPendingInvites = async () => {
    const requestId = inviteRequestIdRef.current + 1;
    inviteRequestIdRef.current = requestId;
    setIsInviteLoading(true);
    setInviteLoadError(null);

    try {
      const response = await iamService.listInvites('pending');
      const existingLearnerEmails = await resolveExistingLearnerEmailsForInvites(
        response.items,
      );

      if (inviteRequestIdRef.current !== requestId) return;

      const visibleInvites = response.items.filter((invite) => {
        const email = normalizeEmail(invite.email);
        return !email || !existingLearnerEmails.has(email);
      });

      setPendingInvites(visibleInvites);
      setPendingInviteTotal(response.items.length);
      setHiddenInviteCount(response.items.length - visibleInvites.length);
    } catch (error) {
      if (inviteRequestIdRef.current !== requestId) return;

      console.error('Failed to load pending invites:', error);
      setPendingInvites([]);
      setPendingInviteTotal(0);
      setHiddenInviteCount(0);
      setInviteLoadError(
        getErrorMessage(error, 'Unable to load pending invitations.'),
      );
    } finally {
      if (inviteRequestIdRef.current !== requestId) return;
      setIsInviteLoading(false);
    }
  };

  useEffect(() => {
    setStudentPage(1);
  }, [learnerSearchQuery]);

  useEffect(() => {
    const requestId = learnerRequestIdRef.current + 1;
    learnerRequestIdRef.current = requestId;
    setIsStudentLoading(true);
    setStudentLoadError(null);
    setStudentWarning(null);

    void academyStudioBackend
      .loadStudentRegistryPage({
        page: studentPage,
        limit: STUDENT_PAGE_SIZE,
        search: deferredLearnerSearch,
      })
      .then((result) => {
        if (learnerRequestIdRef.current !== requestId) return;

        setStudents(result.students);
        setStudentTotal(result.total);
        setCohorts(result.cohorts);
        setStudentWarning(result.warnings.length > 0 ? result.warnings.join(' ') : null);
      })
      .catch((error: unknown) => {
        if (learnerRequestIdRef.current !== requestId) return;

        console.error('Failed to load paged student registry:', error);
        setStudents([]);
        setStudentTotal(0);
        setCohorts([]);
        setStudentWarning(null);
        setStudentLoadError(
          getErrorMessage(error, 'Unable to load learners from the backend.'),
        );
      })
      .finally(() => {
        if (learnerRequestIdRef.current !== requestId) return;
        setIsStudentLoading(false);
      });
  }, [deferredLearnerSearch, studentPage]);

  useEffect(() => {
    void loadPendingInvites();
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

  const filteredPendingInvites = useMemo(() => {
    const query = deferredInviteSearch.toLowerCase();
    if (!query) return pendingInvites;

    return pendingInvites.filter((invite) =>
      buildInviteSearchText(invite).includes(query),
    );
  }, [deferredInviteSearch, pendingInvites]);

  const cohortLinkedStudents = useMemo(
    () =>
      students.filter((student) => cohortTitlesByStudent.has(student.id)).length,
    [cohortTitlesByStudent, students],
  );

  const studentTotalPages = Math.max(
    1,
    Math.ceil(studentTotal / STUDENT_PAGE_SIZE),
  );
  const visibleStudentRangeStart =
    studentTotal === 0 ? 0 : (studentPage - 1) * STUDENT_PAGE_SIZE + 1;
  const visibleStudentRangeEnd =
    studentTotal === 0 ? 0 : visibleStudentRangeStart + students.length - 1;

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
      setInviteError('Enter a valid email address.');
      return;
    }

    setIsInviting(true);

    try {
      const email = inviteForm.email.trim();
      await iamService.createInvite(email);
      setInviteForm(emptyInviteForm);
      setMessage(`Invite sent to ${email}.`);
      await loadPendingInvites();
    } catch (error) {
      setInviteError(
        getErrorMessage(error, 'Unable to send the invitation.'),
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
        throw new Error('No email rows were found in the CSV.');
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
      setImportError('Choose a CSV file first.');
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setInviteError(null);
    setMessage(null);

    try {
      const fileName = importFile.name;
      const response = await iamService.importInvites(importFile);
      clearImportSelection();
      const skippedSummary = formatSkippedInviteSummary(response);
      setMessage(
        skippedSummary
          ? `${response.created} invite${response.created === 1 ? '' : 's'} added from ${fileName}. ${skippedSummary}`
          : `${response.created} invite${response.created === 1 ? '' : 's'} added from ${fileName}.`,
      );
      await loadPendingInvites();
    } catch (error) {
      setImportError(
        getErrorMessage(error, 'Unable to import invitations from the CSV file.'),
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="teacher-readable space-y-5">
      {message && (
        <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      )}

      <div className={panelClass}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Students
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Find students, check which groups they belong to, and send invites
              when someone still needs access.
            </p>
          </div>

          <div className="inline-flex w-full rounded-[1rem] bg-slate-100 p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('learners')}
              className={`${tabButtonClass} ${
                activeTab === 'learners'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Students
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invites')}
              className={`${tabButtonClass} ${
                activeTab === 'invites'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Invites
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className={summaryCardClass}>
            <p className="text-sm font-medium text-slate-500">Students</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {studentTotal}
            </p>
          </div>
          <div className={summaryCardClass}>
            <p className="text-sm font-medium text-slate-500">In a group</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {cohortLinkedStudents}
            </p>
          </div>
          <div className={summaryCardClass}>
            <p className="text-sm font-medium text-slate-500">Open invites</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {pendingInviteTotal}
            </p>
          </div>
        </div>
      </div>

      {activeTab === 'learners' ? (
        <div className={panelClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className={sectionTitleClass}>Student list</h2>
              <p className={`${sectionDescriptionClass} max-w-2xl`}>
                Search by name, email, or student code. Results load one page at a
                time to keep things fast.
              </p>
            </div>

            <div className="relative w-full max-w-md">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={learnerSearchQuery}
                onChange={(event) => setLearnerSearchQuery(event.target.value)}
                placeholder="Search by name, email, or student code"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10"
              />
            </div>
          </div>

          {studentWarning && (
            <div className="mt-5 rounded-[1.35rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {studentWarning}
            </div>
          )}

          {studentLoadError && (
            <div className="mt-5 rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {studentLoadError}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p>
              {studentTotal === 0
                ? 'No students yet.'
                : `Showing ${visibleStudentRangeStart}-${visibleStudentRangeEnd} of ${studentTotal} students`}
            </p>
            {isStudentLoading && <p>Loading students...</p>}
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Student</th>
                    <th className="px-5 py-4">Code</th>
                    <th className="px-5 py-4">Groups</th>
                    <th className="px-5 py-4">Details</th>
                    <th className="px-5 py-4">Added from</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {students.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-12 text-center text-sm font-medium text-slate-500"
                      >
                        {isStudentLoading
                          ? 'Loading students.'
                          : deferredLearnerSearch
                            ? 'No students matched this search.'
                            : 'No students found.'}
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      const cohortTitles = cohortTitlesByStudent.get(student.id) || [];

                      return (
                        <tr key={student.id}>
                          <td className="px-5 py-4">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {student.name || 'Unnamed student'}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {student.email || 'No email yet'}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 font-medium text-slate-600">
                            {student.learnerCode || 'No code'}
                          </td>
                          <td className="px-5 py-4">
                            {cohortTitles.length === 0 ? (
                              <span className="text-sm text-slate-500">
                                No group yet
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {cohortTitles.map((cohortTitle) => (
                                  <span
                                    key={`${student.id}-${cohortTitle}`}
                                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                                  >
                                    {cohortTitle}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-1 text-sm text-slate-600">
                              <p>{student.program || 'Program not added'}</p>
                              <p className="text-xs text-slate-400">
                                {student.notes || `Added ${formatTimestamp(student.createdAt)}`}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStudentSourceBadgeClass(
                                student.source,
                              )}`}
                            >
                              {getStudentSourceLabel(student.source)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setStudentPage((current) => Math.max(1, current - 1))
              }
              disabled={studentPage === 1 || isStudentLoading}
              className={secondaryButtonClass}
            >
              Previous
            </button>
            <p className="text-sm font-medium text-slate-500">
              Page {studentPage} of {studentTotalPages}
            </p>
            <button
              type="button"
              onClick={() =>
                setStudentPage((current) =>
                  Math.min(studentTotalPages, current + 1),
                )
              }
              disabled={studentPage >= studentTotalPages || isStudentLoading}
              className={secondaryButtonClass}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className={panelClass}>
              <h2 className={sectionTitleClass}>Invite one student</h2>
              <p className={`${sectionDescriptionClass} max-w-xl`}>
                Send an email invite to someone who is not in the student list yet.
              </p>

              {inviteError && (
                <div className="mt-5 rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
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
                    placeholder="user@example.com"
                    className={inputClass}
                  />
                </label>

                <div className="flex flex-col gap-4 border-t border-slate-100 pt-5">
                  <p className="text-sm leading-6 text-slate-500">
                    Once sent, the invite will show below until the student joins.
                  </p>

                  <button
                    type="submit"
                    disabled={isInviting}
                    className={primaryButtonClass}
                  >
                    {isInviting ? 'Sending invite...' : 'Send invite'}
                  </button>
                </div>
              </form>
            </div>

            <div className={`${panelClass} bg-slate-50/70`}>
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-3 text-slate-600 shadow-sm">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h2 className={sectionTitleClass}>Invite from a CSV file</h2>
                  <p className={sectionDescriptionClass}>
                    Upload a CSV with an email column. A role column is optional.
                  </p>
                </div>
              </div>

              {importError && (
                <div className="mt-5 rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {importError}
                </div>
              )}

              <div className="mt-5 space-y-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingImport}
                  className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center transition hover:border-[#1BD183] hover:bg-[#1BD183]/5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                    <Upload size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {isParsingImport
                        ? 'Reading file...'
                        : importFile?.name || 'Choose CSV file'}
                    </p>
                    <p className="text-sm text-slate-500">
                      Expected columns: email, role (optional)
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
                  <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {importPreviewRows.length} invite
                          {importPreviewRows.length === 1 ? '' : 's'} ready
                        </p>
                      </div>
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                        Preview
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {importPreviewRows.slice(0, 4).map((row, index) => (
                        <div
                          key={`${row.email}-${index}`}
                          className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                        >
                          <p className="font-semibold text-slate-900">{row.email}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Access: {getInviteRoleLabel(row.role)}
                          </p>
                        </div>
                      ))}

                      {importPreviewRows.length > 4 && (
                        <p className="text-sm text-slate-500">
                          {importPreviewRows.length - 4} more invite
                          {importPreviewRows.length - 4 === 1 ? '' : 's'} will be
                          included.
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
                    className={secondaryButtonClass}
                  >
                    Clear file
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleImportSubmit()}
                    disabled={
                      isImporting || isParsingImport || importPreviewRows.length === 0
                    }
                    className={primaryButtonClass}
                  >
                    {isImporting ? 'Sending invites...' : 'Send invites from file'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={panelClass}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className={sectionTitleClass}>Open invites</h2>
                <p className={sectionDescriptionClass}>
                  See which invites are still waiting.
                </p>
              </div>

              <div className="relative w-full max-w-md">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={inviteSearchQuery}
                  onChange={(event) => setInviteSearchQuery(event.target.value)}
                  placeholder="Search by email, access, or status"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#1BD183] focus:ring-2 focus:ring-[#1BD183]/10"
                />
              </div>
            </div>

            {inviteLoadError && (
              <div className="mt-5 rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {inviteLoadError}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p>
                {pendingInviteTotal === 0
                  ? 'No open invites.'
                  : `${filteredPendingInvites.length} invite${filteredPendingInvites.length === 1 ? '' : 's'} shown`}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {hiddenInviteCount > 0 && (
                  <p>
                    {hiddenInviteCount} hidden because those students already exist.
                  </p>
                )}
                {isInviteLoading && <p>Loading invites...</p>}
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Email</th>
                      <th className="px-5 py-4">Access</th>
                      <th className="px-5 py-4">Sent</th>
                      <th className="px-5 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredPendingInvites.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-5 py-12 text-center text-sm font-medium text-slate-500"
                        >
                          {isInviteLoading
                            ? 'Loading invites.'
                            : deferredInviteSearch
                              ? 'No invites matched this search.'
                              : hiddenInviteCount > 0
                                ? 'All open invites are hidden because those students already exist.'
                                : 'No invites found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredPendingInvites.map((invite) => (
                        <tr key={invite.id}>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">{invite.email}</p>
                          </td>
                          <td className="px-5 py-4 font-medium text-slate-600">
                            {getInviteRoleLabel(invite.role)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-1 text-sm text-slate-600">
                              <p>Sent {formatTimestamp(invite.created)}</p>
                              <p className="text-xs text-slate-400">
                                Expires {formatTimestamp(invite.expiresAt)}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getInviteStatusBadgeClass(
                                invite.status,
                              )}`}
                            >
                              {getInviteStatusLabel(invite.status)}
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
        </>
      )}
    </div>
  );
};

export default StudentRegistryView;
