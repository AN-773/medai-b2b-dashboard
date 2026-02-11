
import React from 'react';
import { getTAPRStatus } from '../../utils/masteryMathStatus';

interface TAPRBadgeProps {
  tapr: number;
  showLabel?: boolean;
}

export const TAPRBadge: React.FC<TAPRBadgeProps> = ({ tapr, showLabel = true }) => {
  const status = getTAPRStatus(tapr);
  
  return (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${status.bg} ${status.color}`}>
      {tapr}x {showLabel && `• ${status.label}`}
    </span>
  );
};
