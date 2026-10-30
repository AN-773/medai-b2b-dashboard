import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui';
import { canAskFaculty, useAuth } from '@/contexts/AuthContext';
import ImportExamResultsDrawer from './ImportExamResultsDrawer';

interface ImportExamResultsButtonProps {
  /** The cohort's `id`, as the Tests service returns it. */
  cohortId: string;
  cohortTitle: string;
}

/**
 * Ask's tenant-role rule, read from the account and not from `canAsk`, which
 * also needs an agent on this site. This import goes to learning, so it doesn't.
 */
export const ImportExamResultsButton: React.FC<ImportExamResultsButtonProps> = ({
  cohortId,
  cohortTitle,
}) => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  if (!canAskFaculty(currentUser)) return null;

  return (
    <>
      <Button variant="secondary" icon={Upload} onClick={() => setIsOpen(true)}>
        Import exam results
      </Button>
      {isOpen && (
        <ImportExamResultsDrawer
          cohortId={cohortId}
          cohortTitle={cohortTitle}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
