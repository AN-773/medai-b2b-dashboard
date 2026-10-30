import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

/** `/ask`, about a cohort. The title rides in history state: it is for the page, never for the agent. */
export const askAboutCohortPath = (cohortId: string, page: string) =>
  `/ask?${new URLSearchParams({ cohortId, page }).toString()}`;

interface AskAboutCohortButtonProps {
  /** The cohort's `id`, as the Tests service returns it. */
  cohortId: string;
  cohortTitle?: string;
  /** Which page this is: `cohort` or `mastery`. */
  page: 'cohort' | 'mastery';
}

/** Opens Ask with this cohort pre-filled. Nothing for an account that cannot use Ask. */
export const AskAboutCohortButton: React.FC<AskAboutCohortButtonProps> = ({ cohortId, cohortTitle, page }) => {
  const { canAsk } = useAuth();
  const navigate = useNavigate();
  if (!canAsk) return null;

  return (
    <Button
      variant="ai"
      icon={Sparkles}
      onClick={() => navigate(askAboutCohortPath(cohortId, page), { state: { cohortTitle } })}
    >
      Ask about this cohort
    </Button>
  );
};
