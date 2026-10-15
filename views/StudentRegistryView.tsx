import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, Mail, Upload, UserPlus, Users, X } from 'lucide-react';
import { academyStudioBackend } from '@/services/academyStudioBackend';
import { iamService, type IamInvite } from '@/services/iamService';
import { TeacherCohort, TeacherStudent } from '@/types/AcademyStudioTypes';
import {
  Button,
  EmptyState,
  InlineAlert,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Spinner,
} from '@/components/ui';
import StudentsTable from '@/components/students/StudentsTable';
import InvitesTable from '@/components/students/InvitesTable';
import StudentDrawer from '@/components/students/StudentDrawer';
import {
  ImportInvitesDrawer,
  InviteStudentDialog,
} from '@/components/students/InviteDialogs';
import {
  buildInviteSearchText,
  formatSkippedInviteSummary,
  getErrorMessage,
  isValidEmail,
  normalizeEmail,
  parseInviteCsvPreview,
  plural,
  type InvitePreviewRow,
} from '@/components/students/studentRegistryUtils';

const STUDENT_PAGE_SIZE = 25;
const TOAST_DURATION_MS = 6000;

type RegistryTab = 'learners' | 'invites';

const emptyInviteForm = {
  email: '',
};

const resolveExistingLearnerEmailsForInvites = async (invites: IamInvite[]) => {
  const uniqueEmails = Array.from(
    new Set(invites.map((invite) => normalizeEmail(invite.email)).filter(Boolean)),
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
  const toolbarRef = useRef<HTMLDivElement | null>(null);
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
  const [studentReloadKey, setStudentReloadKey] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<TeacherStudent | null>(null);
  const [pendingInvites, setPendingInvites] = useState<IamInvite[]>([]);
  const [pendingInviteTotal, setPendingInviteTotal] = useState(0);
  const [hiddenInviteCount, setHiddenInviteCount] = useState(0);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [isInviteLoading, setIsInviteLoading] = useState(true);
  const [inviteLoadError, setInviteLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<InvitePreviewRow[]>([]);
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
      setInviteLoadError(getErrorMessage(error, 'Unable to load pending invitations.'));
    } finally {
      if (inviteRequestIdRef.current === requestId) {
        setIsInviteLoading(false);
      }
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
        setStudentLoadError(getErrorMessage(error, 'Unable to load learners from the backend.'));
      })
      .finally(() => {
        if (learnerRequestIdRef.current !== requestId) return;
        setIsStudentLoading(false);
      });
  }, [deferredLearnerSearch, studentPage, studentReloadKey]);

  useEffect(() => {
    void loadPendingInvites();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  const cohortsByStudent = useMemo(() => {
    const map = new Map<string, TeacherCohort[]>();

    cohorts.forEach((cohort) => {
      cohort.studentIds.forEach((studentId) => {
        const current = map.get(studentId) || [];
        current.push(cohort);
        map.set(studentId, current);
      });
    });

    return map;
  }, [cohorts]);

  const filteredPendingInvites = useMemo(() => {
    const query = deferredInviteSearch.toLowerCase();
    if (!query) return pendingInvites;

    return pendingInvites.filter((invite) => buildInviteSearchText(invite).includes(query));
  }, [deferredInviteSearch, pendingInvites]);

  const cohortLinkedStudents = useMemo(
    () => students.filter((student) => cohortsByStudent.has(student.id)).length,
    [cohortsByStudent, students],
  );

  const studentTotalPages = Math.max(1, Math.ceil(studentTotal / STUDENT_PAGE_SIZE));
  const visibleStudentRangeStart =
    studentTotal === 0 ? 0 : (studentPage - 1) * STUDENT_PAGE_SIZE + 1;
  const visibleStudentRangeEnd =
    studentTotal === 0 ? 0 : visibleStudentRangeStart + students.length - 1;

  const handleStudentPageChange = (nextPage: number) => {
    setStudentPage(nextPage);
    // Bring the top of the list back into view when paging from the footer.
    const toolbar = toolbarRef.current;
    const scrollTop = document.getElementById('page-scroll')?.getBoundingClientRect().top ?? 0;
    if (toolbar && toolbar.getBoundingClientRect().top < scrollTop) {
      toolbar.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  const clearImportSelection = () => {
    setImportFile(null);
    setImportPreviewRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openInviteDialog = () => {
    setInviteError(null);
    setIsInviteDialogOpen(true);
  };

  const closeInviteDialog = () => {
    if (isInviting) return;
    setIsInviteDialogOpen(false);
    setInviteForm(emptyInviteForm);
    setInviteError(null);
  };

  const openImportDrawer = () => {
    setImportError(null);
    setIsImportDrawerOpen(true);
  };

  const closeImportDrawer = () => {
    if (isImporting) return;
    setIsImportDrawerOpen(false);
    clearImportSelection();
    setImportError(null);
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
      setIsInviteDialogOpen(false);
      setActiveTab('invites');
      await loadPendingInvites();
    } catch (error) {
      setInviteError(getErrorMessage(error, 'Unable to send the invitation.'));
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
      setImportError(getErrorMessage(error, 'Unable to parse the uploaded CSV.'));
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
      setIsImportDrawerOpen(false);
      setActiveTab('invites');
      await loadPendingInvites();
    } catch (error) {
      setImportError(getErrorMessage(error, 'Unable to import invitations from the CSV file.'));
    } finally {
      setIsImporting(false);
    }
  };

  const inviteActions = (
    <>
      <Button icon={Upload} onClick={openImportDrawer}>
        Import CSV
      </Button>
      <Button variant="primary" icon={UserPlus} onClick={openInviteDialog}>
        Invite student
      </Button>
    </>
  );

  const renderStudents = () => {
    if (studentLoadError) {
      return (
        <InlineAlert
          title="Couldn't load students"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setStudentReloadKey((current) => current + 1)}
            >
              Try again
            </Button>
          }
        >
          {studentLoadError}
        </InlineAlert>
      );
    }

    if (students.length === 0) {
      if (isStudentLoading) {
        return <Spinner label="Loading students…" className="py-24" />;
      }

      if (deferredLearnerSearch) {
        return (
          <EmptyState
            compact
            icon={Users}
            title="No students match this search"
            description="Search looks at names, emails and student codes."
            action={
              <Button variant="ghost" size="sm" onClick={() => setLearnerSearchQuery('')}>
                Clear search
              </Button>
            }
          />
        );
      }

      return (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Invite students by email or import a class list. They'll appear here once they join."
          action={inviteActions}
        />
      );
    }

    return (
      <StudentsTable
        students={students}
        cohortsByStudent={cohortsByStudent}
        isLoading={isStudentLoading}
        selectedStudentId={selectedStudent?.id ?? null}
        onOpenStudent={setSelectedStudent}
        page={studentPage}
        totalPages={studentTotalPages}
        total={studentTotal}
        rangeStart={visibleStudentRangeStart}
        rangeEnd={visibleStudentRangeEnd}
        inCohortOnPage={cohortLinkedStudents}
        onPageChange={handleStudentPageChange}
      />
    );
  };

  const renderInvites = () => {
    if (inviteLoadError) {
      return (
        <InlineAlert
          title="Couldn't load invites"
          action={
            <Button size="sm" variant="secondary" onClick={() => void loadPendingInvites()}>
              Try again
            </Button>
          }
        >
          {inviteLoadError}
        </InlineAlert>
      );
    }

    if (pendingInvites.length === 0) {
      if (isInviteLoading) {
        return <Spinner label="Loading invites…" className="py-24" />;
      }

      return (
        <EmptyState
          icon={Mail}
          title="No pending invites"
          description={
            hiddenInviteCount > 0
              ? `${plural(pendingInviteTotal, 'pending invite')} ${pendingInviteTotal === 1 ? 'is' : 'are'} hidden because those people have already joined as students.`
              : 'Invites you send appear here until the student accepts.'
          }
          action={inviteActions}
        />
      );
    }

    if (filteredPendingInvites.length === 0) {
      return (
        <EmptyState
          compact
          icon={Mail}
          title="No invites match this search"
          description="Search looks at email, access and status."
          action={
            <Button variant="ghost" size="sm" onClick={() => setInviteSearchQuery('')}>
              Clear search
            </Button>
          }
        />
      );
    }

    return (
      <InvitesTable
        invites={filteredPendingInvites}
        totalVisible={pendingInvites.length}
        hiddenCount={hiddenInviteCount}
        isLoading={isInviteLoading}
      />
    );
  };

  const isLearnersTab = activeTab === 'learners';
  const studentCount =
    studentLoadError || (isStudentLoading && students.length === 0) ? undefined : studentTotal;
  const inviteCount =
    inviteLoadError || (isInviteLoading && pendingInvites.length === 0)
      ? undefined
      : pendingInvites.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Find students, see which cohorts they're in, and invite anyone who still needs access."
        actions={inviteActions}
      />

      <div ref={toolbarRef} className="flex scroll-mt-4 flex-wrap items-center gap-3">
        <SegmentedControl<RegistryTab>
          label="Show"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'learners', label: 'Students', count: studentCount },
            { value: 'invites', label: 'Pending invites', count: inviteCount },
          ]}
        />
        <SearchInput
          key={activeTab}
          value={isLearnersTab ? learnerSearchQuery : inviteSearchQuery}
          onChange={isLearnersTab ? setLearnerSearchQuery : setInviteSearchQuery}
          placeholder={
            isLearnersTab ? 'Search name, email or student code' : 'Search email, access or status'
          }
          className="w-full sm:ml-auto sm:w-80"
        />
      </div>

      <div className="space-y-4">
        {isLearnersTab && studentWarning && (
          <InlineAlert tone="warning" onDismiss={() => setStudentWarning(null)}>
            {studentWarning}
          </InlineAlert>
        )}
        {isLearnersTab ? renderStudents() : renderInvites()}
      </div>

      <StudentDrawer
        student={selectedStudent}
        cohorts={selectedStudent ? cohortsByStudent.get(selectedStudent.id) || [] : []}
        onClose={() => setSelectedStudent(null)}
      />

      <InviteStudentDialog
        open={isInviteDialogOpen}
        email={inviteForm.email}
        onEmailChange={(email) => {
          setInviteForm({ email });
          if (inviteError) setInviteError(null);
        }}
        error={inviteError}
        isSending={isInviting}
        onSubmit={(event) => void handleInviteSubmit(event)}
        onClose={closeInviteDialog}
      />

      <ImportInvitesDrawer
        open={isImportDrawerOpen}
        onClose={closeImportDrawer}
        fileInputRef={fileInputRef}
        file={importFile}
        previewRows={importPreviewRows}
        error={importError}
        onDismissError={() => setImportError(null)}
        isParsing={isParsingImport}
        isImporting={isImporting}
        onFileSelected={(file) => void handleImportFileSelection(file)}
        onClearFile={clearImportSelection}
        onSubmit={() => void handleImportSubmit()}
      />

      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[140] w-[min(92vw,460px)] -translate-x-1/2"
      >
        {message && (
          <div
            role="status"
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg bg-stone-900 px-4 py-3 text-sm text-white shadow-pop animate-dialog-in"
          >
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-brand-400" />
            <span className="min-w-0 flex-1 break-words">{message}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-stone-400 transition hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentRegistryView;
