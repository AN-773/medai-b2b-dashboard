import React from 'react';
import { Badge, type BadgeTone } from '@/components/ui';
import type { SkillStatus } from '@/services/tutorSkillsService';

const STATUS: Record<SkillStatus, { tone: BadgeTone; label: string }> = {
  published: { tone: 'green', label: 'Published' },
  draft_ahead: { tone: 'amber', label: 'Draft ahead' },
  unpublished: { tone: 'neutral', label: 'Unpublished' },
  archived: { tone: 'neutral', label: 'Archived' },
};

/** Where a tutor skill stands, as agent-v2 words it. */
const SkillStatusBadge: React.FC<{
  status: SkillStatus;
  publishedNumber: number | null;
  latestNumber: number;
}> = ({ status, publishedNumber, latestNumber }) => {
  const shown = STATUS[status];
  const title =
    status === 'draft_ahead'
      ? `Students get v${publishedNumber}; v${latestNumber} is saved but not published`
      : status === 'published'
        ? `Students get v${publishedNumber}`
        : undefined;
  return (
    <Badge tone={shown.tone} dot title={title}>
      {shown.label}
    </Badge>
  );
};

export default SkillStatusBadge;
