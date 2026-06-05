import React from 'react';
import { useParams } from 'react-router-dom';
import StudyPlanList from './StudyPlanList';
import StudyPlanDetail from './StudyPlanDetail';

const StudyPlanAuditDashboard: React.FC = () => {
  const { studyPlanId } = useParams<{ studyPlanId: string }>();
  return studyPlanId ? <StudyPlanDetail /> : <StudyPlanList />;
};

export default StudyPlanAuditDashboard;
