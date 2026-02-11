import React from 'react';

export type View =
  | 'DASHBOARD'
  | 'WORKBENCH'
  | 'BANK_EXPLORER'
  | 'QB_HEALTH'
  | 'MASTERY'
  | 'CURRICULUM'
  | 'ASSESSMENT'
  | 'AGENTS'
  | 'BLUEPRINT'
  | 'FACULTY';

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
  page?: number;
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
  highPerformerSelectionRate?: number; // Added for RB distractor analysis
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

export interface ItemPsychometrics {
  itemId: string;
  sampleSize: number;
  difficultyIndex: number; // P-Value
  discriminationIndex: number; // Simplified R_B index
  highIncorrectCount: number;
  lowIncorrectCount: number;
  groupSizeN: number; // The 'n' in the R_B formula (total * 0.27)
  flawedDistractorId?: string;
  flawReason?: string;
  timeOnTaskSecondsAvg: number;
  distractorAnalysis: DistractorAudit[];
  lastUpdated: string;
}

export interface SessionReliability {
  sessionId: string;
  kr20Value: number; // Internal Consistency Reliability
  totalItems: number;
  totalStudents: number;
  meanScore: number;
  variance: number;
  status: 'RELIABLE' | 'UNSTABLE' | 'LOW_SAMPLE';
}

export interface DistractorAudit {
  optionId: string;
  selectionRate: number;
  highPerformerSelectionRate: number;
  flaggedNonFunctional: boolean;
}

export interface LearningObjective {
  id: string;
  text: string;
  subTopic?: string;
  organSystemId?: string;
  disciplineId: string;
  bloomLevel: string;
  usmleContentId: string;
  usmleCodes?: string[]; // Added: Array of USMLE codes for precise mapping
  targetItemCount?: number;
  targetLectureCount?: number;
  linkedLectureIds?: string[];
  linkedItemIds?: string[];
  snomedConceptId?: string; // SNOMED CT Concept ID
  snomedConceptName?: string; // SNOMED CT Fully Specified Name
}

export enum ItemType {
  MCQ = 'MCQ',
  SAQ = 'SAQ',
  LECTURE = 'LECTURE'
}

export interface Reference {
  id: string;
  title: string;
  url: string;
}

export interface Author {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  uri: string;
  title: string;
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
  title?: string; // Added for item tagline
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
  taxonomy?: Taxonomy;
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

export interface Cohort {
  id: string;
  name: string;
  yearLevel: 'MS1' | 'MS2' | 'MS3' | 'MS4';
  intakeTerm: 'Fall' | 'Spring';
  studentCount: number;
}

export interface StudentMastery {
  studentId: string;
  studentName: string;
  cohortId: string; // Link to Cohort
  masteryScores: Record<string, number>;
  discriminationWeightedScore: number; // Mastery on RB > 0.3 items
  totalScore: number;
  coverage: number; // Percentage of curriculum attempted
  recentDailyGain: number; // Points gained per day over last 7 days
  daysUntilStep1: number;
  atRisk: boolean;
  predictedStep1: string;
  engagementScore: number;
  percentileRank: number;
}

// Fixed AIAgentInsight to include missing severity, suggestedActions, and entityId properties
export interface AIAgentInsight {
  id: string;
  agentName: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  severity: string;
  suggestedActions: string[];
  entityId?: string;
  timestamp: string;
  actionRequired: boolean;
  category: 'QB_HEALTH' | 'STUDENT_MASTERY' | 'CURRICULUM' | 'PSYCHOMETRICS';
}

// Added missing interfaces for Exam Blueprints and Reliability Targets
export interface ExamBlueprint {
  id: string;
  name: string;
  description: string;
  totalItems: number;
  organSystemWeights: {
    organSystemId: string;
    weightPercent: number;
  }[];
  difficultyDistribution: {
    label: string;
    proportion: number;
  }[];
  bloomDistribution: {
    bloomLevel: string;
    proportion: number;
  }[];
}

export interface ReliabilityTarget {
  context: string;
  targetCronbachAlpha: number;
  targetKR20: number;
}

// --- FACULTY DASHBOARD TYPES ---

export interface FacultyAlert {
  id: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  timeAgo: string;
  suggestedAction?: string;
}

export interface CohortMetrics {
  avgReadiness: number;
  atRiskCount: number;
  avgTAPR: number;
  avgCoverage: number;
  readinessChange: string;
  riskChange: string;
  taprChange: string;
  coverageChange: string;
  systemMastery: Array<{ system: string; mastery: number }>;
  readinessDistribution: Array<{ range: string; count: number }>;
  trendData: Array<{ week: string; readiness: number; mastery: number }>;
  bloomDistribution: Array<{ name: string; value: number }>;
}

export interface FacultyTimeSavings {
  hoursThisWeek: number;
  hoursThisMonth: number;
  efficiencyGain: number;
}

export interface CurriculumGap {
  system: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedStudents: number;
  suggestedAction: string;
}

export interface Intervention {
  id: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  studentCount: number;
  studentIds: string[];
  estimatedTime: string;
  expectedImpact: number;
  confidence: number;
}

// --- UNIFIED SINA DATA MODELS ---

export type SystemMastery = Record<string, number>;
export type EvidenceStatus = number; // 0.0 to 1.0

export interface SINAStudent {
  studentId: string;
  studentName: string;
  cohortId: string;
  mastery: SystemMastery;
  readiness: number;
  tapr: number;
  coverage: number;
  evidence: EvidenceStatus;
  riskLevel: 'Critical' | 'High' | 'Moderate' | 'On Track' | 'Advanced';
  predictedStep1: string;
  primaryIntervention: string;
  recentDailyGain: number;
  daysUntilStep1: number;
}

export interface SINACohort {
  cohortId: string;
  students: SINAStudent[];
  analytics: CohortMetrics;
  interventions: Intervention[];
}

// FIX: Global declaration to resolve JSX.IntrinsicElements errors
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
      p: any;
      span: any;
      a: any;
      ul: any;
      li: any;
      button: any;
      input: any;
      label: any;
      select: any;
      option: any;
      textarea: any;
      img: any;
      form: any;
      header: any;
      footer: any;
      nav: any;
      aside: any;
      section: any;
      main: any;
      svg: any;
      path: any;
      h1: any;
      h2: any;
      h3: any;
      h4: any;
      h5: any;
      h6: any;
      table: any;
      thead: any;
      tbody: any;
      tr: any;
      th: any;
      td: any;
      defs: any;
      linearGradient: any;
      stop: any;
      // Catch-all
      [elemName: string]: any;
    }
  }
}