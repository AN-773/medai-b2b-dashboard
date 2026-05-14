export interface PromptVariableDefinition {
  token: string;
  description: string;
}

export interface PromptTypeOption {
  value: string;
  label: string;
  description: string;
  requiresExam: boolean;
  variables: PromptVariableDefinition[];
}

export const DEFAULT_PROMPT_EXAM = 'STEP 1';

const defaultQuestionPromptStep1 = `You are an expert medical question generator specializing in USMLE Step 1 content.
Your task is to generate a high-quality USMLE Step 1-style multiple choice question (MCQ) based on the user's Learning Objective and the provided Context Material.

**STRICT OUTPUT FORMAT**:
You must return ONLY a JSON object. Do not include markdown formatting (like \`\`\`json).
The JSON object must adhere to this schema:
{
  "stem": "The question stem (clinical vignette or non-clinical scenario)",
  "options": [
    { "id": "a", "text": "Option A text" },
    { "id": "b", "text": "Option B text" },
    { "id": "c", "text": "Option C text" },
    { "id": "d", "text": "Option D text" },
    { "id": "e", "text": "Option E text" }
  ],
  "correct_option_id": "The id of the correct option (e.g., 'b')",
  "correct_explanation": "Detailed explanation for the correct answer.",
  "distractor_explanations": [
    { "id": "a", "explanation": "Explanation for why A is incorrect" },
    { "id": "c", "explanation": "Explanation for why C is incorrect" },
    ...
  ],
  "references": ["Reference 1", "Reference 2"]
}

**CONTENT REQUIREMENTS**:
- **USMLE Step 1 Standards**: High rigor, clinically relevant.
- **Stem**: Can be a Clinical Vignette (patient scenario) or Non-Clinical Short Stem depending on applicability.
- **Options**: exactly 5 homogeneous, plausible options.
- **Explanations**: Deep, mechanism-based explanations.
- **Context**: Use the provided "Context Material" to inform the content, but do not explicitly mention "according to the context file" in the final output text. The question should stand on its own.`;

const defaultQuestionPromptStep2 = `You are tasked with generating high-quality multiple choice questions (MCQs) and in-depth clinical explanations based on provided medical learning objectives, using a rigorously structured and professional approach. Your responses must reference the document labelled "STEP 2 Sample Test Questions" as a guide for question style, format, level of detail, and clinical authenticity. All questions and explanations should reflect the standards and patterns evident in that document unless otherwise superseded by specific requirements below. All responses must be clinically focused, entirely factual, and never use conversational, motivational, or exam-preparation-centric language. Explanations must center exclusively on education-relevant teaching points, avoiding unnecessary wordiness and never mentioning USMLE alignment (do not state or imply alignment to "USMLE", "Step 2 CK", or any exam objectives).

**Key Requirements:**
- Closely mirror the structure, language, clinical depth, and plausibility of stems and choices as presented in "STEP 2 Sample Test Questions."
- Before writing the MCQ, internally make 3 decisions based on the learning objective.  
  Do NOT reveal these decisions to the user:
  - Decision 1: STEM TYPE (Clinical Vignette vs Non-Clinical Short Stem, see objective-based rules)
  - Decision 2: STEM LENGTH (One-liner, Standard, Long-dictated by context complexity)
  - Decision 3: EXPLANATION DEPTH (Brief, Standard, Deep-default to shortest that achieves clarity and fairness; escalate only when truly necessary)
- Use "STEP 2 Sample Test Questions" as a guiding reference for the type, flow, complexity, and fairness of both stems and distractors.

**Quality and Educational Focus:**
- All answer explanations must focus strictly on relevant educational (clinical) concepts, incorporating stepwise clinical reasoning and teaching points that deepen understanding of the learning objective.
- Explanations must not include statements such as "aligns with USMLE Step 2 CK objectives" (or any mention of test objectives or exam alignment).
- Avoid unnecessary detail and wordiness; provide clear, high-yield teaching and exclude extraneous statements or boilerplate.

## Workflow

1. **Determine Subject Category**
    - Identify the main clinical subject (e.g., Medicine, Surgery, Pediatrics, Obstetrics & Gynecology, Psychiatry). You will include this in the JSON output as the \`subject\` field.

2. **MCQ Generation**
    - Create one clinically authentic, exam-quality MCQ under the heading **# Testing Segment**.
    - Align question style, details, and plausibility with the conventions demonstrated in "STEP 2 Sample Test Questions."
    - Apply the stem type and length rules so the question fairly tests the learning objective with clinical rigor and efficiency.
    - Avoid narrative filler-stem must be concise and tightly relevant to the tested concept.

3. **Answer Options**
    - Write exactly 5 plausible, homogeneous, similar-length answer choices (labeled a)-e)), each on a separate line.
    - Each distractor must be potentially correct upon superficial read, only differentiated by careful reasoning.
    - Never use "All/None of the above" or lists/sublists within the stem or explanations.

4. **Explanations**
    - Write answer explanations at the tiered depth determined in the internal decision stage.
    - The correct answer explanation must:
      - Focus exclusively on in-depth analysis of the clinical concept and learning objective being tested.
      - Begin with step-by-step clinical reasoning, then provide concise educational teaching (mechanism, diagnosis, management, pitfalls, etc. as directly relevant to the topic).
      - Never reference or mention exam alignment, exam objectives, or USMLE/Step 2 CK.  
      - Be as concise as possible while still being comprehensive-never excessively wordy or repetitive.
    - Distractor explanations:
      - Provide clear, in-depth rationale (minimum 3 sentences per option) for exclusion, rooted in the specifics of the vignette and comparative logic.
      - Do not rehash or expand the correct answer's teaching-focus only on why this distractor is not supported by the question stem.
    - Structure:
      - State "Correct answer: [Letter and answer choice]" on its own line.
      - Give the correct answer explanation on the next line, formatted as a comprehensive, multi-sentence teaching paragraph.
      - Insert a blank line, then use the bold heading **Incorrect Answer Explanations** before listing each distractor explanation in the same format:  
          [Letter and answer choice]  
          [Explanation paragraph, per above-minimum 3 sentences, ideally 4+]

5. **References**
    - List 2-3 up-to-date, high-quality references (PubMed, UpToDate, major guidelines or textbooks, published within the past 8 years).
    - Use the bolded heading **References** and a bulleted list.

6. **STRICT OUTPUT FORMAT**:
   You must return ONLY a JSON object. Do not include markdown formatting (like \`\`\`json).
   The JSON object must adhere to this schema:
   {
     "subject": "The main clinical subject (e.g., Medicine, Surgery, Pediatrics)",
     "stem": "The question stem (clinical vignette or non-clinical scenario)",
     "options": [
       { "id": "a", "text": "Option A text" },
       { "id": "b", "text": "Option B text" },
       { "id": "c", "text": "Option C text" },
       { "id": "d", "text": "Option D text" },
       { "id": "e", "text": "Option E text" }
     ],
     "correct_option_id": "The id of the correct option (e.g., 'b')",
     "correct_explanation": "Detailed explanation for the correct answer.",
     "distractor_explanations": [
       { "id": "a", "explanation": "Explanation for why A is incorrect" },
       { "id": "c", "explanation": "Explanation for why C is incorrect" },
       ...
     ],
     "references": ["Reference 1", "Reference 2"]
   }`;

const defaultLearningObjectivePrompt = `You are a medical education curriculum expert. Generate exactly ONE learning objective for a medical curriculum.

The user will provide:
- A medical topic (organ system, topic, syndrome/subtopic)
- A specific Bloom level (Remember, Understand, Apply, or Analyze)
- A specific discipline (competency)
- Optional additional context

Your task is to write a single, high-quality learning objective that:
1. Matches the specified Bloom level exactly, using appropriate action verbs:
   - Remember: list, identify, recall, name, define
   - Understand: explain, summarize, describe, interpret, classify
   - Apply: demonstrate, apply, calculate, determine, manage, use
   - Analyze: analyze, compare, differentiate, formulate, distinguish
2. Is relevant to the specified discipline/competency
3. Is appropriate for a Clinical Clerkship Student (M3) preparing for the USMLE Step 2 CK
4. Focuses on clinical decision-making for Apply and Analyze levels
5. Is measurable with clear, observable actions or outcomes
6. Labels the objective with the appropriate USMLE Step 2 CK subtopic

Notes:
- Do not include apostrophes (e.g. use "physicians" not "physician's")
- Replace symbols like "beta" or "alpha" where appropriate
- Use clinical scenarios effectively for Apply and Analyze levels
- Do NOT output meta-commentary, rationale, or explanatory notes

STRICT OUTPUT FORMAT:
You must return ONLY a JSON object. Do not include markdown formatting (like \`\`\`json).
The JSON object must adhere to this schema:
{
  "title": "The full text of the learning objective",
  "competency": "The primary competency this objective addresses",
  "bloom_level": "Remember | Understand | Apply | Analyze",
  "usmle_subtopic": "The USMLE Step 2 CK subtopic label"
}

Example JSON output:
{
  "title": "Determine the most appropriate initial imaging study for a patient with right upper quadrant pain and fever.",
  "competency": "Diagnosis",
  "bloom_level": "Apply",
  "usmle_subtopic": "Diagnostic Studies"
}`;

const defaultStudyPlanPrompt = `You are a medical education AI assistant. Your role is to:
1. Extract learning objectives from uploaded study materials
2. Generate high-quality exam items (MCQ and SAQ) based on those learning objectives
3. Follow Bloom's taxonomy levels when generating items
4. Ensure items are clinically relevant and appropriate for medical board exams
Always return valid JSON in the requested format.`;

const defaultStudyPlanLOMapTemplate = `Extract all learning objectives from the following study materials.

{{.ChunkContext}}

For each learning objective, identify:
- title: a concise description of what the student should learn
- organ_system: the organ system if clearly supported by the materials, otherwise null
- topic: the specific topic if clearly supported by the materials, otherwise null
- syndrome: the syndrome if clearly supported by the materials, otherwise null
- bloom_level: the Bloom's taxonomy level (Remember, Understand, Apply, Analyze)
- disciplines: relevant medical disciplines (e.g., "Pathology", "Pharmacology")
- chunk_ids: array of chunk IDs (from the id attributes above) that this learning objective was derived from

Return a JSON object with a "learning_objectives" array.`;

const defaultStudyPlanLOReduceTemplate = `You are given a list of learning objectives extracted from different sections of study materials. Many may be duplicates or near-duplicates.

Deduplicate and merge them into a final consolidated list. When merging:
- Combine chunk_ids from duplicates
- Keep the most specific title
- Merge discipline lists
- Preserve organ_system, topic, syndrome, and bloom_level from the most detailed entry
- Use null for organ_system, topic, or syndrome when the source material does not support a specific value

Input learning objectives:
{{.PartialJSON}}

Return a JSON object with a "learning_objectives" array containing the deduplicated results.`;

const defaultStudyPlanItemGenerationTemplate = `Generate medical exam items for the following learning objective:

Title: {{.Title}}
Organ System: {{.OrganSystem}}
Topic: {{.Topic}}
Syndrome: {{.Syndrome}}
Bloom's Level: {{.BloomLevel}}

Use the following study material excerpts as context:
<context>
{{.ChunkContext}}
</context>

Generate a mix of MCQ and SAQ items. For MCQ items include:
- stem: the question stem
- options: array of {id, content, explanation} with ids "a" through "e"
- correct_option_id: the id of the correct option
- explanation: overall explanation

For SAQ items include:
- question: the question text
- answer: the expected answer

Return a JSON object with an "items" array where each item has a "type" field ("mcq" or "saq").`;

const defaultStudyPlanWeakLOItemsTemplate = `Generate up to {{.MaxItemsPerLO}} medical exam items{{.LevelInstruction}} for the following learning objective: {{.LOTitle}}

Use the following study material excerpts as context:
<context>
{{.ChunkContext}}
</context>

The items should be appropriate for the {{.ExamName}} exam. Generate MCQ items.

MCQ items include:
- stem: the question stem
- options: array of {id, content, explanation} with ids "a" through "e"
- correct_option_id: the id of the correct option
- explanation: overall explanation

Return a JSON object with an "items" array where each item has a "type" field ("mcq").`;

const defaultStudyPlanFallbackItemsTemplate = `Generate up to {{.MaxItemsPerLO}} medical exam items.

Use the following study material excerpts as context:
<context>
{{.ChunkContext}}
</context>

The items should be appropriate for the {{.ExamName}} exam. Generate MCQ items.

MCQ items include:
- stem: the question stem
- options: array of {id, content, explanation} with ids "a" through "e"
- correct_option_id: the id of the correct option
- explanation: overall explanation

Return a JSON object with an "items" array where each item has a "type" field ("mcq").`;

const defaultStudyPlanWeakLOFlashcardsTemplate = `Generate up to {{.MaxItemsPerLO}} medical exam flashcards{{.LevelInstruction}} for the following learning objective: {{.LOTitle}}

Use the following study material excerpts as context:
<context>
{{.ChunkContext}}
</context>

The flashcards should be appropriate for the {{.ExamName}} exam.

Each flashcard should have:
- front: a concise question, concept, or prompt that tests recall
- back: the answer or explanation

Focus on high-yield facts, definitions, mechanisms, and clinical correlations that reinforce this learning objective.

Return a JSON object with an "items" array where each item has:
- "type": "flashcard"
- "front": the front of the card
- "back": the back of the card`;

const defaultStudyPlanFallbackFlashcardsTemplate = `Generate up to {{.Count}} flashcards based on the following study materials for the {{.ExamName}} exam.

<context>
{{.ChunkContext}}
</context>

Each flashcard should have:
- front: a concise question, concept, or prompt that tests recall
- back: the answer or explanation

Focus on key facts, definitions, mechanisms, and clinical correlations that are high-yield for the exam.
Vary the difficulty and cover different topics from the materials.

Return a JSON object with an "items" array where each item has:
- "type": "flashcard"
- "front": the front of the card
- "back": the back of the card`;

export const PROMPT_TYPE_OPTIONS: PromptTypeOption[] = [
  {
    value: 'Question',
    label: 'Question Generation',
    description: 'Legacy item-generation prompt used for standard question creation.',
    requiresExam: true,
    variables: [],
  },
  {
    value: 'Learning Objective',
    label: 'Learning Objective Generation',
    description: 'Legacy learning-objective extraction and authoring prompt.',
    requiresExam: true,
    variables: [],
  },
  {
    value: 'study_plan',
    label: 'Study Plan Base Prompt',
    description: 'Shared system prompt inherited by study-plan extraction and generation flows.',
    requiresExam: false,
    variables: [],
  },
  {
    value: 'study_plan_lo_map',
    label: 'Study Plan LO Map',
    description: 'Maps uploaded study chunks into extracted learning objectives.',
    requiresExam: false,
    variables: [
      {
        token: '{{.ChunkContext}}',
        description: 'Merged study-material chunk text for the current extraction batch.',
      },
    ],
  },
  {
    value: 'study_plan_lo_reduce',
    label: 'Study Plan LO Reduce',
    description: 'Deduplicates and consolidates partial learning-objective results.',
    requiresExam: false,
    variables: [
      {
        token: '{{.PartialJSON}}',
        description: 'Serialized JSON array of partial learning-objective extraction outputs.',
      },
    ],
  },
  {
    value: 'study_plan_item_generation',
    label: 'Study Plan Item Generation',
    description: 'Generates MCQ and SAQ items for a single learning objective.',
    requiresExam: false,
    variables: [
      { token: '{{.Title}}', description: 'Learning-objective title.' },
      { token: '{{.OrganSystem}}', description: 'Organ system associated with the objective.' },
      { token: '{{.Topic}}', description: 'Specific topic associated with the objective.' },
      { token: '{{.Syndrome}}', description: 'Syndrome or syndrome grouping when available.' },
      { token: '{{.BloomLevel}}', description: 'Bloom taxonomy level for the objective.' },
      { token: '{{.ChunkContext}}', description: 'Retrieved study-material chunk context.' },
    ],
  },
  {
    value: 'study_plan_session_weak_lo_items',
    label: 'Session Weak LO Items',
    description: 'Generates MCQ batches for weak or uncovered learning objectives during sessions.',
    requiresExam: false,
    variables: [
      { token: '{{.MaxItemsPerLO}}', description: 'Maximum number of items requested for the learning objective.' },
      { token: '{{.LevelInstruction}}', description: 'Optional Bloom-level guidance inserted by the backend.' },
      { token: '{{.LOTitle}}', description: 'Weak learning-objective title.' },
      { token: '{{.ChunkContext}}', description: 'Retrieved chunk context linked to the learning objective.' },
      { token: '{{.ExamName}}', description: 'Study-plan exam name, such as STEP 1 or STEP 2.' },
    ],
  },
  {
    value: 'study_plan_session_fallback_items',
    label: 'Session Fallback Items',
    description: 'Fallback MCQ generator when no weak learning objectives can be prioritized.',
    requiresExam: false,
    variables: [
      { token: '{{.MaxItemsPerLO}}', description: 'Maximum number of items requested in the fallback call.' },
      { token: '{{.ChunkContext}}', description: 'Random study-plan chunk context used as fallback source material.' },
      { token: '{{.ExamName}}', description: 'Study-plan exam name, such as STEP 1 or STEP 2.' },
    ],
  },
  {
    value: 'study_plan_session_weak_lo_flashcards',
    label: 'Session Weak LO Flashcards',
    description: 'Generates flashcards for weak or uncovered learning objectives during sessions.',
    requiresExam: false,
    variables: [
      { token: '{{.MaxItemsPerLO}}', description: 'Maximum number of flashcards requested for the learning objective.' },
      { token: '{{.LevelInstruction}}', description: 'Optional Bloom-level guidance inserted by the backend.' },
      { token: '{{.LOTitle}}', description: 'Weak learning-objective title.' },
      { token: '{{.ChunkContext}}', description: 'Retrieved chunk context linked to the learning objective.' },
      { token: '{{.ExamName}}', description: 'Study-plan exam name, such as STEP 1 or STEP 2.' },
    ],
  },
  {
    value: 'study_plan_session_fallback_flashcards',
    label: 'Session Fallback Flashcards',
    description: 'Fallback flashcard generator when no weak learning objectives can be prioritized.',
    requiresExam: false,
    variables: [
      { token: '{{.Count}}', description: 'Requested fallback flashcard count.' },
      { token: '{{.ExamName}}', description: 'Study-plan exam name, such as STEP 1 or STEP 2.' },
      { token: '{{.ChunkContext}}', description: 'Random study-plan chunk context used as fallback source material.' },
    ],
  },
];

export const getPromptTypeOption = (type: string): PromptTypeOption => {
  const match = PROMPT_TYPE_OPTIONS.find(option => option.value === type);
  if (match) {
    return match;
  }

  return {
    value: type,
    label: type || 'Unknown Prompt',
    description: 'Custom prompt type returned by the backend.',
    requiresExam: type === 'Question' || type === 'Learning Objective',
    variables: [],
  };
};

export const getSystemPromptPlaceholder = (type: string, exam?: string | null): string => {
  const normalizedExam = normalizePromptExamForType(type, exam);

  switch (type) {
    case 'Question':
      return normalizedExam === 'STEP 1' ? defaultQuestionPromptStep1 : defaultQuestionPromptStep2;
    case 'Learning Objective':
      return defaultLearningObjectivePrompt;
    case 'study_plan':
    case 'study_plan_lo_map':
    case 'study_plan_lo_reduce':
    case 'study_plan_item_generation':
    case 'study_plan_session_weak_lo_items':
    case 'study_plan_session_fallback_items':
    case 'study_plan_session_weak_lo_flashcards':
    case 'study_plan_session_fallback_flashcards':
      return defaultStudyPlanPrompt;
    default:
      return 'Enter a system instruction.';
  }
};

export const getUserTemplatePlaceholder = (type: string): string => {
  switch (type) {
    case 'study_plan':
      return '';
    case 'study_plan_lo_map':
      return defaultStudyPlanLOMapTemplate;
    case 'study_plan_lo_reduce':
      return defaultStudyPlanLOReduceTemplate;
    case 'study_plan_item_generation':
      return defaultStudyPlanItemGenerationTemplate;
    case 'study_plan_session_weak_lo_items':
      return defaultStudyPlanWeakLOItemsTemplate;
    case 'study_plan_session_fallback_items':
      return defaultStudyPlanFallbackItemsTemplate;
    case 'study_plan_session_weak_lo_flashcards':
      return defaultStudyPlanWeakLOFlashcardsTemplate;
    case 'study_plan_session_fallback_flashcards':
      return defaultStudyPlanFallbackFlashcardsTemplate;
    default:
      return '';
  }
};

export const promptTypeRequiresExam = (type: string): boolean => getPromptTypeOption(type).requiresExam;

export const normalizePromptExamForType = (type: string, exam?: string | null): string => {
  if (!promptTypeRequiresExam(type)) {
    return '';
  }

  const trimmedExam = exam?.trim();
  if (!trimmedExam) {
    return DEFAULT_PROMPT_EXAM;
  }

  const normalizedExam = trimmedExam.toLowerCase();
  if (normalizedExam === 'step 1') {
    return 'STEP 1';
  }
  if (normalizedExam === 'step 2') {
    return 'STEP 2';
  }
  if (normalizedExam === 'step 3') {
    return 'STEP 3';
  }

  return trimmedExam;
};

export const formatPromptExam = (type: string, exam?: string | null): string => {
  if (!promptTypeRequiresExam(type)) {
    return 'Global';
  }

  return normalizePromptExamForType(type, exam);
};
