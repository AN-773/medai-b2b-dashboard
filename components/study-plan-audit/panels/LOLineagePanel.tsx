import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, FileText, Target } from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type {
  GetLearningObjectiveLineageResponse,
  LOLineageChunk,
} from '@/types/StudyPlanAuditTypes';
import {
  Drawer,
  ErrorBlock,
  IdChip,
  KV,
  KVGrid,
  LoadingBlock,
  TenantTag,
  plural,
} from '../shared';
import { ChunkList, ItemList, LineageNode, LineageTree, toChunkView } from '../lineage';

type Props = {
  loIdentifier: string | null;
  onClose: () => void;
  onOpenItem: (identifier: string) => void;
};

interface UploadGroup {
  key: string;
  fileName: string | null;
  uploadId: string | null;
  chunks: LOLineageChunk[];
}

/** Upstream chunks grouped by the upload they came from, in first-seen order. */
const groupByUpload = (chunks: LOLineageChunk[]): UploadGroup[] => {
  const groups = new Map<string, UploadGroup>();
  chunks.forEach((chunk) => {
    const key = chunk.upload?.id ?? '__none__';
    const group = groups.get(key) ?? {
      key,
      fileName: chunk.upload?.file_name ?? null,
      uploadId: chunk.upload?.id ?? null,
      chunks: [],
    };
    group.chunks.push(chunk);
    groups.set(key, group);
  });
  return Array.from(groups.values());
};

const LOLineagePanel: React.FC<Props> = ({
  loIdentifier,
  onClose,
  onOpenItem,
}) => {
  const [data, setData] =
    useState<GetLearningObjectiveLineageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!loIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const resp =
        await studyPlanAuditService.getLearningObjectiveLineage(loIdentifier);
      setData(resp);
    } catch (err: any) {
      setError(err?.message || 'Failed to load LO lineage.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loIdentifier) {
      setData(null);
      load();
    } else {
      // Closed: drop the old record so reopening never flashes (or focuses) stale content.
      setData(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loIdentifier]);

  const uploadGroups = useMemo(() => groupByUpload(data?.chunks ?? []), [data]);
  const uploadCount = uploadGroups.filter((group) => group.uploadId).length;
  const upstreamTitle =
    uploadCount > 0
      ? `${plural(data?.chunks.length ?? 0, 'source chunk')} from ${plural(uploadCount, 'upload')}`
      : plural(data?.chunks.length ?? 0, 'source chunk');

  return (
    <Drawer
      open={!!loIdentifier}
      onClose={onClose}
      title={
        loading
          ? 'Loading objective lineage…'
          : data
            ? data.learning_objective.title || data.learning_objective.identifier
            : 'Objective lineage'
      }
      subtitle={
        data
          ? `${data.learning_objective.identifier} · ${data.learning_objective.exam}`
          : (loIdentifier ?? undefined)
      }
    >
      {loading && <LoadingBlock label="Tracing objective lineage…" />}
      {error && <ErrorBlock error={error} onRetry={load} />}
      {data && !loading && !error && (
        <LineageTree label="Objective lineage: upstream chunks, objective, derived items">
          {/* Upstream: upload → chunks */}
          <LineageNode
            icon={FileText}
            relation="Upstream sources"
            title={upstreamTitle}
            meta="Every upstream chunk across uploads, deduplicated by chunk ID"
          >
            {data.chunks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-200 px-4 py-3 text-[13px] text-stone-500">
                No source chunks recorded for this objective.
              </p>
            ) : (
              <div className="space-y-4">
                {uploadGroups.map((group) => (
                  <div key={group.key}>
                    <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500">
                      <FileText size={13} className="text-stone-400" aria-hidden="true" />
                      <span
                        className="max-w-[22rem] truncate text-[13px] font-medium text-stone-800"
                        title={group.fileName ?? undefined}
                      >
                        {group.fileName ?? 'No upload linked'}
                      </span>
                      {group.uploadId && <IdChip value={group.uploadId} label="Upload" />}
                      <span className="tabular-nums">{plural(group.chunks.length, 'chunk')}</span>
                    </div>
                    <ChunkList
                      chunks={group.chunks.map((chunk) =>
                        // The group header already names the upload.
                        toChunkView({ ...chunk, upload: undefined }),
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
          </LineageNode>

          {/* The objective itself */}
          <LineageNode
            icon={Target}
            relation="Learning objective"
            title={data.learning_objective.title || 'Untitled objective'}
            current
          >
            <div className="rounded-lg border border-stone-200 p-4">
              <KVGrid cols={3}>
                <KV label="Identifier" mono>
                  {data.learning_objective.identifier}
                </KV>
                <KV label="Exam" mono>
                  {data.learning_objective.exam || '—'}
                </KV>
                <KV label="Source" mono>
                  {data.learning_objective.source || '—'}
                </KV>
                <KV label="Tenant">
                  <TenantTag tenantId={data.tenant_id} />
                </KV>
                <KV label="Objective">
                  <IdChip value={data.learning_objective.id} label="ID" />
                </KV>
                <KV label="Study plan">
                  {data.study_plan_id ? (
                    <IdChip value={data.study_plan_id} label="ID" />
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </KV>
              </KVGrid>
            </div>
          </LineageNode>

          {/* Downstream items */}
          <LineageNode
            icon={BookOpen}
            relation="Downstream"
            title={`${plural(data.items.length, 'derived item')}`}
            meta="Every downstream item, deduplicated by item ID"
            last
          >
            {data.items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-200 px-4 py-3 text-[13px] text-stone-500">
                No items have been derived from this objective yet.
              </p>
            ) : (
              <ItemList items={data.items} onOpenItem={onOpenItem} />
            )}
          </LineageNode>
        </LineageTree>
      )}
    </Drawer>
  );
};

export default LOLineagePanel;
