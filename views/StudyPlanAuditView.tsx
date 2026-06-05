import React from 'react';
import StudyPlanAuditDashboard from '@/components/study-plan-audit/StudyPlanAuditDashboard';

const StudyPlanAuditView: React.FC = () => {
  return (
    <div className="min-h-full rounded-[2.5rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(27,209,131,0.08),_transparent_22%),linear-gradient(180deg,_#f8fbfc_0%,_#eef4f6_100%)] p-4 shadow-[0_30px_90px_-60px_rgba(15,23,42,0.8)] xl:p-6">
      <StudyPlanAuditDashboard />
    </div>
  );
};

export default StudyPlanAuditView;
