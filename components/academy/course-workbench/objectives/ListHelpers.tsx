import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, IconButton, cn } from '@/components/ui';
import type { TeacherLearningObjective } from '@/types/AcademyStudioTypes';

/** Separator used between parts of a meta line ("Cardiovascular · Apply"). */
export const MetaDot: React.FC = () => (
  <span aria-hidden="true" className="text-stone-300">
    ·
  </span>
);

/** Organ system · cognitive skill · AI — the meta line under an objective title. */
export const ObjectiveMeta: React.FC<{
  objective: Pick<TeacherLearningObjective, 'organSystem' | 'cognitiveSkill' | 'source'>;
  className?: string;
}> = ({ objective, className }) => {
  const parts = [objective.organSystem, objective.cognitiveSkill].filter(
    (part): part is string => Boolean(part),
  );
  const isAi = objective.source === 'ai';
  if (parts.length === 0 && !isAi) return null;

  return (
    <div
      className={cn(
        'mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-stone-500',
        className,
      )}
    >
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          {index > 0 && <MetaDot />}
          <span>{part}</span>
        </React.Fragment>
      ))}
      {isAi && (
        <>
          {parts.length > 0 && <MetaDot />}
          <Badge tone="violet" title="AI-generated objective">
            AI
          </Badge>
        </>
      )}
    </div>
  );
};

const findScrollParent = (element: HTMLElement): HTMLElement | null => {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
};

/**
 * After paging, bring the top of a list back into view if it scrolled out of
 * sight — otherwise "Next" leaves you staring at the end of the new page.
 */
export const revealTop = (element: HTMLElement | null) => {
  if (!element) return;
  const top = element.getBoundingClientRect().top;
  const container = findScrollParent(element);
  if (container) {
    const offset = top - container.getBoundingClientRect().top;
    if (offset < 0) container.scrollTo({ top: container.scrollTop + offset - 16 });
  } else if (top < 0) {
    window.scrollTo({ top: window.scrollY + top - 16 });
  }
};

interface PaginationFooterProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}

/** Quiet "26–50 of 477" range with previous / next buttons. */
export const PaginationFooter: React.FC<PaginationFooterProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  disabled = false,
  className,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div
      className={cn(
        'flex min-h-11 items-center justify-between gap-3 text-[13px] text-stone-500',
        className,
      )}
    >
      <p className="tabular-nums">
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <IconButton
            icon={ChevronLeft}
            label="Previous page"
            size="sm"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          />
          <IconButton
            icon={ChevronRight}
            label="Next page"
            size="sm"
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          />
        </div>
      )}
    </div>
  );
};
