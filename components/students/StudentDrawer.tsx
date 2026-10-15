import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Mail, UsersRound } from 'lucide-react';
import type { TeacherCohort, TeacherStudent } from '@/types/AcademyStudioTypes';
import { Drawer, IconButton, cn } from '@/components/ui';
import { formatDate, formatDateRange, getStudentSourceLabel, plural } from './studentRegistryUtils';

interface StudentDrawerProps {
  student: TeacherStudent | null;
  cohorts: TeacherCohort[];
  onClose: () => void;
}

const DetailItem: React.FC<{
  label: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, className, children }) => (
  <div className={cn('min-w-0', className)}>
    <dt className="text-[13px] text-stone-500">{label}</dt>
    <dd className="mt-0.5 break-words text-sm text-stone-900">{children}</dd>
  </div>
);

const Missing: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-stone-400">{children}</span>
);

const CopyEmailButton: React.FC<{ email: string }> = ({ email }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <IconButton
      icon={copied ? Check : Copy}
      label={copied ? 'Copied' : 'Copy email'}
      size="sm"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(email)
          .then(() => setCopied(true))
          .catch(() => undefined);
      }}
    />
  );
};

/** Read-only profile of one student: contact details, cohorts and notes. */
const StudentDrawer: React.FC<StudentDrawerProps> = ({ student, cohorts, onClose }) => {
  if (!student) return null;
  const current = student;

  const added = formatDate(current.createdAt);

  return (
    <Drawer
      open={Boolean(student)}
      onClose={onClose}
      width="max-w-lg"
      title={current.name || 'Unnamed student'}
      description={current.email || 'No email yet'}
    >
      <div className="space-y-8 px-6 py-5">
        <section aria-labelledby="student-details-heading">
          <h3 id="student-details-heading" className="text-[15px] font-semibold text-stone-900">
            Details
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-stone-200 p-4">
            <DetailItem label="Email" className="col-span-2">
              {current.email ? (
                <span className="flex min-w-0 items-center gap-1">
                  <a
                    href={`mailto:${current.email}`}
                    className="inline-flex min-w-0 items-center gap-1.5 rounded hover:underline"
                  >
                    <Mail size={14} className="flex-shrink-0 text-stone-400" aria-hidden="true" />
                    <span className="truncate">{current.email}</span>
                  </a>
                  <CopyEmailButton email={current.email} />
                </span>
              ) : (
                <Missing>No email yet</Missing>
              )}
            </DetailItem>
            <DetailItem label="Student code">
              {current.learnerCode ? (
                <span className="tabular-nums">{current.learnerCode}</span>
              ) : (
                <Missing>No code</Missing>
              )}
            </DetailItem>
            <DetailItem label="Program">
              {current.program || <Missing>Not added</Missing>}
            </DetailItem>
            <DetailItem label="Added">
              {added ? <span className="tabular-nums">{added}</span> : <Missing>Not available</Missing>}
            </DetailItem>
            <DetailItem label="Added from">{getStudentSourceLabel(current.source)}</DetailItem>
          </dl>
        </section>

        <section aria-labelledby="student-cohorts-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="student-cohorts-heading" className="text-[15px] font-semibold text-stone-900">
              Cohorts
              {cohorts.length > 0 && (
                <span className="ml-1.5 font-normal tabular-nums text-stone-400">
                  {cohorts.length}
                </span>
              )}
            </h3>
            <Link
              to="/cohorts"
              className="rounded text-[13px] font-medium text-stone-600 hover:text-stone-900 hover:underline"
            >
              Manage cohorts
            </Link>
          </div>
          {cohorts.length === 0 ? (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-dashed border-stone-300 px-4 py-3.5">
              <UsersRound size={16} className="mt-0.5 flex-shrink-0 text-stone-400" aria-hidden="true" />
              <p className="text-[13px] leading-5 text-stone-500">
                Not in any cohort yet. Add this student to a cohort to give them access to its
                courses.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200">
              {cohorts.map((cohort) => {
                const dates = formatDateRange(cohort.startDate, cohort.endDate);
                const meta = [
                  cohort.term,
                  dates,
                  cohort.courseIds.length > 0 ? plural(cohort.courseIds.length, 'course') : null,
                ].filter(Boolean);
                return (
                  <li key={cohort.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-stone-900">{cohort.title}</p>
                    {meta.length > 0 && (
                      <p className="mt-0.5 text-[13px] text-stone-500">{meta.join(' · ')}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {current.notes && (
          <section aria-labelledby="student-notes-heading">
            <h3 id="student-notes-heading" className="text-[15px] font-semibold text-stone-900">
              Notes
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
              {current.notes}
            </p>
          </section>
        )}
      </div>
    </Drawer>
  );
};

export default StudentDrawer;
