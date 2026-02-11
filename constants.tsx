
import {
  StudentMastery,
  AIAgentInsight,
  Issue,
  BackendItem,
  LectureAsset,
  ItemPsychometrics,
  LearningObjective,
  ExamBlueprint,
  ReliabilityTarget,
  Cohort
} from './types';

// ============================================================================
// 1. MOCK ITEMS & PSYCHOMETRICS
// ============================================================================

export const MOCK_ITEMS: BackendItem[] = [
  {
    id: 'QID-CV-101',
    itemTagline: 'Anterior MI ECG Recognition',
    type: 'MCQ',
    stem: 'A 55-year-old male presents with crushing substernal chest pain. ECG shows ST elevation in leads V1-V4. Which coronary artery is most likely occluded?',
    options: [
      { id: 'opt1', text: 'Left Anterior Descending', isCorrect: true, label: 'A' },
      { id: 'opt2', text: 'Right Coronary Artery', isCorrect: false, label: 'B' },
      { id: 'opt3', text: 'Left Circumflex', isCorrect: false, label: 'C' },
      { id: 'opt4', text: 'Posterior Descending', isCorrect: false, label: 'D' },
      { id: 'opt5', text: 'Left Main', isCorrect: false, label: 'E' }
    ],
    status: 'Published',
    version: 1,
    authorId: 'AUTH-DEAN',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
    timeToAuthorMinutes: 15,
    itemType: 'single-best-answer',
    taxonomy: {
      organSystemId: 'USMLE-CV',
      disciplineId: 'Pathology',
      bloomLevel: 'Apply',
      syndromeTopicId: 'TOPIC-CV-MI',
      subTopicId: 'Acute MI',
      usmleContentId: 'CV-1.2.3'
    },
    linkedMediaIds: [],
    linkedLectureIds: ['LECT-CV-MI-001'],
    learningObjective: 'OBJ-CV-001',
    pValue: 0.62,
    dIndex: 0.45,
    sampleSize: 342,
    distractors: [
      { id: 'opt2', isFunctional: true },
      { id: 'opt3', isFunctional: true },
      { id: 'opt4', isFunctional: false }
    ]
  },
  {
    id: 'QID-RN-202',
    itemTagline: 'FeNa Interpretation',
    type: 'MCQ',
    stem: 'A patient with dehydration has a serum creatinine of 2.1 mg/dL. Urine sodium is 10 mEq/L. What is the most likely diagnosis?',
    options: [
      { id: 'opt1', text: 'Prerenal Azotemia', isCorrect: true, label: 'A' },
      { id: 'opt2', text: 'Acute Tubular Necrosis', isCorrect: false, label: 'B' },
      { id: 'opt3', text: 'Postrenal Obstruction', isCorrect: false, label: 'C' },
      { id: 'opt4', text: 'Acute Interstitial Nephritis', isCorrect: false, label: 'D' },
      { id: 'opt5', text: 'Glomerulonephritis', isCorrect: false, label: 'E' }
    ],
    status: 'Published',
    version: 1,
    authorId: 'AUTH-SYSTEM',
    createdAt: '2025-01-20T10:00:00Z',
    updatedAt: '2025-01-20T10:00:00Z',
    timeToAuthorMinutes: 12,
    itemType: 'single-best-answer',
    taxonomy: {
      organSystemId: 'USMLE-RENAL',
      disciplineId: 'Pathophysiology',
      bloomLevel: 'Analyze',
      syndromeTopicId: 'TOPIC-RENAL-AKI',
      subTopicId: 'Prerenal',
      usmleContentId: 'RN-2.1.4'
    },
    linkedMediaIds: [],
    linkedLectureIds: [],
    learningObjective: 'OBJ-RN-002',
    pValue: 0.45,
    dIndex: 0.15,
    sampleSize: 120,
    distractors: []
  },
  {
    id: 'QID-GI-303',
    itemTagline: 'Zollinger-Ellison Syndrome',
    type: 'MCQ',
    stem: 'A 45-year-old male with recurrent peptic ulcers and diarrhea. Gastrin levels are elevated. What is the most likely diagnosis?',
    options: [
      { id: 'opt1', text: 'Gastrinoma', isCorrect: true, label: 'A' },
      { id: 'opt2', text: 'H. Pylori', isCorrect: false, label: 'B' },
      { id: 'opt3', text: 'NSAID use', isCorrect: false, label: 'C' },
      { id: 'opt4', text: 'Stress', isCorrect: false, label: 'D' },
      { id: 'opt5', text: 'Alcohol', isCorrect: false, label: 'E' }
    ],
    status: 'Draft',
    version: 1,
    authorId: 'AUTH-DEAN',
    createdAt: '2025-02-10T10:00:00Z',
    updatedAt: '2025-02-10T10:00:00Z',
    timeToAuthorMinutes: 20,
    itemType: 'single-best-answer',
    taxonomy: {
      organSystemId: 'USMLE-GI',
      disciplineId: 'Pathology',
      bloomLevel: 'Apply',
      syndromeTopicId: 'TOPIC-GI-IBD',
      usmleContentId: 'GI-1'
    },
    linkedMediaIds: [],
    linkedLectureIds: [],
    learningObjective: 'OBJ-GI-003',
    pValue: 0.0,
    dIndex: 0.0,
    sampleSize: 0,
    distractors: []
  },
  {
    id: 'QID-RESP-404',
    itemTagline: 'Pneumonia Pathogen',
    type: 'MCQ',
    stem: 'A patient presents with rust-colored sputum and lobar consolidation. What is the most likely pathogen?',
    options: [
      { id: 'opt1', text: 'Streptococcus pneumoniae', isCorrect: true, label: 'A' },
      { id: 'opt2', text: 'Klebsiella pneumoniae', isCorrect: false, label: 'B' },
      { id: 'opt3', text: 'Mycoplasma pneumoniae', isCorrect: false, label: 'C' },
      { id: 'opt4', text: 'Staphylococcus aureus', isCorrect: false, label: 'D' },
      { id: 'opt5', text: 'Pseudomonas aeruginosa', isCorrect: false, label: 'E' }
    ],
    status: 'Published',
    version: 1,
    authorId: 'AUTH-SYSTEM',
    createdAt: '2025-02-05T10:00:00Z',
    updatedAt: '2025-02-05T10:00:00Z',
    timeToAuthorMinutes: 8,
    itemType: 'single-best-answer',
    taxonomy: {
      organSystemId: 'USMLE-RESP',
      disciplineId: 'Microbiology',
      bloomLevel: 'Remember',
      syndromeTopicId: 'TOPIC-RESP-OBS',
      usmleContentId: 'RESP-1'
    },
    linkedMediaIds: [],
    linkedLectureIds: [],
    learningObjective: 'OBJ-RESP-004',
    pValue: 0.78,
    dIndex: 0.30,
    sampleSize: 500,
    distractors: []
  }
];

export const MOCK_ITEM_PSYCHOMETRICS: ItemPsychometrics[] = [
  {
    itemId: 'QID-CV-101',
    sampleSize: 342,
    difficultyIndex: 0.62,
    discriminationIndex: 0.45,
    highIncorrectCount: 12,
    lowIncorrectCount: 45,
    groupSizeN: 92,
    timeOnTaskSecondsAvg: 45,
    distractorAnalysis: [
      { optionId: 'opt1', selectionRate: 0.62, highPerformerSelectionRate: 0.88, flaggedNonFunctional: false },
      { optionId: 'opt2', selectionRate: 0.15, highPerformerSelectionRate: 0.05, flaggedNonFunctional: false },
      { optionId: 'opt3', selectionRate: 0.18, highPerformerSelectionRate: 0.07, flaggedNonFunctional: false },
      { optionId: 'opt4', selectionRate: 0.04, highPerformerSelectionRate: 0.00, flaggedNonFunctional: true },
      { optionId: 'opt5', selectionRate: 0.01, highPerformerSelectionRate: 0.00, flaggedNonFunctional: true }
    ],
    lastUpdated: '2025-02-15'
  },
  {
    itemId: 'QID-RN-202',
    sampleSize: 120,
    difficultyIndex: 0.45,
    discriminationIndex: 0.15,
    highIncorrectCount: 25,
    lowIncorrectCount: 28,
    groupSizeN: 32,
    timeOnTaskSecondsAvg: 85,
    distractorAnalysis: [
      { optionId: 'opt1', selectionRate: 0.45, highPerformerSelectionRate: 0.50, flaggedNonFunctional: false },
      { optionId: 'opt2', selectionRate: 0.35, highPerformerSelectionRate: 0.40, flaggedNonFunctional: false },
      { optionId: 'opt3', selectionRate: 0.10, highPerformerSelectionRate: 0.05, flaggedNonFunctional: false },
      { optionId: 'opt4', selectionRate: 0.05, highPerformerSelectionRate: 0.05, flaggedNonFunctional: false },
      { optionId: 'opt5', selectionRate: 0.05, highPerformerSelectionRate: 0.00, flaggedNonFunctional: false }
    ],
    lastUpdated: '2025-02-14'
  },
  {
    itemId: 'QID-GI-303',
    sampleSize: 0,
    difficultyIndex: 0,
    discriminationIndex: 0,
    highIncorrectCount: 0,
    lowIncorrectCount: 0,
    groupSizeN: 0,
    timeOnTaskSecondsAvg: 0,
    distractorAnalysis: [],
    lastUpdated: '2025-02-10'
  },
  {
    itemId: 'QID-RESP-404',
    sampleSize: 500,
    difficultyIndex: 0.78,
    discriminationIndex: 0.30,
    highIncorrectCount: 5,
    lowIncorrectCount: 15,
    groupSizeN: 135,
    timeOnTaskSecondsAvg: 30,
    distractorAnalysis: [
      { optionId: 'opt1', selectionRate: 0.78, highPerformerSelectionRate: 0.95, flaggedNonFunctional: false },
      { optionId: 'opt2', selectionRate: 0.04, highPerformerSelectionRate: 0.00, flaggedNonFunctional: true },
      { optionId: 'opt3', selectionRate: 0.08, highPerformerSelectionRate: 0.02, flaggedNonFunctional: false },
      { optionId: 'opt4', selectionRate: 0.05, highPerformerSelectionRate: 0.01, flaggedNonFunctional: false },
      { optionId: 'opt5', selectionRate: 0.05, highPerformerSelectionRate: 0.02, flaggedNonFunctional: false }
    ],
    lastUpdated: '2025-02-05'
  }
];

// ============================================================================
// 2. CURRICULUM ASSETS
// ============================================================================

export interface UsmleSystem {
  id: string;
  name: string;
  topics: UsmleTopic[];
}

export interface UsmleTopic {
  id: string;
  name: string;
  subTopics: string[];
}

export const USMLE_2024_OUTLINE: UsmleSystem[] = [
  {
    id: "SYS-HUMAN-DEV",
    name: "Human Development",
    topics: [
      {
        id: "TOP-HUMAN-INFANCY",
        name: "Infancy & Childhood",
        subTopics: [
          "Normal physical changes",
          "Developmental stages",
          "Preventive health & lifestyle"
        ]
      },
      {
        id: "TOP-HUMAN-ADOLESCENCE",
        name: "Adolescence",
        subTopics: [
          "Normal physical changes",
          "Developmental stages",
          "Preventive health & lifestyle"
        ]
      },
      {
        id: "TOP-HUMAN-ADULTHOOD",
        name: "Adulthood",
        subTopics: [
          "Normal physical changes",
          "Developmental stages",
          "Preventive health & lifestyle"
        ]
      },
      {
        id: "TOP-HUMAN-OLDER-ADULT",
        name: "Older Adulthood",
        subTopics: [
          "Normal physical changes",
          "Developmental stages",
          "Preventive health & lifestyle"
        ]
      }
    ]
  },

  {
    id: "SYS-IMMUNE",
    name: "Immune System",
    topics: [
      {
        id: "TOP-IMM-IMMUNODEF",
        name: "Immunodeficiency Disorders",
        subTopics: [
          "Humoral immunity disorders",
          "Cell-mediated immunity disorders",
          "Complement deficiencies",
          "Phagocytic/NK cell disorders"
        ]
      },
      {
        id: "TOP-IMM-HIV",
        name: "HIV/AIDS",
        subTopics: [
          "HIV1/HIV2",
          "AIDS complications",
          "Immune reconstitution syndrome"
        ]
      },
      {
        id: "TOP-IMM-HYPERSENS",
        name: "Hypersensitivity & Immune Reactions",
        subTopics: [
          "Type I–IV hypersensitivity",
          "Transplantation & GVHD"
        ]
      },
      {
        id: "TOP-IMM-DRUG",
        name: "Drug Effects on Immune System",
        subTopics: [
          "Immunosuppressants",
          "Monoclonal antibodies",
          "Vaccine reactions"
        ]
      }
    ]
  },

  {
    id: "SYS-BLOOD",
    name: "Blood & Lymphoreticular System",
    topics: [
      {
        id: "TOP-BLOOD-INFECT",
        name: "Infectious & Immunologic Disorders",
        subTopics: [
          "Bacterial infections",
          "Viral infections",
          "Parasitic infections",
          "Lymphoid tissue infections",
          "Autoimmune hematologic disorders"
        ]
      },
      {
        id: "TOP-BLOOD-NEOPLASM",
        name: "Hematologic Neoplasms",
        subTopics: [
          "Leukemias",
          "Lymphomas",
          "Myeloma & dysproteinemias"
        ]
      },
      {
        id: "TOP-BLOOD-ANEMIA",
        name: "Anemias & Cytopenias",
        subTopics: [
          "Decreased production",
          "Hemolysis",
          "Hemoglobinopathies",
          "Cytopenias",
          "Polycythemias"
        ]
      },
      {
        id: "TOP-BLOOD-COAG",
        name: "Coagulation Disorders",
        subTopics: [
          "Hypocoagulable states",
          "Hypercoagulable states",
          "Transfusion reactions"
        ]
      }
    ]
  },

  {
    id: "SYS-BEHAVIORAL",
    name: "Behavioral Health",
    topics: [
      {
        id: "TOP-BEHAV-PSYCHOTIC",
        name: "Psychotic Disorders",
        subTopics: [
          "Schizophrenia spectrum",
          "Delusional disorders",
          "Substance-induced psychosis"
        ]
      },
      {
        id: "TOP-BEHAV-ANXIETY",
        name: "Anxiety Disorders",
        subTopics: [
          "Generalized anxiety",
          "Panic disorder",
          "Phobias",
          "PTSD",
          "OCD"
        ]
      },
      {
        id: "TOP-BEHAV-MOOD",
        name: "Mood Disorders",
        subTopics: [
          "Depressive disorders",
          "Bipolar disorders",
          "Postpartum mood disorders"
        ]
      },
      {
        id: "TOP-BEHAV-SUBSTANCE",
        name: "Substance Use Disorders",
        subTopics: [
          "Alcohol",
          "Opioids",
          "Stimulants",
          "Sedatives",
          "Cannabis",
          "Hallucinogens"
        ]
      }
    ]
  },

  {
    id: "SYS-NEURO",
    name: "Nervous System & Special Senses",
    topics: [
      {
        id: "TOP-NEURO-INFECT",
        name: "Infectious & Inflammatory Disorders",
        subTopics: [
          "Meningitis",
          "Encephalitis",
          "Prion disease",
          "Botulism & tetanus"
        ]
      },
      {
        id: "TOP-NEURO-NEOPLASM",
        name: "Neoplasms",
        subTopics: [
          "Benign CNS tumors",
          "Malignant CNS tumors",
          "Metastatic lesions"
        ]
      },
      {
        id: "TOP-NEURO-CVA",
        name: "Cerebrovascular Disease",
        subTopics: [
          "Ischemic stroke",
          "Hemorrhagic stroke",
          "Aneurysms",
          "Vascular dementia"
        ]
      },
      {
        id: "TOP-NEURO-MOVEMENT",
        name: "Movement Disorders",
        subTopics: [
          "Parkinson disease",
          "Huntington disease",
          "Essential tremor",
          "Dystonias"
        ]
      }
    ]
  },

  {
    id: "SYS-SKIN",
    name: "Skin & Subcutaneous Tissue",
    topics: [
      {
        id: "TOP-SKIN-INFECT",
        name: "Infectious Disorders",
        subTopics: [
          "Bacterial skin infections",
          "Viral exanthems",
          "Fungal infections",
          "Parasitic infestations"
        ]
      },
      {
        id: "TOP-SKIN-IMMUNO",
        name: "Immunologic & Inflammatory Disorders",
        subTopics: [
          "Eczematous dermatoses",
          "Vesiculobullous disorders",
          "Urticaria & exanthems",
          "Autoimmune skin disorders"
        ]
      },
      {
        id: "TOP-SKIN-NEOPLASM",
        name: "Skin Neoplasms",
        subTopics: [
          "Benign lesions",
          "Basal cell carcinoma",
          "Squamous cell carcinoma",
          "Melanoma"
        ]
      }
    ]
  },

  {
    id: "SYS-MSK",
    name: "Musculoskeletal System",
    topics: [
      {
        id: "TOP-MSK-INFECT",
        name: "Infectious & Inflammatory Disorders",
        subTopics: [
          "Osteomyelitis",
          "Septic arthritis",
          "Myositis",
          "Necrotizing fasciitis"
        ]
      },
      {
        id: "TOP-MSK-NEOPLASM",
        name: "Bone & Soft Tissue Neoplasms",
        subTopics: [
          "Benign bone tumors",
          "Osteosarcoma",
          "Sarcomas",
          "Metastatic bone disease"
        ]
      },
      {
        id: "TOP-MSK-DEGEN",
        name: "Degenerative & Metabolic Disorders",
        subTopics: [
          "Osteoarthritis",
          "Disc degeneration",
          "Metabolic bone disease"
        ]
      }
    ]
  },
  {
    id: "SYS-GI",
    name: "Gastrointestinal System",
    topics: [
      {
        id: "TOP-GI-INFECT",
        name: "Infectious & Inflammatory Disorders",
        subTopics: [
          "Gastroenteritis",
          "Hepatitis",
          "Pancreatitis",
          "Cholecystitis",
          "Appendicitis",
          "Inflammatory bowel disease"
        ]
      },
      {
        id: "TOP-GI-NEOPLASM",
        name: "GI Neoplasms",
        subTopics: [
          "Esophageal cancer",
          "Gastric cancer",
          "Colorectal cancer",
          "Pancreatic cancer",
          "Hepatocellular carcinoma"
        ]
      },
      {
        id: "TOP-GI-MOTILITY",
        name: "Motility & Functional Disorders",
        subTopics: [
          "GERD",
          "Achalasia",
          "Irritable bowel syndrome",
          "Gastroparesis"
        ]
      },
      {
        id: "TOP-GI-MALABSORPTION",
        name: "Malabsorption & Nutritional Disorders",
        subTopics: [
          "Celiac disease",
          "Lactose intolerance",
          "Short bowel syndrome"
        ]
      }
    ]
  },
  {
    id: "SYS-RENAL",
    name: "Renal & Urinary System",
    topics: [
      {
        id: "TOP-RENAL-GLOMERULAR",
        name: "Glomerular Disorders",
        subTopics: [
          "Nephritic syndromes",
          "Nephrotic syndromes",
          "Glomerulonephritis"
        ]
      },
      {
        id: "TOP-RENAL-TUBULAR",
        name: "Tubular & Interstitial Disorders",
        subTopics: [
          "Acute tubular necrosis",
          "Interstitial nephritis",
          "Renal tubular acidosis"
        ]
      },
      {
        id: "TOP-RENAL-VASCULAR",
        name: "Renal Vascular Disorders",
        subTopics: [
          "Renal artery stenosis",
          "Hypertensive nephropathy",
          "Thrombotic microangiopathies"
        ]
      },
      {
        id: "TOP-RENAL-UROLOGY",
        name: "Urinary Tract Disorders",
        subTopics: [
          "UTIs",
          "Pyelonephritis",
          "Kidney stones",
          "Obstructive uropathy"
        ]
      }
    ]
  },
  {
    id: "SYS-ENDOCRINE",
    name: "Endocrine System",
    topics: [
      {
        id: "TOP-ENDO-DIABETES",
        name: "Diabetes & Metabolic Disorders",
        subTopics: [
          "Type 1 diabetes",
          "Type 2 diabetes",
          "DKA",
          "HHS",
          "Hypoglycemia"
        ]
      },
      {
        id: "TOP-ENDO-THYROID",
        name: "Thyroid Disorders",
        subTopics: [
          "Hyperthyroidism",
          "Hypothyroidism",
          "Thyroiditis",
          "Thyroid nodules"
        ]
      },
      {
        id: "TOP-ENDO-ADRENAL",
        name: "Adrenal Disorders",
        subTopics: [
          "Cushing syndrome",
          "Addison disease",
          "Hyperaldosteronism",
          "Pheochromocytoma"
        ]
      },
      {
        id: "TOP-ENDO-PITUITARY",
        name: "Pituitary Disorders",
        subTopics: [
          "Pituitary adenomas",
          "Hypopituitarism",
          "SIADH",
          "Diabetes insipidus"
        ]
      }
    ]
  },
  {
    id: "SYS-REPRO",
    name: "Reproductive System",
    topics: [
      {
        id: "TOP-REPRO-FEMALE",
        name: "Female & Transgender Female Health",
        subTopics: [
          "Menstrual disorders",
          "PCOS",
          "Gynecologic infections",
          "Breast disorders",
          "Contraception"
        ]
      },
      {
        id: "TOP-REPRO-MALE",
        name: "Male & Transgender Male Health",
        subTopics: [
          "Prostate disorders",
          "Testicular disorders",
          "Male infertility",
          "STIs"
        ]
      },
      {
        id: "TOP-REPRO-PREGNANCY",
        name: "Pregnancy & Puerperium",
        subTopics: [
          "Normal pregnancy",
          "Hypertensive disorders",
          "Gestational diabetes",
          "Postpartum complications"
        ]
      }
    ]
  },
  {
    id: "SYS-MULTISYSTEM",
    name: "Multisystem Processes & Disorders",
    topics: [
      {
        id: "TOP-MULTI-SHOCK",
        name: "Shock & Critical Illness",
        subTopics: [
          "Septic shock",
          "Cardiogenic shock",
          "Hypovolemic shock",
          "Distributive shock"
        ]
      },
      {
        id: "TOP-MULTI-AUTOIMMUNE",
        name: "Autoimmune & Systemic Disorders",
        subTopics: [
          "SLE",
          "Rheumatoid arthritis",
          "Vasculitides",
          "Sarcoidosis"
        ]
      },
      {
        id: "TOP-MULTI-INFECTION",
        name: "Systemic Infections",
        subTopics: [
          "Sepsis",
          "Systemic fungal infections",
          "Opportunistic infections"
        ]
      }
    ]
  },
  {
    id: "SYS-BIOSTATS",
    name: "Biostatistics & Epidemiology / Population Health",
    topics: [
      {
        id: "TOP-BIOSTATS-STUDY",
        name: "Study Design & Interpretation",
        subTopics: [
          "Bias",
          "Confounding",
          "Randomization",
          "Blinding",
          "Study types"
        ]
      },
      {
        id: "TOP-BIOSTATS-MEASURES",
        name: "Measures & Calculations",
        subTopics: [
          "Sensitivity & specificity",
          "Predictive values",
          "Risk ratios",
          "Odds ratios"
        ]
      },
      {
        id: "TOP-BIOSTATS-PUBLIC",
        name: "Public Health & Screening",
        subTopics: [
          "Screening programs",
          "Outbreak investigation",
          "Health disparities"
        ]
      }
    ]
  },
  {
    id: "SYS-SOCIAL",
    name: "Social Sciences / Communication & Interpersonal Skills",
    topics: [
      {
        id: "TOP-SOCIAL-COMM",
        name: "Communication Skills",
        subTopics: [
          "Patient interviewing",
          "Breaking bad news",
          "Shared decision-making"
        ]
      },
      {
        id: "TOP-SOCIAL-ETHICS",
        name: "Ethics & Professionalism",
        subTopics: [
          "Consent",
          "Capacity",
          "Confidentiality",
          "Professional boundaries"
        ]
      },
      {
        id: "TOP-SOCIAL-SYSTEMS",
        name: "Healthcare Systems & Social Determinants",
        subTopics: [
          "Access to care",
          "Cultural competence",
          "Health literacy",
          "Social determinants of health"
        ]
      }
    ]
  }
];

export const MOCK_LEARNING_OBJECTIVES: LearningObjective[] = [
  {
    id: 'OBJ-CV-001',
    text: 'Differentiate between transmural and subendocardial infarction based on ECG findings.',
    bloomLevel: 'Analyze',
    disciplineId: 'Pathology',
    organSystemId: 'USMLE-CV',
    usmleContentId: 'CV-1.2.3',
    usmleCodes: ['CV-1.2.3', 'PATH-001'],
    subTopic: 'Acute MI',
    linkedItemIds: ['QID-CV-101'],
    linkedLectureIds: ['LECT-CV-MI-001']
  },
  {
    id: 'OBJ-RN-002',
    text: 'Calculate fractional excretion of sodium (FeNa) to distinguish prerenal from intrinsic renal failure.',
    bloomLevel: 'Apply',
    disciplineId: 'Pathophysiology',
    organSystemId: 'USMLE-RENAL',
    usmleContentId: 'RN-2.1.4',
    usmleCodes: ['RN-2.1.4', 'PHYS-002'],
    subTopic: 'Prerenal',
    linkedItemIds: ['QID-RN-202']
  },
  {
    id: 'OBJ-GI-003',
    text: 'Identify the pathophysiology of Zollinger-Ellison syndrome.',
    bloomLevel: 'Apply',
    disciplineId: 'Pathology',
    organSystemId: 'USMLE-GI',
    usmleContentId: 'GI-1',
    usmleCodes: ['GI-1', 'ENDO-003'],
    subTopic: 'Gastric Disorders',
    linkedItemIds: ['QID-GI-303']
  },
  {
    id: 'OBJ-RESP-004',
    text: 'Recognize the clinical presentation of pneumococcal pneumonia.',
    bloomLevel: 'Remember',
    disciplineId: 'Microbiology',
    organSystemId: 'USMLE-RESP',
    usmleContentId: 'RESP-1',
    usmleCodes: ['RESP-1', 'MICRO-004'],
    subTopic: 'Pneumonia',
    linkedItemIds: ['QID-RESP-404']
  }
];

// ============================================================================
// 3. COHORT PERFORMANCE & RELIABILITY
// ============================================================================

export const MOCK_COHORTS: Cohort[] = [
  { id: 'COH-MS1-FALL', name: 'MS1 (Fall Intake)', yearLevel: 'MS1', intakeTerm: 'Fall', studentCount: 150 },
  { id: 'COH-MS1-SPRING', name: 'MS1 (Spring Intake)', yearLevel: 'MS1', intakeTerm: 'Spring', studentCount: 120 }
];

// Generators for realistic student patterns
const createGunner = (id: string, name: string, cohort: string) => ({
  studentId: id,
  studentName: name,
  cohortId: cohort,
  masteryScores: { Cardiovascular: 94, Renal: 92, GI: 88, Respiratory: 91, Endocrine: 95, Hematology: 89 },
  discriminationWeightedScore: 95,
  totalScore: 92,
  atRisk: false,
  predictedStep1: '260-270',
  engagementScore: 98,
  percentileRank: 99,
  coverage: 85,
  recentDailyGain: 1.8,
  daysUntilStep1: 180
});

const createStruggler = (id: string, name: string, cohort: string) => ({
  studentId: id,
  studentName: name,
  cohortId: cohort,
  masteryScores: { Cardiovascular: 52, Renal: 41, GI: 68, Respiratory: 45, Endocrine: 50, Hematology: 48 },
  discriminationWeightedScore: 35,
  totalScore: 51,
  atRisk: true,
  predictedStep1: '190-210',
  engagementScore: 72,
  percentileRank: 22,
  coverage: 35,
  recentDailyGain: 0.4,
  daysUntilStep1: 180
});

const createEfficient = (id: string, name: string, cohort: string) => ({
  studentId: id,
  studentName: name,
  cohortId: cohort,
  masteryScores: { Cardiovascular: 78, Renal: 82, GI: 75, Respiratory: 80, Endocrine: 85, Hematology: 79 },
  discriminationWeightedScore: 82,
  totalScore: 80,
  atRisk: false,
  predictedStep1: '230-240',
  engagementScore: 88,
  percentileRank: 75,
  coverage: 92,
  recentDailyGain: 1.2,
  daysUntilStep1: 180
});

const createDrifter = (id: string, name: string, cohort: string) => ({
  studentId: id,
  studentName: name,
  cohortId: cohort,
  masteryScores: { Cardiovascular: 85, Renal: 82, GI: 80, Respiratory: 84, Endocrine: 81, Hematology: 78 },
  discriminationWeightedScore: 83,
  totalScore: 82,
  atRisk: true, // Risk due to low coverage/velocity, not mastery
  predictedStep1: '220-230',
  engagementScore: 60,
  percentileRank: 65,
  coverage: 25, // Very low coverage
  recentDailyGain: 0.2, // Very slow
  daysUntilStep1: 180
});

export const MOCK_STUDENTS: StudentMastery[] = [
  // Fall Intake (Generally Ahead)
  createGunner('S-901', 'Julian Thorne', 'COH-MS1-FALL'),
  createGunner('S-902', 'Aisha Patel', 'COH-MS1-FALL'),
  createEfficient('S-903', 'Liam O\'Connor', 'COH-MS1-FALL'),
  createEfficient('S-904', 'Sarah Chen', 'COH-MS1-FALL'),
  createEfficient('S-905', 'Marcus Vane', 'COH-MS1-FALL'),
  createStruggler('S-906', 'David Kim', 'COH-MS1-FALL'),
  createStruggler('S-907', 'Emily Davis', 'COH-MS1-FALL'),
  createDrifter('S-908', 'James Wilson', 'COH-MS1-FALL'),
  createEfficient('S-909', 'Olivia Martinez', 'COH-MS1-FALL'),
  createGunner('S-910', 'Lucas Anderson', 'COH-MS1-FALL'),

  // Spring Intake (Newer, mixed)
  createGunner('S-101', 'Elena Rostova', 'COH-MS1-SPRING'),
  createStruggler('S-102', 'Tom Baker', 'COH-MS1-SPRING'),
  createDrifter('S-103', 'Sophie Clarke', 'COH-MS1-SPRING'),
  createEfficient('S-104', 'Raj Singh', 'COH-MS1-SPRING'),
  createStruggler('S-105', 'Maria Garcia', 'COH-MS1-SPRING'),
  createDrifter('S-106', 'Kevin Lee', 'COH-MS1-SPRING'),
  createGunner('S-107', 'Anna White', 'COH-MS1-SPRING'),
  createEfficient('S-108', 'Brian Scott', 'COH-MS1-SPRING'),
  createStruggler('S-109', 'Chloe Turner', 'COH-MS1-SPRING'),
  createDrifter('S-110', 'Daniel Harris', 'COH-MS1-SPRING'),
];

export const MOCK_ORGAN_SYSTEMS = [
  { id: "SYS-HUMAN-DEV", name: "Human Development" },
  { id: "SYS-IMMUNE", name: "Immune System" },
  { id: "SYS-BLOOD", name: "Blood & Lymphoreticular" },
  { id: "SYS-BEHAVIORAL", name: "Behavioral Health" },
  { id: "SYS-NEURO", name: "Nervous System & Special Senses" },
  { id: "SYS-SKIN", name: "Skin & Subcutaneous Tissue" },
  { id: "SYS-MSK", name: "Musculoskeletal System" },
  { id: "SYS-GI", name: "Gastrointestinal System" },
  { id: "SYS-RENAL", name: "Renal & Urinary System" },
  { id: "SYS-ENDOCRINE", name: "Endocrine System" },
  { id: "SYS-REPRO", name: "Reproductive System" },
  { id: "SYS-MULTISYSTEM", name: "Multisystem Processes & Disorders" },
  { id: "SYS-BIOSTATS", name: "Biostatistics & Epidemiology" },
  { id: "SYS-SOCIAL", name: "Social Sciences" }
];

export const MOCK_RELIABILITY_TARGETS: ReliabilityTarget[] = [
  { context: 'USMLE Formative Block', targetCronbachAlpha: 0.85, targetKR20: 0.85 },
  { context: 'Peer-to-Peer Quiz', targetCronbachAlpha: 0.70, targetKR20: 0.70 }
];

export const MOCK_EXAM_BLUEPRINTS: ExamBlueprint[] = [
  {
    id: 'BP-STEP1-SIM',
    name: 'Step 1 Clinical Synthesis',
    description: 'High-density blueprint focusing on pathophysiology and multi-step reasoning.',
    totalItems: 280,
    organSystemWeights: [
      { organSystemId: 'USMLE-CV', weightPercent: 15 },
      { organSystemId: 'USMLE-RENAL', weightPercent: 12 },
      { organSystemId: 'USMLE-GI', weightPercent: 12 },
      { organSystemId: 'USMLE-RESP', weightPercent: 12 },
      { organSystemId: 'USMLE-ENDO', weightPercent: 10 }
    ],
    difficultyDistribution: [
      { label: 'Easy', proportion: 0.2 },
      { label: 'Moderate', proportion: 0.5 },
      { label: 'Hard', proportion: 0.3 }
    ],
    bloomDistribution: [
      { bloomLevel: 'Remember', proportion: 0.1 },
      { bloomLevel: 'Understand', proportion: 0.3 },
      { bloomLevel: 'Apply', proportion: 0.4 },
      { bloomLevel: 'Analyze', proportion: 0.2 }
    ]
  }
];

export const MOCK_ISSUES: Issue[] = [
  {
    id: 'ISS-001',
    type: 'Performance',
    severity: 'High',
    title: 'Negative Discrimination',
    description: 'Item GI-303 is confusing high-performing students.',
    questionId: 'QID-GI-303',
    status: 'Open',
    createdAt: '2025-02-18'
  },
  {
    id: 'ISS-002',
    type: 'Content',
    severity: 'Medium',
    title: 'Non-functional Distractor',
    description: 'Distractor B in Item RESP-404 has < 5% selection rate.',
    questionId: 'QID-RESP-404',
    status: 'Open',
    createdAt: '2025-02-18'
  }
];

// ============================================================================
// 4. INSTRUCTIONAL ASSETS (DEMO LECTURE)
// ============================================================================

export const MOCK_LECTURES: LectureAsset[] = [
  {
    id: 'LECT-CV-MI-001',
    title: 'MI Histopathology: The 0-24 Hour Window',
    description: 'Critical analysis of cellular changes post-ischemia. Essential for Step 1 differentiation between early and marginal necrosis.',
    videoUri: 'mi_pathology_lecture.mp4',
    transcriptUri: 'mi_pathology_transcript.vtt',
    slideDeckUri: 'mi_pathology_slides.pdf',
    engagementMarkers: [
      { timestampSec: 120, type: 'Conceptual Spike', description: 'Differential: 4-12 vs 12-24 hour window transition.' },
      { timestampSec: 450, type: 'Visual Evidence', description: 'High-power microscopy showing contraction bands.' },
      { timestampSec: 820, type: 'Clinical Correlate', description: 'Relationship between neutrophil waves and reperfusion injury.' }
    ],
    status: 'Published',
    version: 1,
    authorId: 'AUTH-DEAN',
    estimatedDurationMinutes: 18,
    createdAt: '2025-01-20T10:00:00Z',
    updatedAt: '2025-02-15T09:00:00Z',
    linkedObjectiveIds: ['OBJ-CV-001'],
    linkedItemIds: ['QID-CV-101']
  }
];

export const MOCK_LECTURE_METRICS = [
  {
    lectureId: 'LECT-CV-MI-001',
    avgWatchTimePercent: 0.88,
    rewatchRatePercent: 0.42,
    preAssessmentAvg: 0.52,
    postAssessmentAvg: 0.84,
    retentionAssessmentAvg: 0.78,
    downstreamMCQPerformance: 0.81,
    nbmeCorrelationScore: 0.74,
    avgTutorQueriesPerStudent: 1.4,
    avgNotesPerStudent: 8.2,
    intrinsicLoad: 6,
    extraneousLoad: 2,
    germaneLoad: 8,
    pauseClusterTimestamps: [120, 122, 125, 450, 455]
  }
];

// ============================================================================
// 5. AI INSIGHTS & AGENT STATUS
// ============================================================================

export const MOCK_AI_INSIGHT_LOGS: AIAgentInsight[] = [
  {
    id: 'INS-001',
    agentName: 'Sina Core',
    message: 'Discrimination drift detected in Renal MCQ block. Item QID-RN-202 is confusing top performers.',
    priority: 'high',
    severity: 'critical',
    timestamp: new Date().toISOString(),
    actionRequired: true,
    category: 'QB_HEALTH',
    suggestedActions: ['Audit Item', 'Adjust Options'],
    entityId: 'QID-RN-202'
  },
  {
    id: 'INS-002',
    agentName: 'Sina Mastery',
    message: 'Cohort performance on Cardiovascular MI Histopathology items is strongly correlated with lecture LECT-CV-MI-001 completion.',
    priority: 'medium',
    severity: 'info',
    timestamp: new Date().toISOString(),
    actionRequired: false,
    category: 'STUDENT_MASTERY',
    suggestedActions: ['Endorse Resource'],
    entityId: 'LECT-CV-MI-001'
  }
];

export const MOCK_AGENT_STATUS = [
  { id: 'AGT-001', name: 'Sina Psychometric', status: 'online', recentTasksProcessed: 142 },
  { id: 'AGT-002', name: 'Sina Curriculum', status: 'online', recentTasksProcessed: 56 },
  { id: 'AGT-003', name: 'Sina Authoring', status: 'warning', recentTasksProcessed: 89 }
];

export const USMLE_SYSTEM_DISTRIBUTION = {
  "SYS-HUMAN-DEV": { min: 1, max: 3 },
  "SYS-BLOOD-IMMUNE": { min: 9, max: 13 },
  "SYS-BEHAVIORAL-NEURO": { min: 10, max: 14 },
  "SYS-MSK-SKIN": { min: 8, max: 12 },
  "SYS-CV": { min: 7, max: 11 },
  "SYS-GI": { min: 6, max: 10 },
  "SYS-REPRO-ENDO": { min: 12, max: 16 },
  "SYS-MULTISYSTEM": { min: 8, max: 12 },
  "SYS-BIOSTATS": { min: 4, max: 6 },
  "SYS-SOCIAL": { min: 6, max: 9 }
};

export const USMLE_DISCIPLINE_DISTRIBUTION = {
  PATHOLOGY: { min: 45, max: 55 },
  PHYSIOLOGY: { min: 30, max: 40 },
  PHARMACOLOGY: { min: 10, max: 20 },
  BIOCHEM_NUTRITION: { min: 5, max: 15 },
  MICROBIOLOGY: { min: 10, max: 20 },
  IMMUNOLOGY: { min: 5, max: 15 },
  ANATOMY_EMBRYOLOGY: { min: 10, max: 20 },
  HISTOLOGY_CELL: { min: 5, max: 15 },
  BEHAVIORAL_SCIENCE: { min: 10, max: 15 }
};

export const USMLE_TASK_DISTRIBUTION = {
  FOUNDATIONAL_SCIENCE: { min: 60, max: 70 },
  DIAGNOSIS: { min: 20, max: 25 },
  COMMUNICATION: { min: 6, max: 9 },
  PRACTICE_BASED_LEARNING: { min: 4, max: 6 }
};
