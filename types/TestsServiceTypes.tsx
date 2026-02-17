// Auto-generated TypeScript types from Go structs

export interface Account {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  users?: User[];
  blocks?: Block[];
  questions?: Question[];
}

export interface User {
  id: string;
  name: string;
  accountId: string;
  account?: Account;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedApiResponse<T> {
  items: T[];
  page: number;
  total: number;
}

export interface Block {
  id: string;
  title: string;
  identifier: number;
  testMode: string;
  examType: string;
  timed: boolean;
  timeRemaining: number; // time remaining in seconds
  isPaused: boolean;
  status: string;
  pauseDate: string;
  active: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  accountId?: string;
  account?: Account;
  submissionId?: string;
  submission?: Submission;
  questions?: Question[];
  disciplines?: Discipline[];
  subjects?: Subject[];
  topics?: Topic[];
  tags?: Tag[];
}

export interface Question {
  id: string;
  identifier: string;
  title: string;
  status: string;
  exam: string;
  subjects: string[]; // Subjects type - assuming string array
  metadata: Record<string, unknown>; // datatypes.JSON
  organSystemId?: string;
  difficultyId?: string;
  cognitiveSkillId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  multimediaId?: string;
  multimedia?: Multimedia;
  choices?: Choice[];
  organSystem?: OrganSystem;
  disciplines?: Discipline[];
  dbSubjects?: Subject[];
  competencies?: Competency[];
  learningObjectiveId?: string;
  learningObjective?: LearningObjective;
  syndromeId?: string;
  syndrome?: Syndrome;
  topicId?: string;
  topic?: Topic;
  tags?: Tag[];
  feedbacks?: Feedback[];
}

export interface QuestionType {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Choice {
  id: string;
  content: string;
  isCorrect: boolean;
  multimediaId?: string;
  multimedia?: Multimedia;
  createdAt: string;
  updatedAt: string;
  questionId?: string;
  explanation: string;
}

export interface OrganSystem {
  id: string;
  title: string;
  identifier: string;
  createdAt: string;
  updatedAt: string;
  topics?: Topic[];
  questions?: Question[];
}

export interface Discipline {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  blocks?: Block[];
  questions?: Question[];
}

export interface Subject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  blocks?: Block[];
  questions?: Question[];
}

export interface Competency {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  blocks?: Block[];
  questions?: Question[];
}

export interface Difficulty {
  id: string;
  title: string;
  position: string;
  createdAt: string;
  updatedAt: string;
  questions?: Question[];
}

export interface CognitiveSkill {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  questions?: Question[];
}

export interface LearningObjective {
  id: string;
  title: string;
  identifier: string;
  createdAt: string;
  updatedAt: string;
  syndromeId?: string;
  syndrome?: Syndrome;
  disciplines?: Discipline[];
  cognitiveSkillId?: string;
  cognitiveSkill?: CognitiveSkill;
  blocks?: Block[];
  questions?: Question[];
}

export interface LearningObjectiveImport {
  id: string;
  sequenceNo: number;
  createdAt: string;
  updatedAt: string;
}

export interface Feedback {
  id: string;
  identifier: string;
  content: string;
  response: string;
  rating: number;
  email: string;
  createdAt: string;
  updatedAt: string;
  questionId?: string;
  accountId?: string;
  blockId?: string;
  question?: Question;
  account?: Account;
  block?: Block;
}

export interface Tag {
  id: string;
  title: string;
  identifier: string;
  createdAt: string;
  updatedAt: string;
  blocks?: Block[];
  questions?: Question[];
}

export interface Answer {
  id: string;
  content: string;
  submissionId?: string;
  submission?: Submission;
  isCorrect: boolean;
  timeSpent?: number;
  createdAt: string;
  updatedAt: string;
  questionId?: string;
  question?: Question;
  choiceId?: string;
  choice?: Choice;
}

export interface File {
  id: string;
  questionId?: string;
  identifier: string;
  name: string; // Original name of the file
  path: string; // Path to the file or S3 key if stored in S3
  type: string; // MIME type of the file
  size: number; // Size of the file in bytes
  url: string; // URL to the file
  created: string;
  updated: string;
  deletedAt?: string;
}

export interface Multimedia {
  id: string;
  url: string;
  type: string; // MIME type of the file
  fileId?: string;
  file?: File;
  questionId?: string;
  choiceId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Topic {
  id: string;
  title: string;
  identifier: string;
  organSystemId?: string;
  organSystem?: OrganSystem;
  organSystems?: OrganSystem[];
  objectives?: LearningObjective[]; // UI only
  syndromes?: Syndrome[];
  createdAt: string;
  updatedAt: string;
}

export interface Syndrome {
  id: string;
  title: string;
  topicId?: string;
  topic?: Topic;
  identifier: string;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  startTime: string;
  endTime: string;
  graded: boolean;
  created: string;
  updated: string;
  blockId?: string;
  block?: Block;
  answers?: Answer[];
  accountId?: string;
}

export interface StudentResponse {
  QuestionID: string;
  StudentID: string;
  TestSessionID: string;
  Score: number; // 0 or 1
  SelectedOption: string;
  TotalTestScore: number; // Optional: Total score of the student on the full test
}

export interface QuestionMetrics {
  question_id: string;
  P_value: number;
  R_B: number;
  High_Incorrect_Count: number;
  Low_Incorrect_Count: number;
  Key_Option: string;
  Flawed_Distractor_Choice: string;
  must_revise: boolean;
  Correct_Answer_Count: number;
  Total_Answer_Count: number;
  High_correct_Count: number;
  Low_correct_Count: number;
  n?: number;
  student_results?: StudentResponse[] | null;
}

export interface PsychometricReport {
  question_metrics: Record<string, QuestionMetrics>;
  session_reliability: Record<string, number>;
}

export interface Psychometric {
  question_id: string;
  stats: QuestionMetrics;
  status: string;
  title: string;
}


