
import React from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid
} from 'recharts';
import { MOCK_STUDENTS } from '../constants';
import { OrganSystem } from '../types';
import DashboardCard from '../components/DashboardCard';

const StudentMasteryView: React.FC = () => {
  const cohortAverage = {
    [OrganSystem.Cardiovascular]: 72,
    [OrganSystem.Respiratory]: 68,
    [OrganSystem.Gastrointestinal]: 75,
    [OrganSystem.Renal]: 61,
    [OrganSystem.Neurology]: 64,
    [OrganSystem.Endocrine]: 70,
    [OrganSystem.Musculoskeletal]: 78,
    [OrganSystem.Reproductive]: 65
  };

  const radarData = Object.keys(cohortAverage).map(key => ({
    subject: key,
    A: cohortAverage[key as OrganSystem],
    fullMark: 100
  }));

  const atRiskStudents = MOCK_STUDENTS.filter(s => s.atRisk);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <DashboardCard title="Cohort Mastery Radar" subtitle="Average performance by organ system">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="Cohort Avg" dataKey="A" stroke="#1BD183" fill="#1BD183" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>

        <DashboardCard title="USMLE Step 1 Score Distribution" subtitle="Predicted ranges based on item performance">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { range: '190-210', count: 12 },
                { range: '210-230', count: 35 },
                { range: '230-250', count: 85 },
                { range: '250-270', count: 22 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#5D1AEC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>
      </div>

      <div className="space-y-6">
        <DashboardCard title="At-Risk Alerts" className="border-red-200 bg-red-50/20">
          <div className="space-y-4">
            {atRiskStudents.map(student => (
              <div key={student.studentId} className="p-4 bg-white rounded-lg border border-red-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900">{student.studentName}</h4>
                    <p className="text-xs text-red-600 font-medium">Predicted: {student.predictedStep1}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">High Alert</span>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-1">Critical Weakness: Renal System (30%)</p>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full">
                    <div className="bg-red-500 h-1.5 rounded-full" style={{ width: '30%' }}></div>
                  </div>
                </div>
                <button className="mt-4 w-full py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 transition">
                  Assign Remediation
                </button>
              </div>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard title="Misconception Clusters" subtitle="AI identified pattern-based errors">
          <div className="space-y-3">
            <div className="p-3 border border-amber-200 bg-amber-50 rounded-lg">
              <p className="text-sm font-semibold text-amber-900">Preload vs Afterload Confusion</p>
              <p className="text-xs text-amber-700 mt-1">45% of students chose distractor B on Cardio Q#45.</p>
            </div>
            <div className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
              <p className="text-sm font-semibold text-blue-900">Acid-Base Nomograms</p>
              <p className="text-xs text-blue-700 mt-1">Difficulty interpreting metabolic alkalosis items.</p>
            </div>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
};

export default StudentMasteryView;
