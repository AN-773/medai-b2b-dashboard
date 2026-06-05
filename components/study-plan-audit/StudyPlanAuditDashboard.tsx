import React from 'react';
import { useParams } from 'react-router-dom';
import StudyPlanList from './StudyPlanList';
import StudyPlanDetail from './StudyPlanDetail';

const StudyPlanAuditDashboard: React.FC = () => {
  const { studyPlanIdentifier } = useParams<{
    studyPlanIdentifier: string;
  }>();
  return studyPlanIdentifier ? <StudyPlanDetail /> : <StudyPlanList />;
};

export default StudyPlanAuditDashboard;
