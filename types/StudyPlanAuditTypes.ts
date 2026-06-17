export type SessionMode =
  | 'mcq'
  | 'saq'
  | 'lecture'
  | 'flashcard'
  | 'mixed'
  | string;

export type AuditRunStatus = 'started' | 'succeeded' | 'failed' | string;

export type SessionFinalStatus =
  | 'started'
  | 'succeeded'
  | 'failed'
  | 'no_items_generated'
  | string;

export type SessionSelectionStrategy =
  | 'weak_then_random_fill'
  | 'weak_then_random_chunk_fallback'
  | string;

export type SessionSelectionLOStrategy =
  | 'weak'
  | 'random_fill'
  | 'internal_reused'
  | 'fallback'
  | string;

export type ChunkSource =
  | 'linked'
  | 'similarity_fallback'
  | 'random_fallback'
  | 'internal_reused'
  | 'internal_generated'
  | string;

export interface UploadRef {
  id: string;
  study_plan_id: string | null;
  tenant_id: string | null;
  file_name: string;
  status: string;
}

export interface AuditRunBase {
  id: string;
  tenant_id: string | null;
  stage: string;
  status: AuditRunStatus;
  error_code: string | null;
  error_message?: string | null;
  prompt_type: string;
  model: string;
  input_token_count: number;
  output_token_count: number;
  latency_ms: number;
  attempt: number;
  langfuse_trace_id: string;
  langfuse_trace_url: string;
  started_at: string;
  ended_at: string | null;
}

export type UploadAuditRun = AuditRunBase;

export interface UploadAuditChunk {
  id: string;
  tenant_id: string | null;
  chunk_index: number;
  source_file: string;
  heading: string;
  token_count: number;
  content_snippet: string;
}

export interface SessionAuditSourceScope {
  enabled: boolean;
  upload_ids: string[];
  internal_source_exams: string[];
}

export interface SessionAuditSelectionLO {
  id: string;
  identifier: string;
  title: string;
  tenant_id: string | null;
  rank: number;
  strategy: SessionSelectionLOStrategy;
  accuracy: number | null;
  attempts_count: number | null;
  last_seen_at: string | null;
  scope_match_reason: string;
  notes: string;
  selected: boolean;
}

export interface SessionAuditChunk {
  id: string;
  tenant_id: string | null;
  chunk_index: number;
  source_file: string;
  heading: string;
  token_count: number;
  snippet: string;
}

export interface SessionAuditRejectionReason {
  index: number;
  reason: string;
  message?: string | null;
}

export interface SessionAuditRun extends AuditRunBase {
  langfuse_span_id: string;
  langfuse_span_url: string;
  chunk_source: ChunkSource;
  chunk_ids: string[];
  chunk_similarity_scores: number[];
  items_requested: number;
  items_returned: number;
  items_persisted: number;
  rejection_reasons: SessionAuditRejectionReason[];
}

export interface SessionAuditItem {
  id: string;
  identifier: string;
  tenant_id: string | null;
  type: string;
  stem_or_question_or_front: string;
}

export interface ItemLineageItem {
  id: string;
  identifier: string;
  tenant_id: string | null;
  type: string;
  stem_or_question_or_front: string;
}

export interface ItemLineageLearningObjective {
  id: string;
  identifier: string;
  title: string;
  tenant_id: string | null;
}

export interface ItemLineageRun extends AuditRunBase {
  langfuse_span_id: string;
  langfuse_span_url: string;
}

export interface ItemLineageChunk {
  id: string;
  tenant_id: string | null;
  chunk_index: number;
  source_file: string;
  heading: string;
  token_count: number;
  content_snippet: string;
  upload?: UploadRef;
}

export interface LOLineageChunk {
  id: string;
  tenant_id: string | null;
  chunk_index: number;
  source_file: string;
  heading: string;
  token_count: number;
  content_snippet: string;
  run_id: string;
  upload?: UploadRef;
}

export interface LOLineageItem {
  id: string;
  identifier: string;
  tenant_id: string | null;
  type: string;
  stem_or_question_or_front: string;
  run_id: string;
}

export interface StudyPlanAuditStageSummary {
  tenant_id: string | null;
  stage: string;
  total_runs: number;
  succeeded_runs: number;
  failed_runs: number;
  success_rate: number;
  failure_rate: number;
}

export interface StudyPlanListEntry {
  id: string;
  identifier: string;
  title: string;
  exam_name: string;
  status: string;
  tenant_id: string | null;
  total_runs: number;
  uploads_with_audits: number;
  learning_objectives_with_audits: number;
  items_with_audits: number;
  sessions_with_audits: number;
  last_audit_at: string | null;
}

export interface ListStudyPlanAuditsResponse {
  study_plans: StudyPlanListEntry[];
}

export interface StudyPlanAuditDetails {
  id: string;
  identifier: string;
  title: string;
  exam_name: string;
  status: string;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyPlanAuditUploadRow {
  id: string;
  identifier: string;
  tenant_id: string | null;
  file_name: string;
  status: string;
  chunk_count: number;
  learning_objectives_count: number;
  audit_runs: number;
  last_audit_at: string | null;
}

export interface StudyPlanAuditLearningObjectiveRow {
  id: string;
  identifier: string;
  title: string;
  tenant_id: string | null;
  source_upload_count: number;
  source_chunk_count: number;
  item_count: number;
  session_count: number;
  last_audit_at: string | null;
}

export interface StudyPlanAuditItemRow {
  id: string;
  identifier: string;
  tenant_id: string | null;
  type: string;
  stem_or_question_or_front: string;
  learning_objective_id: string | null;
  learning_objective_identifier: string;
  learning_objective_title: string;
  audit_runs: number;
  last_audit_at: string | null;
}

export interface StudyPlanAuditSessionRow {
  id: string;
  identifier: string;
  tenant_id: string | null;
  mode: SessionMode;
  requested_item_count: number;
  items_generated: number;
  items_persisted: number;
  status: SessionFinalStatus;
  error_code: string | null;
  error_message?: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface GetStudyPlanAuditResponse {
  study_plan_id: string;
  study_plan: StudyPlanAuditDetails;
  totals: {
    uploads: number;
    learning_objectives: number;
    items: number;
    sessions: number;
  };
  stages: StudyPlanAuditStageSummary[];
  uploads: StudyPlanAuditUploadRow[];
  learning_objectives: StudyPlanAuditLearningObjectiveRow[];
  items: StudyPlanAuditItemRow[];
  sessions: StudyPlanAuditSessionRow[];
}

export interface GetUploadAuditResponse {
  upload_id: string;
  study_plan_id: string | null;
  tenant_id: string | null;
  file_name: string;
  status: string;
  chunk_count: number;
  extraction_runs: UploadAuditRun[];
  learning_objectives: Array<{
    id: string;
    identifier: string;
    title: string;
    tenant_id: string | null;
    chunks: UploadAuditChunk[];
  }>;
  unlinked_chunks: UploadAuditChunk[];
}

export interface GetSessionAuditResponse {
  tenant_id: string | null;
  session: {
    id: string;
    study_plan_id: string;
    mode: SessionMode;
    requested_item_count: number;
    source_scope: SessionAuditSourceScope;
    langfuse_trace_id: string;
    langfuse_trace_url: string;
    langfuse_session_id: string;
    started_at: string;
    ended_at: string | null;
  };
  selection: {
    strategy: SessionSelectionStrategy;
    candidate_pool_size: number;
    los_selected_count: number;
    los: SessionAuditSelectionLO[];
  };
  los: Array<{
    id: string;
    identifier: string;
    title: string;
    tenant_id: string | null;
    chunks_used: SessionAuditChunk[];
    runs: SessionAuditRun[];
    items: SessionAuditItem[];
  }>;
  totals: {
    items_generated: number;
    items_persisted: number;
    block_id: string | null;
    status: SessionFinalStatus;
    error_code: string | null;
    error_message?: string | null;
  };
}

export interface RecordSessionScoreRequest {
  lo_id?: string;
  item_id?: string;
  value: 'good' | 'bad';
  comment?: string;
  name?: string;
}

export interface RecordSessionScoreResponse {
  id: string;
  session_id: string;
  lo_id?: string;
  item_id?: string;
  value: 'good' | 'bad';
  comment?: string;
  langfuse_trace_id: string;
  created_at: string;
}

export interface GetItemLineageResponse {
  tenant_id: string | null;
  study_plan_id: string;
  item: ItemLineageItem;
  learning_objective: ItemLineageLearningObjective;
  generation_run: ItemLineageRun;
  chunks: ItemLineageChunk[];
}

export interface GetLearningObjectiveLineageResponse {
  tenant_id: string | null;
  study_plan_id: string | null;
  learning_objective: {
    id: string;
    identifier: string;
    title: string;
    tenant_id: string | null;
    study_plan_id: string | null;
    exam: string;
    source: string;
  };
  chunks: LOLineageChunk[];
  items: LOLineageItem[];
}
