import React, { useState } from 'react';
import { FileSpreadsheet, Send, Upload, X } from 'lucide-react';
import {
  Button,
  Dialog,
  Drawer,
  Field,
  IconButton,
  InlineAlert,
  Input,
  Spinner,
  cn,
} from '@/components/ui';
import { getInviteRoleLabel, plural, type InvitePreviewRow } from './studentRegistryUtils';

const INVITE_FORM_ID = 'invite-student-form';
const PREVIEW_ROW_LIMIT = 50;

interface InviteStudentDialogProps {
  open: boolean;
  email: string;
  onEmailChange: (email: string) => void;
  error: string | null;
  isSending: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}

/** Short form: invite one person by email. */
export const InviteStudentDialog: React.FC<InviteStudentDialogProps> = ({
  open,
  email,
  onEmailChange,
  error,
  isSending,
  onSubmit,
  onClose,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    dismissible={!isSending}
    title="Invite a student"
    description="They'll get an email with a link to join. The invite stays pending until they accept."
    footer={
      <>
        <Button variant="ghost" onClick={onClose} disabled={isSending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          form={INVITE_FORM_ID}
          icon={Send}
          loading={isSending}
        >
          Send invite
        </Button>
      </>
    }
  >
    <form id={INVITE_FORM_ID} onSubmit={onSubmit} noValidate>
      <Field label="Email address" error={error}>
        {(id) => (
          <Input
            id={id}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="student@school.edu"
            aria-invalid={Boolean(error)}
            disabled={isSending}
          />
        )}
      </Field>
    </form>
  </Dialog>
);

interface ImportInvitesDrawerProps {
  open: boolean;
  onClose: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  file: File | null;
  previewRows: InvitePreviewRow[];
  error: string | null;
  onDismissError: () => void;
  isParsing: boolean;
  isImporting: boolean;
  onFileSelected: (file: File | null) => void;
  onClearFile: () => void;
  onSubmit: () => void;
}

/** Choose a CSV, check the parsed preview, then send every invite in it. */
export const ImportInvitesDrawer: React.FC<ImportInvitesDrawerProps> = ({
  open,
  onClose,
  fileInputRef,
  file,
  previewRows,
  error,
  onDismissError,
  isParsing,
  isImporting,
  onFileSelected,
  onClearFile,
  onSubmit,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const hasPreview = previewRows.length > 0;
  const busy = isParsing || isImporting;

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (busy) return;
    onFileSelected(event.dataTransfer.files?.[0] || null);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      dismissible={!isImporting}
      width="max-w-xl"
      title="Import invites from CSV"
      description="Invite a whole class at once"
      footer={
        <>
          <span className="truncate text-[13px] text-stone-500">
            {hasPreview ? `${plural(previewRows.length, 'invite')} ready to send` : 'Choose a file to continue'}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={isImporting} className="ml-auto">
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Send}
            onClick={onSubmit}
            disabled={!hasPreview || isParsing}
            loading={isImporting}
          >
            {hasPreview ? `Send ${plural(previewRows.length, 'invite')}` : 'Send invites'}
          </Button>
        </>
      }
    >
      <div className="space-y-5 px-6 py-5">
        {error && <InlineAlert onDismiss={onDismissError}>{error}</InlineAlert>}

        <div>
          <p className="text-sm leading-6 text-stone-700">
            Use a CSV with an <span className="font-medium text-stone-900">email</span> column.
            A <span className="font-medium text-stone-900">role</span> column is optional; rows
            without one get standard access.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs leading-5 text-stone-600">
            {'email,role\nana.silva@school.edu,user\nsam.lee@school.edu,user'}
          </pre>
        </div>

        {file && hasPreview ? (
          <div className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
              <FileSpreadsheet size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-900">{file.name}</p>
              <p className="text-[13px] text-stone-500">{plural(previewRows.length, 'invite')} found</p>
            </div>
            <IconButton
              icon={X}
              label="Remove file"
              size="sm"
              onClick={onClearFile}
              disabled={busy}
            />
          </div>
        ) : (
          <button
            type="button"
            data-autofocus
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            disabled={isParsing}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-wait',
              isDragging
                ? 'border-brand-500 bg-brand-50/60'
                : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50',
            )}
          >
            {isParsing ? (
              <Spinner label="Reading file…" />
            ) : (
              <>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                  <Upload size={18} aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-stone-900">Choose a CSV file</span>
                <span className="text-[13px] text-stone-500">or drag it here</span>
              </>
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => onFileSelected(event.target.files?.[0] || null)}
        />

        {hasPreview && (
          <section aria-labelledby="import-preview-heading">
            <h3 id="import-preview-heading" className="text-[15px] font-semibold text-stone-900">
              Preview
            </h3>
            <p className="mt-0.5 text-[13px] text-stone-500">
              Check the list before sending. If any rows are skipped, you&apos;ll see which ones
              afterwards.
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
              <table className="min-w-full text-left text-[13px]">
                <thead className="border-b border-stone-200 bg-stone-50/70 text-stone-500">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Access
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, PREVIEW_ROW_LIMIT).map((row, index) => (
                    <tr key={`${row.email}-${index}`} className="border-b border-stone-100 last:border-b-0">
                      <td className="max-w-[18rem] truncate px-4 py-2 text-stone-900">{row.email}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-stone-600">
                        {getInviteRoleLabel(row.role)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > PREVIEW_ROW_LIMIT && (
                <p className="border-t border-stone-100 bg-stone-50/60 px-4 py-2 text-[13px] text-stone-500">
                  and {plural(previewRows.length - PREVIEW_ROW_LIMIT, 'more invite')} will be included
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </Drawer>
  );
};
