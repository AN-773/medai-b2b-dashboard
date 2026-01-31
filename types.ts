
export enum OrganSystem {
  Cardiovascular = 'Cardiovascular',
  Respiratory = 'Respiratory',
  Gastrointestinal = 'Gastrointestinal',
  Renal = 'Renal',
  Neurology = 'Neurology',
  Endocrine = 'Endocrine',
  Musculoskeletal = 'Musculoskeletal',
  Reproductive = 'Reproductive',
  BehavioralHealth = 'Behavioral Health',
  Biostatistics = 'Biostats & Epi',
  Hematology = 'Blood & Lymphoreticular',
  SocialSciences = 'Social Sciences',
  Integumentary = 'Skin & Subcutaneous'
}

export interface USMLEStandardTopic {
  id: string;
  name: string;
  subTopics?: string[];
  objectives?: LearningObjective[];
}

export interface USMLEStandardCategory {
  id: string;
  name: string;
  page: number;
  topics: USMLEStandardTopic[];
}

export enum Discipline {
  Pathology = 'Pathology',
  Pharmacology = 'Pharmacology',
  Physiology = 'Physiology',
  Anatomy = 'Anatomy',
  Biochemistry = 'Biochemistry',
  Psychiatry = 'Psychiatry',
  BehavioralScience = 'Behavioral Science',
  Epidemiology = 'Epidemiology',
  Biostatistics = 'Biostatistics',
  Microbiology = 'Microbiology',
  Genetics = 'Genetics',
  Ethics = 'Medical Ethics & Jurisprudence'
}

export enum BloomTaxonomy {
  Recall = 'Recall / Remember',
  Understand = 'Understand',
  Apply = 'Apply',
  Analyze = 'Analyze'
}

export enum BloomsLevel {
  Remember = 'Remember',
  Understand = 'Understand',
  Apply = 'Apply',
  Analyze = 'Analyze'
}

export enum QuestionType {
  SingleBestAnswer = 'Single Best Answer',
  MultipleChoice = 'Multiple Choice',
  TrueFalse = 'True/False'
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  selectionRate?: number;
  label?: string;
  plausibilityNote?: string;
}

export interface Taxonomy {
  organSystemId: string;
  disciplineId: string;
  bloomLevel: string;
  syndromeTopicId: string;
  subTopicId?: string;
  objectiveId?: string;
  usmleContentId: string;
}

export interface Author {
  id: string;
  name: string;
  role: string;
  institution: string;
  bio: string;
}

export interface MediaAsset {
  id: string;
  type: string;
  description: string;
  storageUri: string;
  altText: string;
  base64Preview: string;
}

export interface Reference {
  id: string;
  title: string;
  url: string;
}

export interface DistractorAudit {
  optionId: string;
  selectionRate: number;
  flaggedNonFunctional: boolean;
}

export interface ItemPsychometrics {
  itemId: string;
  sampleSize: number;
  difficultyIndex: number;
  discriminationIndex: number;
  timeOnTaskSecondsAvg: number;
  distractorAnalysis: DistractorAudit[];
  lastUpdated: string;
}

export interface LectureMetrics {
  lectureId: string;
  avgWatchTimePercent: number;
  rewatchRatePercent: number;
  pauseClusterTimestamps: number[];
  avgTutorQueriesPerStudent: number;
  avgNotesPerStudent: number;
  intrinsicLoad: number;
  extraneousLoad: number;
  germaneLoad: number;
  preAssessmentAvg: number;
  postAssessmentAvg: number;
  retentionAssessmentAvg: number;
  downstreamMCQPerformance: number;
  nbmeCorrelationScore: number;
  updatedAt: string;
}

export interface LearningObjective {
  id: string;
  text: string;
  organSystemId: string;
  disciplineId: string;
  bloomLevel: string;
  usmleContentId: string;
  targetItemCount: number;
  targetLectureCount: number;
  subTopic?: string;
  linkedLectureIds?: string[];
  linkedItemIds?: string[];
}

export interface ObjectiveCoverage {
  objectiveId: string;
  mappedItemCount: number;
  mappedLectureCount: number;
  coveragePercentItems: number;
  coveragePercentLectures: number;
}

export interface CurriculumMapping {
  lectureId: string;
  objectiveId: string;
  itemIds: string[];
}

export interface AIInsightLog {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  severity: 'info' | 'warning' | 'critical';
  entityType: string;
  entityId: string;
  message: string;
  suggestedActions: string[];
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'idle' | 'busy';
  lastHeartbeat: string;
  recentTasksProcessed: number;
}

export interface AIActionHistory {
  id: string;
  timestamp: string;
  agentId: string;
  entityType: string;
  entityId: string;
  recommendation: string;
  actionTaken: 'accepted' | 'deferred' | 'rejected';
  actedByUserId: string;
  followUpItemIds: string[];
}

export interface ExamBlueprint {
  id: string;
  name: string;
  description: string;
  totalItems: number;
  organSystemWeights: { organSystemId: string; weightPercent: number }[];
  difficultyDistribution: { label: string; proportion: number }[];
  bloomDistribution: { bloomLevel: string; proportion: number }[];
}

export interface ReliabilityTarget {
  id: string;
  context: string;
  targetCronbachAlpha: number;
  targetKR20: number;
  minSampleSizeForReliability: number;
}

export enum ItemType {
  MCQ = 'MCQ',
  SAQ = 'SAQ',
  LECTURE = 'LECTURE'
}

export interface BackendItem {
  id: string;
  type: 'MCQ' | 'SAQ';
  stem: string;
  options?: QuestionOption[];
  answerKey?: string;
  explanation?: string;
  itemTagline?: string;
  itemType: string;
  status: 'Draft' | 'Published' | 'Archived';
  version: number;
  authorId: string;
  authorNotes?: string;
  createdAt: string;
  updatedAt: string;
  timeToAuthorMinutes: number;
  taxonomy: Taxonomy;
  linkedMediaIds: string[];
  linkedLectureIds: string[];
  pValue?: number;
  dIndex?: number;
  sampleSize?: number;
  learningObjective?: string;
  distractors?: { id: string; isFunctional: boolean }[];
}

export interface LectureAsset {
  id: string;
  title: string;
  description: string;
  videoUri: string;
  transcriptUri: string;
  slideDeckUri: string;
  engagementMarkers: {
    timestampSec: number;
    type: string;
    description: string;
  }[];
  status: string;
  version: number;
  authorId: string;
  estimatedDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
  linkedObjectiveIds: string[];
  linkedItemIds: string[];
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  bloomsLevel: BloomsLevel;
  options: QuestionOption[];
  explanation: string;
  learningObjectives: string[];
  references?: Reference[];
  tags: string[];
  createdAt: string;
  status: 'Draft' | 'Published' | 'Archived';
  analysis?: {
    difficultyIndex: number;
    discriminationIndex: number;
    flawedDistractor?: string;
  };
}

export interface Issue {
  id: string;
  type: 'Performance' | 'Feedback' | 'System' | 'Content';
  severity: 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  questionId: string; 
  status: 'Open' | 'Resolved' | 'Ignored';
  createdAt: string;
}

export interface StudentMastery {
  studentId: string;
  studentName: string;
  masteryScores: Record<string, number>;
  totalScore: number;
  atRisk: boolean;
  predictedStep1: string;
  engagementScore: number;
}

export interface CurriculumObjective {
  id: string;
  title: string;
  system: OrganSystem;
  coveragePercent: number;
  itemCount: number;
  status: 'adequate' | 'under' | 'over';
  bloomTarget: Record<string, number>;
  subTopics?: { name: string; itemCount: number }[];
}

export interface AIAgentInsight {
  id: string;
  agentName: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  actionRequired: boolean;
  category: 'QB_HEALTH' | 'STUDENT_MASTERY' | 'CURRICULUM' | 'PSYCHOMETRICS';
}

export interface AgentMetaData {
  id: string;
  name: string;
  type: 'FRONTLINE' | 'BACKEND';
  description: string;
  status: 'OPTIMIZING' | 'LIVE' | 'LEARNING' | 'IDLE' | 'FLAGGED';
  load: number;
  metricLabel: string;
  metricValue: string;
}

export type View =
  | 'DASHBOARD'
  | 'QB_HEALTH'
  | 'MASTERY'
  | 'CURRICULUM'
  | 'ASSESSMENT'
  | 'AGENTS'
  | 'BLUEPRINT'
  | 'BANK_EXPLORER'
  | 'WORKBENCH';

export interface ApiChoice {
  id: string;
  content: string;
  isCorrect: boolean;
  multimediaId: string | null;
  multimedia: any;
  createdAt: string;
  updatedAt: string;
  questionId: string;
  explanation: string;
}

export interface ApiQuestion {
  id: string;
  identifier: string;
  title: string;
  status: string;
  exam: string;
  subjects: any;
  metadata: any;
  organSystemId: string;
  difficultyId: string;
  cognitiveSkillId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  multimediaId: string | null;
  multimedia: any;
  choices: ApiChoice[];
  organSystem: {
    id: string;
    title: string;
    identifier: string;
    createdAt: string;
    updatedAt: string;
    topics: any;
    questions: any;
  };
  disciplines: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    blocks: any;
    questions: any;
  }[];
  dbSubjects: any[];
  competencies: any[];
  learningObjectiveId: string;
  learningObjective: {
    id: string;
    title: string;
    identifier: string;
    createdAt: string;
    updatedAt: string;
    syndromeId: string;
    syndrome: any;
    disciplines: any;
    cognitiveSkillId: string;
    cognitiveSkill: any;
    blocks: any;
    questions: any;
  };
  syndromeId: string;
  syndrome: {
    id: string;
    title: string;
    topicId: string;
    topic: any;
    identifier: string;
    createdAt: string;
    updatedAt: string;
  };
  topicId: string;
  topic: {
    id: string;
    title: string;
    identifier: string;
    organSystemId: string;
    organSystem: any;
    organSystems: any;
    syndromes: any;
    createdAt: string;
    updatedAt: string;
  };
  tags: any[];
  feedbacks: any[];
}

export interface ApiResponse<T> {
  items: T[];
  page: number;
  total: number;
}
export interface ApiOrganSystem {
  id: string;
  title: string;
  identifier: string;
  createdAt: string;
  updatedAt: string;
  topics: ApiTopic[];
  questions: any;
}

export interface ApiTopic {
  id: string;
  title: string;
  identifier: string;
  organSystemId: string;
  organSystem: ApiOrganSystem | null;
  organSystems: any;
  syndromes: ApiSyndrome[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiSyndrome {
  id: string;
  title: string;
  identifier: string;
  topicId: string;
  topic: ApiTopic | null;
  createdAt: string;
  updatedAt: string;
}
