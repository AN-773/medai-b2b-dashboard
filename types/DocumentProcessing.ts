/** Shared, additive agent / Tests / library wire contract. */
export interface DocumentProcessing {
  runId: string;
  sequence: number;
  availability: 'unavailable' | 'text_ready';
  state: 'queued' | 'running' | 'retrying' | 'completed' |
    'completed_with_warnings' | 'failed' | 'cancelled';
  stage: 'queued' | 'extracting_text' | 'indexing_text' | 'ocr' |
    'extracting_structure' | 'extracting_images' | 'indexing_enrichment' | 'completed';
  completedUnits: number;
  totalUnits: number | null;
  unit: 'pages' | 'batches' | 'figures' | null;
  updatedAt: string;
  lastProgressAt: string | null;
  heartbeatAt: string | null;
  nextRetryAt: string | null;
  capabilities: { text: boolean; structure: boolean; images: boolean; ocr: boolean };
  warnings: string[];
  error: { code: string; message: string; retryable: boolean } | null;
}

export type CourseResourceProcessingAction = 'retry' | 'cancel';
