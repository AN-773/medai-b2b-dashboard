
import { StudentMastery, CohortMetrics, FacultyTimeSavings, FacultyAlert, BloomsLevel, USMLEStandardCategory } from '../types';


/**
 * Interface representing coverage metrics for an organ system.
 */
export interface SystemCoverage {
  id: string;
  name: string;
  count: number;
  coveragePercent: number;
  status: 'Optimal' | 'Critical' | 'Warning';
  bloomCounts: Record<string, number>;
}

// Fix: Implement computeCoverage to map curriculum data to the audit matrix format.
export const computeCoverage = (curriculum: USMLEStandardCategory[]): SystemCoverage[] => {
  return curriculum.map(sys => {
    const bloomCounts: Record<string, number> = {
      [BloomsLevel.Remember]: 0,
      [BloomsLevel.Understand]: 0,
      [BloomsLevel.Apply]: 0,
      [BloomsLevel.Analyze]: 0,
    };
    
    let totalObjectives = 0;
    sys.topics.forEach(topic => {
      topic.objectives?.forEach(obj => {
        totalObjectives++;
        if (bloomCounts[obj.bloomLevel] !== undefined) {
          bloomCounts[obj.bloomLevel]++;
        }
      });
    });

    // Calculate coverage percentage based on an institutional target of 30 objectives per system.
    const coveragePercent = Math.min(100, Math.round((totalObjectives / 30) * 100));
    
    let status: 'Optimal' | 'Critical' | 'Warning' = 'Warning';
    if (totalObjectives >= 15) status = 'Optimal';
    else if (totalObjectives < 5) status = 'Critical';

    return {
      id: sys.id,
      name: sys.name,
      count: totalObjectives,
      coveragePercent,
      status,
      bloomCounts
    };
  });
};

export const calculateCohortMetrics = (students: StudentMastery[], timeRange: string): CohortMetrics => {
  // Static mock data replacing SINA_AIAgent.analyzeCohort
  return {
    avgReadiness: 72,
    readinessChange: '+4%',
    atRiskCount: Math.round(students.length * 0.15),
    riskChange: '-2',
    avgTAPR: 85,
    taprChange: '+1.2',
    avgCoverage: 64,
    coverageChange: '+8%',
    readinessDistribution: [
      { range: 'High', count: Math.round(students.length * 0.4) },
      { range: 'Medium', count: Math.round(students.length * 0.3) },
      { range: 'Low', count: Math.round(students.length * 0.2) },
      { range: 'Critical', count: Math.round(students.length * 0.1) }
    ],
    systemMastery: [
      { system: 'Cardiovascular', mastery: 82 },
      { system: 'Respiratory', mastery: 78 },
      { system: 'Renal', mastery: 65 },
      { system: 'Neurology', mastery: 70 },
      { system: 'Gastrointestinal', mastery: 75 }
    ],
    trendData: [], 
    bloomDistribution: []
  };
};

export const getFacultyTimeSavings = (students: StudentMastery[]): FacultyTimeSavings => {
  // Static mock calculation replacing SINA_AIAgent.analyzeStudent
  const atRiskCount = Math.floor(students.length * 0.15);
  
  const traditionalTime = students.length * 0.5;
  const sinaTime = atRiskCount * (5/60) + (students.length - atRiskCount) * (2/60);
  
  return {
    hoursThisWeek: Math.round((traditionalTime - sinaTime) * 5),
    hoursThisMonth: Math.round((traditionalTime - sinaTime) * 20),
    efficiencyGain: Math.round(((traditionalTime - sinaTime) / (traditionalTime || 1)) * 100)
  };
};

export const generateFacultyAlerts = (students: StudentMastery[]): FacultyAlert[] => {
  // Static mock alerts replacing SINA_AIAgent.analyzeStudent
  const atRiskCount = Math.floor(students.length * 0.15);
  const renalWeak = Math.floor(students.length * 0.25);
  
  return [
    {
      id: 'alert-1',
      title: `${atRiskCount} Students At Risk`,
      description: `Early detection enabled for ${Math.round(atRiskCount/(students.length || 1)*100)}% of cohort.`,
      priority: atRiskCount > students.length * 0.3 ? 'HIGH' : 'MEDIUM',
      timeAgo: 'Just now',
      suggestedAction: 'Review intervention queue'
    },
    {
      id: 'alert-2',
      title: `Renal System Weakness Detected`,
      description: `${renalWeak} students struggling with Renal concepts`,
      priority: renalWeak > students.length * 0.2 ? 'HIGH' : 'MEDIUM',
      timeAgo: '2 hours ago',
      suggestedAction: 'Schedule Renal workshop'
    }
  ];
};

export const exportFacultyReport = (students: StudentMastery[], metrics: CohortMetrics) => {
  console.log('Exporting faculty report for', students.length, 'students');
  alert("Faculty Report exported successfully.");
  return {
    filename: `faculty-report-${new Date().toISOString().split('T')[0]}.pdf`,
    data: { students, metrics }
  };
};
