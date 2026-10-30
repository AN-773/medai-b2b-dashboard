import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileUp } from 'lucide-react';
import { Button, Drawer, InlineAlert, Spinner } from '@/components/ui';
import {
  examResultsService,
  type ExamResultsFile,
  type ExamResultsReport,
} from '@/services/examResultsService';
import { plural } from './cohortModel';
import ExamResultsPreview, { ExamResultsTable } from './ExamResultsPreview';
import {
  EXAM_FILE_LIMITS,
  EXAM_RESULT_COLUMNS,
  canSaveExamResults,
  downloadExamResultsTemplate,
  examFileProblem,
  examImportRefusal,
  examTextProblem,
} from './examResultsModel';

const REIMPORT_NOTE = "Importing the same file again updates its rows and doesn't create duplicates.";

type Stage =
  | { name: 'choose' }
  | { name: 'checking'; source: string }
  | { name: 'preview' | 'saving' | 'saved'; file: ExamResultsFile; report: ExamResultsReport };

const ChooseFile: React.FC<{ onChoose: () => void }> = ({ onChoose }) => (
  <>
    <p className="text-sm leading-6 text-stone-600">
      Keep this cohort's real exam outcomes with its records. Choose a CSV file and check the
      preview. Nothing is saved until you confirm.
    </p>

    <section>
      <h3 className="text-sm font-medium text-stone-900">Columns your file needs</h3>
      <dl className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200">
        {EXAM_RESULT_COLUMNS.map(({ name, description }) => (
          <div key={name} className="flex flex-wrap items-baseline gap-x-4 px-4 py-2 text-[13px]">
            <dt className="w-24 font-mono text-stone-800">{name}</dt>
            <dd className="text-stone-500">{description}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[13px] leading-5 text-stone-500">
        Columns can be in any order, and other columns are ignored. A file can be{' '}
        {EXAM_FILE_LIMITS}. {REIMPORT_NOTE}
      </p>
    </section>

    <div className="flex flex-wrap gap-2">
      <Button variant="primary" icon={FileUp} onClick={onChoose}>
        Choose CSV file
      </Button>
      <Button variant="secondary" icon={Download} onClick={downloadExamResultsTemplate}>
        Download template
      </Button>
    </div>
  </>
);

const SavedResults: React.FC<{ report: ExamResultsReport; source: string }> = ({ report, source }) => (
  <>
    <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-brand-800">
        <CheckCircle2 size={16} aria-hidden="true" />
        Saved {plural(report.saved, 'exam result')}
      </p>
      <p className="mt-1 break-words text-[13px] leading-5 text-stone-600" dir="auto">
        They're in this cohort's records now, from {source}.
      </p>
      <p className="mt-1 text-[13px] leading-5 text-stone-600">{REIMPORT_NOTE}</p>
    </div>
    {report.rows.length > 0 && <ExamResultsTable rows={report.rows} />}
  </>
);

interface ImportExamResultsDrawerProps {
  cohortId: string;
  cohortTitle: string;
  onClose: () => void;
}

/**
 * CSV to saved results in three steps: choose a file, read its dry run, save.
 * The text that was previewed is the text that's saved; the file isn't read twice.
 */
const ImportExamResultsDrawer: React.FC<ImportExamResultsDrawerProps> = ({
  cohortId,
  cohortTitle,
  onClose,
}) => {
  const [stage, setStage] = useState<Stage>({ name: 'choose' });
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const isBusy = stage.name === 'checking' || stage.name === 'saving';

  // Each step replaces the button that led to it, which would drop focus out of the drawer.
  useEffect(() => {
    bodyRef.current?.focus();
  }, [stage.name]);

  const refuse = (message: string) => {
    setStage({ name: 'choose' });
    setError(message);
  };

  const checkFile = async (chosen: File) => {
    setError(null);
    const fileProblem = examFileProblem(chosen);
    if (fileProblem) return refuse(fileProblem);

    setStage({ name: 'checking', source: chosen.name });
    try {
      const csv = await chosen.text();
      const textProblem = examTextProblem(csv);
      if (textProblem) return refuse(textProblem);

      const file = { csv, source: chosen.name };
      const report = await examResultsService.importResults(cohortId, file, { dryRun: true });
      setStage({ name: 'preview', file, report });
    } catch (refusal) {
      refuse(examImportRefusal(refusal, { saving: false }));
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    // Cleared so a file fixed under the same name can be chosen again: choosing
    // the same path twice fires no change event otherwise.
    event.target.value = '';
    if (chosen) void checkFile(chosen);
  };

  const chooseFile = () => inputRef.current?.click();

  const save = async () => {
    if (stage.name !== 'preview' || !canSaveExamResults(stage.report)) return;
    setError(null);
    setStage({ ...stage, name: 'saving' });
    try {
      const report = await examResultsService.importResults(cohortId, stage.file, { dryRun: false });
      // A save with row errors saves nothing, and comes back here to show them.
      setStage({ name: report.saved > 0 ? 'saved' : 'preview', file: stage.file, report });
    } catch (refusal) {
      setStage(stage);
      setError(examImportRefusal(refusal, { saving: true }));
    }
  };

  const importAnother = () => {
    setError(null);
    setStage({ name: 'choose' });
  };

  const footer = (() => {
    if (stage.name === 'saved') {
      return (
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={importAnother}>
            Import another file
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      );
    }
    if (stage.name === 'preview' || stage.name === 'saving') {
      const ready = canSaveExamResults(stage.report);
      return (
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={chooseFile} disabled={isBusy}>
            Choose another file
          </Button>
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={!ready}
            loading={stage.name === 'saving'}
          >
            {ready ? `Save ${plural(stage.report.total, 'result')}` : 'Save results'}
          </Button>
        </div>
      );
    }
    return (
      <Button variant="ghost" className="ml-auto" onClick={onClose} disabled={isBusy}>
        Cancel
      </Button>
    );
  })();

  return (
    <Drawer
      open
      onClose={onClose}
      dismissible={!isBusy}
      title="Import exam results"
      description={cohortTitle}
      width="max-w-3xl"
      footer={footer}
    >
      <div ref={bodyRef} tabIndex={-1} className="space-y-5 px-6 py-5 outline-none">
        {error && <InlineAlert>{error}</InlineAlert>}

        {stage.name === 'choose' && <ChooseFile onChoose={chooseFile} />}
        {stage.name === 'checking' && (
          <div role="status" className="py-10">
            <Spinner label="Checking your file…" />
          </div>
        )}
        {(stage.name === 'preview' || stage.name === 'saving') && (
          <ExamResultsPreview report={stage.report} source={stage.file.source} />
        )}
        {stage.name === 'saved' && <SavedResults report={stage.report} source={stage.file.source} />}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Exam results CSV file"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </Drawer>
  );
};

export default ImportExamResultsDrawer;
