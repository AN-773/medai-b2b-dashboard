import React, { useEffect, useState } from 'react';
import { BookOpen, GitBranch, Layers, Sparkles, Target } from 'lucide-react';
import { studyPlanAuditService } from '@/services/studyPlanAuditService';
import type { GetItemLineageResponse } from '@/types/StudyPlanAuditTypes';
import { Button } from '@/components/ui';
import {
  Drawer,
  ErrorBlock,
  IdChip,
  LoadingBlock,
  StagePill,
  TenantTag,
  plural,
} from '../shared';
import { ChunkList, LineageNode, LineageTree, toChunkView } from '../lineage';
import { RunError, RunFacts, RunHeadline } from '../runs';

type Props = {
  itemIdentifier: string | null;
  onClose: () => void;
  onOpenLo: (identifier: string) => void;
};

const ItemLineagePanel: React.FC<Props> = ({
  itemIdentifier,
  onClose,
  onOpenLo,
}) => {
  const [data, setData] = useState<GetItemLineageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!itemIdentifier) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await studyPlanAuditService.getItemLineage(itemIdentifier);
      setData(resp);
    } catch (err: any) {
      setError(err?.message || 'Failed to load item lineage.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (itemIdentifier) {
      setData(null);
      load();
    } else {
      // Closed: drop the old record so reopening never flashes (or focuses) stale content.
      setData(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdentifier]);

  return (
    <Drawer
      open={!!itemIdentifier}
      onClose={onClose}
      title={
        loading
          ? 'Loading lineage…'
          : data
            ? `Item ${data.item.identifier}`
            : 'Item lineage'
      }
      subtitle={
        data
          ? `Type ${data.item.type} · plan ${data.study_plan_id}`
          : (itemIdentifier ?? undefined)
      }
    >
      {loading && <LoadingBlock label="Tracing item lineage…" />}
      {error && <ErrorBlock error={error} onRetry={load} />}
      {data && !loading && !error && (
        <LineageTree label="Item lineage: item, objective, producing run, source chunks">
          {/* Item → objective → run → chunks */}
          <LineageNode
            icon={BookOpen}
            relation="Item"
            title={<code className="font-mono">{data.item.identifier}</code>}
            current
            meta={
              <>
                <StagePill value={data.item.type} />
                <IdChip value={data.item.id} label="ID" />
                <TenantTag tenantId={data.tenant_id} />
                <IdChip value={data.study_plan_id} label="Plan" />
              </>
            }
          >
            {data.item.stem_or_question_or_front ? (
              <p className="whitespace-pre-line rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-800">
                {data.item.stem_or_question_or_front}
              </p>
            ) : (
              <p className="text-[13px] text-stone-400">No stem recorded.</p>
            )}
          </LineageNode>

          <LineageNode
            icon={Target}
            relation="Generated for objective"
            title={data.learning_objective.title || 'Untitled objective'}
            meta={
              <>
                <code className="font-mono text-stone-600">
                  {data.learning_objective.identifier}
                </code>
                <IdChip value={data.learning_objective.id} label="ID" />
                <TenantTag tenantId={data.learning_objective.tenant_id} />
              </>
            }
            action={
              <Button
                size="sm"
                variant="secondary"
                icon={GitBranch}
                onClick={() => onOpenLo(data.learning_objective.identifier)}
              >
                Objective lineage
              </Button>
            }
          />

          <LineageNode
            icon={Sparkles}
            relation="Produced by run"
            title={<RunHeadline run={data.generation_run} />}
          >
            <div className="space-y-4 rounded-lg border border-stone-200 p-4">
              <RunError run={data.generation_run} />
              <RunFacts run={data.generation_run} />
            </div>
          </LineageNode>

          <LineageNode
            icon={Layers}
            relation="Grounded on"
            title={plural(data.chunks.length, 'source chunk')}
            meta="Resolved from the run's chunk_ids"
            last
          >
            {data.chunks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-200 px-4 py-3 text-[13px] text-stone-500">
                No chunks attached. This is expected when the run's chunk source is{' '}
                <code className="font-mono">internal_reused</code> or{' '}
                <code className="font-mono">internal_generated</code>.
              </p>
            ) : (
              <ChunkList chunks={data.chunks.map(toChunkView)} />
            )}
          </LineageNode>
        </LineageTree>
      )}
    </Drawer>
  );
};

export default ItemLineagePanel;
