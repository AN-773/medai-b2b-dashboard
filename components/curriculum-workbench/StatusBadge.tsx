import React from 'react';
import { CheckCircle2, PencilRuler } from 'lucide-react';
import { CurriculumStatus } from '../../types/TestsServiceTypes';

interface StatusBadgeProps {
  status: CurriculumStatus;
  currentVersion?: number;
  size?: 'sm' | 'md';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, currentVersion, size = 'sm' }) => {
  const isPublished = status === 'published';
  const Icon = isPublished ? CheckCircle2 : PencilRuler;
  const pad = size === 'md' ? 'px-3 py-1.5 text-[11px]' : 'px-2.5 py-1 text-[10px]';
  const iconSize = size === 'md' ? 13 : 11;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-widest ${pad} ${
        isPublished
          ? 'bg-[#1BD183]/10 text-[#0f8f59] border border-[#1BD183]/20'
          : 'bg-amber-50 text-amber-600 border border-amber-200'
      }`}
    >
      <Icon size={iconSize} />
      {isPublished
        ? currentVersion
          ? `Published · v${currentVersion}`
          : 'Published'
        : 'Draft'}
    </span>
  );
};

export default StatusBadge;
