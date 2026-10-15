import React from 'react';
import { useParams } from 'react-router-dom';
import StudyPlanList from './StudyPlanList';
import StudyPlanDetail from './StudyPlanDetail';

const StudyPlanAuditDashboard: React.FC = () => {
  const { studyPlanIdentifier } = useParams<{
    studyPlanIdentifier: string;
  }>();
  // Keyed so switching plans starts from a clean workspace (tab, filters, drawers).
  return studyPlanIdentifier ? (
    <StudyPlanDetail key={studyPlanIdentifier} />
  ) : (
    <StudyPlanList />
  );
};

export default StudyPlanAuditDashboard;
