
import { 
  OrganSystem, 
  Discipline, 
  BloomTaxonomy, 
  StudentMastery, 
  CurriculumObjective, 
  AIAgentInsight,
  AgentMetaData,
  ItemType,
  QuestionType,
  Issue,
  BackendItem,
  LectureAsset,
  Author,
  MediaAsset,
  ItemPsychometrics,
  LectureMetrics,
  LearningObjective,
  ObjectiveCoverage,
  CurriculumMapping,
  AIInsightLog,
  AgentStatus,
  AIActionHistory,
  ExamBlueprint,
  ReliabilityTarget,
  USMLEStandardCategory
} from './types';

export const USMLE_2024_OUTLINE: USMLEStandardCategory[] = [
  {
    id: 'USMLE-HUM-DEV',
    name: 'Human Development',
    page: 3,
    topics: [
      { 
        id: 'HD-01', 
        name: 'Normal age-related findings and care of the well patient',
        subTopics: ['Infancy and childhood (0-12 years)', 'Adolescence (13-17 years)', 'Adulthood (18-64 years)', 'Older Adulthood (65+ years)']
      }
    ]
  },
  {
    id: 'USMLE-IMMUNE',
    name: 'Immune System',
    page: 4,
    topics: [
      { id: 'IM-01', name: 'Disorders associated with immunodeficiency', subTopics: ['Humoral immunity', 'Cell-mediated immunity', 'Complement deficiency', 'Phagocytic cells'] },
      { id: 'IM-02', name: 'HIV/AIDS', subTopics: ['Complications', 'Immunology of AIDS', 'IRS'] },
      { id: 'IM-03', name: 'Immunologically mediated disorders', subTopics: ['Hypersensitivity reactions', 'Transplantation'] },
      { id: 'IM-04', name: 'Adverse effects of drugs', subTopics: ['Jarisch-Herxheimer', 'Immunosuppressants'] }
    ]
  },
  {
    id: 'USMLE-BLOOD',
    name: 'Blood & Lymphoreticular System',
    page: 5,
    topics: [
      { id: 'BL-01', name: 'Infectious and immunologic disorders', subTopics: ['Bacterial', 'Viral', 'Parasitic'] },
      { id: 'BL-02', name: 'Neoplasms', subTopics: ['Leukemia', 'Lymphomas', 'Multiple myeloma'] },
      { id: 'BL-03', name: 'Anemia, cytopenias, and polycythemia', subTopics: ['Hemolysis', 'Hemoglobin disorders', 'Cytopenias'] },
      { id: 'BL-04', name: 'Coagulation disorders', subTopics: ['Hypocoagulable', 'Hypercoagulable'] }
    ]
  },
  {
    id: 'USMLE-BEHAVIOR',
    name: 'Behavioral Health',
    page: 7,
    topics: [
      { id: 'BH-01', name: 'Psychotic disorders', subTopics: ['Schizophrenia', 'Delusional disorder'] },
      { id: 'BH-02', name: 'Anxiety disorders', subTopics: ['Panic disorder', 'OCD', 'PTSD'] },
      { id: 'BH-03', name: 'Mood disorders', subTopics: ['Depressive disorder', 'Bipolar disorder'] },
      { id: 'BH-04', name: 'Eating & Impulse-control', subTopics: ['Anorexia', 'Bulimia', 'Conduct disorders'] }
    ]
  },
  {
    id: 'USMLE-NERVOUS',
    name: 'Nervous System & Special Senses',
    page: 9,
    topics: [
      { id: 'NS-01', name: 'Infectious/Inflammatory', subTopics: ['Meningitis', 'Encephalitis', 'Myasthenia gravis'] },
      { id: 'NS-02', name: 'Cerebrovascular disease', subTopics: ['TIA', 'Stroke', 'Hemorrhage'] },
      { id: 'NS-03', name: 'Spine & Cord disorders', subTopics: ['Cauda equina', 'Spinal stenosis'] },
      { id: 'NS-04', name: 'Cranial & Peripheral nerve', subTopics: ['Bell palsy', 'Horner syndrome'] },
      { id: 'NS-05', name: 'Eye & Eyelid', subTopics: ['Retina', 'Structural', 'Structural'] },
      { id: 'NS-06', name: 'Ear', subTopics: ['Hearing loss', 'Balance', 'Ménière'] }
    ]
  },
  {
    id: 'USMLE-SKIN',
    name: 'Skin & Subcutaneous Tissue',
    page: 13,
    topics: [
      { id: 'SK-01', name: 'Infectious/Inflammatory', subTopics: ['Bacterial/Cellulitis', 'Viral/Herpes', 'Fungal'] },
      { id: 'SK-02', name: 'Neoplasms', subTopics: ['Benign', 'Malignant (Basal cell, Melanoma)'] },
      { id: 'SK-03', name: 'Integumentary disorders', subTopics: ['Hair/Nails', 'Sweat glands'] }
    ]
  },
  {
    id: 'USMLE-MSK',
    name: 'Musculoskeletal System',
    page: 15,
    topics: [
      { id: 'MS-01', name: 'Infectious/Inflammatory', subTopics: ['Osteomyelitis', 'Rheumatoid arthritis'] },
      { id: 'MS-02', name: 'Degenerative/Metabolic', subTopics: ['Osteoporosis', 'Osteomalacia', 'Gout'] },
      { id: 'MS-03', name: 'Traumatic/Mechanical', subTopics: ['Fractures', 'Dislocations'] }
    ]
  },
  {
    id: 'USMLE-CARDIO',
    name: 'Cardiovascular System',
    page: 17,
    topics: [
      { id: 'CV-01', name: 'Dysrhythmias', subTopics: ['Fibrillation', 'Tachycardia', 'Heart block'] },
      { id: 'CV-02', name: 'Heart failure', subTopics: ['Congestive', 'Diastolic/Systolic'] },
      { id: 'CV-03', name: 'Ischemic heart disease', subTopics: ['MI', 'Angina'] },
      { id: 'CV-04', name: 'Valvular heart disease', subTopics: ['Stenosis', 'Prolapse'] }
    ]
  },
  {
    id: 'USMLE-RESP',
    name: 'Respiratory System',
    page: 19,
    topics: [
      { id: 'RS-01', name: 'Infectious/Inflammatory', subTopics: ['Pneumonia', 'Sinusitis', 'Tuberculosis'] },
      { id: 'RS-02', name: 'Obstructive airway disease', subTopics: ['Asthma', 'COPD', 'Bronchiectasis'] },
      { id: 'RS-03', name: 'Pneumoconiosis/Interstitial', subTopics: ['Asbestosis', 'Silicosis'] }
    ]
  },
  {
    id: 'USMLE-GI',
    name: 'Gastrointestinal System',
    page: 21,
    topics: [
      { id: 'GI-01', name: 'Infectious/Inflammatory', subTopics: ['Enteritis', 'Peritonitis', 'Colitis'] },
      { id: 'GI-02', name: 'Stomach/Intestine disorders', subTopics: ['Ulcers', 'Appendicitis', 'IBS'] },
      { id: 'GI-03', name: 'Liver/Biliary system', subTopics: ['Cirrhosis', 'Hepatitis', 'Jaundice'] },
      { id: 'GI-04', name: 'Pancreas', subTopics: ['Pancreatitis', 'Insufficiency'] }
    ]
  },
  {
    id: 'USMLE-RENAL',
    name: 'Renal & Urinary System',
    page: 24,
    topics: [
      { id: 'RN-01', name: 'Infectious disorders', subTopics: ['Pyelonephritis', 'Cystitis'] },
      { id: 'RN-02', name: 'Metabolic/Regulatory', subTopics: ['AKI', 'CKD', 'Calculi'] },
      { id: 'RN-03', name: 'Vascular disorders', subTopics: ['Renal artery stenosis'] }
    ]
  },
  {
    id: 'USMLE-REPRO',
    name: 'Reproductive System',
    page: 26,
    topics: [
      { id: 'RP-01', name: 'Pregnancy & Childbirth', subTopics: ['Prenatal care', 'Obstetric complications'] },
      { id: 'RP-02', name: 'Female System & Breast', subTopics: ['Menopause', 'Menstrual disorders'] },
      { id: 'RP-03', name: 'Male System', subTopics: ['Prostatic hyperplasia', 'Erectile dysfunction'] }
    ]
  },
  {
    id: 'USMLE-ENDO',
    name: 'Endocrine System',
    page: 31,
    topics: [
      { id: 'EN-01', name: 'Diabetes mellitus', subTopics: ['Type 1', 'Type 2', 'Complications'] },
      { id: 'EN-02', name: 'Thyroid disorders', subTopics: ['Hyper/Hypothyroidism', 'Thyroiditis'] },
      { id: 'EN-03', name: 'Pituitary disorders', subTopics: ['Acromegaly', 'Proclactinoma'] }
    ]
  },
  {
    id: 'USMLE-BIOSTAT',
    name: 'Biostatistics & Epi',
    page: 36,
    topics: [
      { id: 'BS-01', name: 'Epidemiology', subTopics: ['Incidence/Prevalence', 'Survival analysis'] },
      { id: 'BS-02', name: 'Study design', subTopics: ['Clinical trials', 'Systematic reviews'] },
      { id: 'BS-03', name: 'Testing & Screening', subTopics: ['Sensitivity', 'Specificity', 'ROC'] }
    ]
  },
  {
    id: 'USMLE-SOCIAL',
    name: 'Social Sciences',
    page: 39,
    topics: [
      { id: 'SS-01', name: 'Communication skills', subTopics: ['Patient interviewing', 'Interpreter use'] },
      { id: 'SS-02', name: 'Ethics & Jurisprudence', subTopics: ['Consent', 'Palliative care', 'Malpractice'] },
      { id: 'SS-03', name: 'Systems-based practice', subTopics: ['Patient safety', 'Quality improvement'] }
    ]
  }
];

export const MOCK_ORGAN_SYSTEMS = [
  { id: 'USMLE-CARDIO', name: 'Cardiovascular System', usmleCode: 'CARDIO' },
  { id: 'USMLE-RESP', name: 'Respiratory System', usmleCode: 'RESP' },
  { id: 'USMLE-GI', name: 'Gastrointestinal System', usmleCode: 'GI' },
  { id: 'USMLE-RENAL', name: 'Renal & Urinary System', usmleCode: 'RENAL' },
  { id: 'USMLE-NERVOUS', name: 'Nervous System & Special Senses', usmleCode: 'NEURO' },
  { id: 'USMLE-ENDO', name: 'Endocrine System', usmleCode: 'ENDO' },
  { id: 'USMLE-MSK', name: 'Musculoskeletal System', usmleCode: 'MSK' },
  { id: 'USMLE-REPRO', name: 'Reproductive System', usmleCode: 'REPRO' },
  { id: 'USMLE-BEHAVIOR', name: 'Behavioral Health', usmleCode: 'BEH' },
  { id: 'USMLE-BIOSTAT', name: 'Biostatistics & Epi', usmleCode: 'BIO' },
  { id: 'USMLE-BLOOD', name: 'Blood & Lymphoreticular', usmleCode: 'HEME' },
  { id: 'USMLE-IMMUNE', name: 'Immune System', usmleCode: 'IMM' },
  { id: 'USMLE-SKIN', name: 'Skin & Subcutaneous Tissue', usmleCode: 'SKIN' },
  { id: 'USMLE-SOCIAL', name: 'Social Sciences', usmleCode: 'SOC' },
  { id: 'USMLE-HUM-DEV', name: 'Human Development', usmleCode: 'HD' },
];

export const MOCK_AUTHORS: Author[] = [
  { id: 'AUTH-001', name: 'Dr. Aisha Khan', role: 'Endocrinology Faculty', institution: 'Caribbean College of Medicine', bio: 'Endocrinologist with focus on diabetes education and assessment design.' },
  { id: 'AUTH-002', name: 'Dr. Marcus Li', role: 'Renal Pathology Fellow', institution: 'Caribbean College of Medicine', bio: 'Renal pathologist with interest in glomerular disease education.' },
  { id: 'AUTH-003', name: 'Dr. Elena Rodríguez', role: 'Nephrology Faculty', institution: 'Caribbean College of Medicine', bio: 'Clinician-educator in nephrology with emphasis on clinical reasoning.' },
];

export const MOCK_EXAM_BLUEPRINTS: ExamBlueprint[] = [
  {
    id: 'BLUEPRINT-STEP1-BLOCK-40-DEFAULT',
    name: 'Step 1-style 40-question General Block',
    description: 'Balanced block approximating Step 1 content distribution.',
    totalItems: 40,
    organSystemWeights: [
      { organSystemId: 'USMLE-CARDIO', weightPercent: 16 },
      { organSystemId: 'USMLE-RENAL', weightPercent: 10 },
      { organSystemId: 'USMLE-ENDO', weightPercent: 12 },
    ],
    difficultyDistribution: [
      { label: 'Easy', proportion: 0.25 },
      { label: 'Moderate', proportion: 0.50 },
      { label: 'Hard', proportion: 0.25 },
    ],
    bloomDistribution: [
      { bloomLevel: 'Recall', proportion: 0.25 },
      { bloomLevel: 'Understand', proportion: 0.35 },
      { bloomLevel: 'Apply', proportion: 0.30 },
      { bloomLevel: 'Analyze', proportion: 0.10 },
    ],
  },
];

export const MOCK_RELIABILITY_TARGETS: ReliabilityTarget[] = [
  {
    id: 'REL-STEP1-GENERAL',
    context: 'Summative Step 1-style exam',
    targetCronbachAlpha: 0.85,
    targetKR20: 0.84,
    minSampleSizeForReliability: 200,
  },
];

export const MOCK_AI_INSIGHT_LOGS: AIInsightLog[] = [
  {
    id: 'AI-LOG-0001',
    timestamp: '2025-02-18T10:00:00Z',
    agentId: 'AGENT-CURR-AUDITOR',
    agentName: 'Curriculum Auditor Agent',
    severity: 'warning',
    entityType: 'Item',
    entityId: 'QID-1001',
    message: 'Item difficulty drifting downward; approaching “too easy” threshold for target cohort.',
    suggestedActions: ['Review distractors', 'Consider increasing clinical complexity.'],
  },
  {
    id: 'AI-LOG-0002',
    timestamp: '2025-02-18T10:05:00Z',
    agentId: 'AGENT-PSYCHOMETRICIAN',
    agentName: 'Psychometrician Agent',
    severity: 'critical',
    entityType: 'Objective',
    entityId: 'OBJ-ENDO-002',
    message: 'Objective under-assessed: only 37% of target item coverage achieved in Endocrine.',
    suggestedActions: ['Trigger item generator for ≥3 new items', 'Prioritize Bloom: Apply level.'],
  },
];

export const MOCK_AGENT_STATUS: AgentStatus[] = [
  {
    id: 'AGENT-CURR-AUDITOR',
    name: 'Curriculum Auditor Agent',
    status: 'online',
    lastHeartbeat: '2025-02-18T10:15:00Z',
    recentTasksProcessed: 42,
  },
  {
    id: 'AGENT-PSYCHOMETRICIAN',
    name: 'Psychometrician Agent',
    status: 'online',
    lastHeartbeat: '2025-02-18T10:14:30Z',
    recentTasksProcessed: 27,
  },
];

export const MOCK_ITEMS: BackendItem[] = [
  {
    id: 'QID-1001',
    type: 'MCQ',
    stem: 'A 32-year-old woman presents with fatigue, polyuria, and polydipsia. Laboratory testing reveals fasting plasma glucose of 162 mg/dL. Which of the following best describes the primary mechanism of action of the first-line drug used to treat this patient’s condition?',
    options: [
      { id: 'QID-1001-A', label: 'A', text: 'Activation of peroxisome proliferator-activated receptor gamma (PPAR-γ)', isCorrect: false, plausibilityNote: 'Common confusion with thiazolidinediones.' },
      { id: 'QID-1001-B', label: 'B', text: 'Decreased hepatic gluconeogenesis and increased peripheral insulin sensitivity', isCorrect: true, plausibilityNote: 'Correct – metformin mechanism.' },
      { id: 'QID-1001-C', label: 'C', text: 'Direct stimulation of pancreatic β-cell insulin release independent of glucose', isCorrect: false },
      { id: 'QID-1001-D', label: 'D', text: 'Inhibition of intestinal brush border α-glucosidases', isCorrect: false },
    ],
    explanation: 'Metformin is first-line therapy for type 2 diabetes and works primarily by inhibiting hepatic gluconeogenesis.',
    itemTagline: 'Mechanism of metformin as first-line therapy for T2DM.',
    itemType: 'single-best-answer',
    status: 'Published',
    version: 3,
    authorId: 'AUTH-001',
    createdAt: '2025-01-10T10:15:00Z',
    updatedAt: '2025-01-20T14:42:00Z',
    timeToAuthorMinutes: 35,
    taxonomy: { organSystemId: 'USMLE-ENDO', disciplineId: 'DISC-PHARM', bloomLevel: 'Apply', syndromeTopicId: 'TOPIC-T2DM', usmleContentId: 'USMLE-ENDO-GLUCOSE-HOMEOSTASIS' },
    linkedMediaIds: [],
    linkedLectureIds: ['LECT-ENDO-001'],
    learningObjective: 'Mechanism of metformin as first-line therapy for T2DM.',
  },
];

export const MOCK_LECTURES: LectureAsset[] = [
  {
    id: 'LECT-ENDO-001',
    title: 'Type 2 Diabetes Pathophysiology',
    description: 'Comprehensive review of insulin resistance.',
    videoUri: '',
    transcriptUri: '',
    slideDeckUri: '',
    engagementMarkers: [],
    status: 'Published',
    version: 1,
    authorId: 'AUTH-001',
    estimatedDurationMinutes: 45,
    createdAt: '2025-01-05T09:00:00Z',
    updatedAt: '2025-01-05T09:00:00Z',
    linkedObjectiveIds: ['OBJ-ENDO-001'],
    linkedItemIds: ['QID-1001']
  },
];

export const MOCK_ITEM_PSYCHOMETRICS: ItemPsychometrics[] = [
  { itemId: 'QID-1001', sampleSize: 312, difficultyIndex: 0.64, discriminationIndex: 0.36, timeOnTaskSecondsAvg: 82, distractorAnalysis: [], lastUpdated: '2025-02-15' },
];

export const MOCK_LECTURE_METRICS: LectureMetrics[] = [
  { lectureId: 'LECT-ENDO-001', avgWatchTimePercent: 0.81, rewatchRatePercent: 0.34, pauseClusterTimestamps: [305, 890], avgTutorQueriesPerStudent: 0.6, avgNotesPerStudent: 7.2, intrinsicLoad: 7, extraneousLoad: 3, germaneLoad: 8, preAssessmentAvg: 0.48, postAssessmentAvg: 0.82, retentionAssessmentAvg: 0.76, downstreamMCQPerformance: 0.79, nbmeCorrelationScore: 0.62, updatedAt: '2025-02-18' },
];

export const MOCK_LEARNING_OBJECTIVES: LearningObjective[] = [
  { id: 'OBJ-ENDO-001', text: 'Explain the pathophysiology of insulin resistance in type 2 diabetes mellitus.', organSystemId: 'USMLE-ENDO', disciplineId: 'DISC-PHYS', bloomLevel: 'Understand', usmleContentId: 'USMLE-ENDO-GLUCOSE-HOMEOSTASIS', targetItemCount: 6, targetLectureCount: 1 },
];

export const MOCK_OBJECTIVE_COVERAGE: ObjectiveCoverage[] = [
  { objectiveId: 'OBJ-ENDO-001', mappedItemCount: 5, mappedLectureCount: 1, coveragePercentItems: 5 / 6, coveragePercentLectures: 1 / 1 },
];

export const MOCK_STUDENTS: StudentMastery[] = [
  { studentId: 'S001', studentName: 'Alice Johnson', masteryScores: { 'USMLE-ENDO': 78, 'USMLE-RENAL': 42 }, totalScore: 81, atRisk: false, predictedStep1: '245-255', engagementScore: 92 },
];

export const MOCK_ISSUES: Issue[] = [
  { id: 'ISS-001', type: 'Performance', severity: 'High', title: 'Non-functional Distractor (Option A)', description: 'Item QID-1001 has a low selection rate for Option A.', questionId: 'QID-1001', status: 'Open', createdAt: '2024-03-25' }
];

export const MOCK_SYNDROME_TOPICS = [
  { id: 'TOPIC-T2DM', name: 'Type 2 Diabetes Mellitus', path: ['Endocrine', 'Metabolism', 'Diabetes'] }
];
