import React, { useState } from 'react';
import { FileText, GitBranch, Layers, type LucideIcon } from 'lucide-react';
import type { UploadRef } from '@/types/StudyPlanAuditTypes';
import { Button, cn } from '@/components/ui';
import { IdChip, StagePill, plural } from './shared';

// ---------- Lineage tree (vertical rail) ----------

export const LineageTree: React.FC<{ children: React.ReactNode; label: string }> = ({
  children,
  label,
}) => (
  <ol aria-label={label} className="relative">
    {children}
  </ol>
);

/** One hop in a lineage chain: icon on a rail, relation, title, then details. */
export const LineageNode: React.FC<{
  icon: LucideIcon;
  /** How this node relates to the previous one, e.g. "Generated for". */
  relation: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  /** The record the drawer is about. */
  current?: boolean;
  last?: boolean;
  children?: React.ReactNode;
}> = ({ icon: Icon, relation, title, meta, action, current = false, last = false, children }) => (
  <li className="relative pl-11">
    {!last && (
      <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-9 w-px bg-stone-200" />
    )}
    <span
      aria-hidden="true"
      className={cn(
        'absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-lg border',
        current
          ? 'border-stone-900 bg-stone-900 text-white'
          : 'border-stone-200 bg-white text-stone-500',
      )}
    >
      <Icon size={15} />
    </span>
    <div className={cn(!last && 'pb-8')}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-stone-500">{relation}</p>
          <div role="heading" aria-level={3} className="break-words text-sm font-semibold text-stone-900">
            {title}
          </div>
          {meta && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
              {meta}
            </div>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  </li>
);

// ---------- Chunks ----------

export interface ChunkView {
  id: string;
  chunk_index: number;
  source_file: string;
  heading: string;
  token_count: number;
  snippet: string;
  run_id?: string;
  upload?: UploadRef;
}

type ChunkSourceShape = Omit<ChunkView, 'snippet'> & {
  snippet?: string;
  content_snippet?: string;
};

export const toChunkView = (chunk: ChunkSourceShape): ChunkView => ({
  id: chunk.id,
  chunk_index: chunk.chunk_index,
  source_file: chunk.source_file,
  heading: chunk.heading,
  token_count: chunk.token_count,
  snippet: chunk.snippet ?? chunk.content_snippet ?? '',
  run_id: chunk.run_id,
  upload: chunk.upload,
});

const LONG_SNIPPET = 240;

const ChunkRow: React.FC<{ chunk: ChunkView; showSourceFile: boolean }> = ({
  chunk,
  showSourceFile,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = chunk.snippet.length > LONG_SNIPPET;
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500">
        <span className="inline-flex items-center gap-1 font-mono text-stone-700">
          <Layers size={12} className="text-stone-400" aria-hidden="true" />#{chunk.chunk_index}
        </span>
        {showSourceFile && chunk.source_file && (
          <code className="min-w-0 max-w-[20rem] truncate font-mono" title={chunk.source_file}>
            {chunk.source_file}
          </code>
        )}
        <span className="tabular-nums">{plural(chunk.token_count, 'token')}</span>
        <span className="ml-auto">
          <IdChip value={chunk.id} label="Chunk" />
        </span>
      </div>
      {chunk.heading && (
        <p className="mt-1.5 text-[13px] font-medium text-stone-900">{chunk.heading}</p>
      )}
      {chunk.snippet && (
        <p
          className={cn(
            'mt-0.5 whitespace-pre-line break-words text-[13px] leading-5 text-stone-600',
            !expanded && 'line-clamp-3',
          )}
        >
          {chunk.snippet}
        </p>
      )}
      {isLong && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 rounded text-xs font-medium text-stone-600 transition hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      {(chunk.upload || chunk.run_id) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
          {chunk.upload && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <FileText size={12} className="flex-shrink-0 text-stone-400" aria-hidden="true" />
              <span className="max-w-[16rem] truncate" title={chunk.upload.file_name}>
                {chunk.upload.file_name}
              </span>
              <IdChip value={chunk.upload.id} label="Upload" />
            </span>
          )}
          {chunk.run_id && <IdChip value={chunk.run_id} label="Run" />}
        </div>
      )}
    </li>
  );
};

/** Source chunks as divided rows in one frame. */
export const ChunkList: React.FC<{
  chunks: ChunkView[];
  /** Hide the per-row file name when the list is already grouped by file. */
  showSourceFile?: boolean;
  className?: string;
}> = ({ chunks, showSourceFile = true, className }) => (
  <ul
    className={cn(
      'divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white',
      className,
    )}
  >
    {chunks.map((chunk) => (
      <ChunkRow key={chunk.id} chunk={chunk} showSourceFile={showSourceFile} />
    ))}
  </ul>
);

// ---------- Items ----------

export interface ItemView {
  id: string;
  identifier: string;
  type: string;
  stem_or_question_or_front: string;
  run_id?: string;
}

/** Generated items with a jump into each item's lineage. */
export const ItemList: React.FC<{
  items: ItemView[];
  onOpenItem: (identifier: string) => void;
  className?: string;
}> = ({ items, onOpenItem, className }) => (
  <ul
    className={cn(
      'divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white',
      className,
    )}
  >
    {items.map((item) => (
      <li key={item.id} className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] leading-5 text-stone-800">
            {item.stem_or_question_or_front || <span className="text-stone-400">No stem</span>}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500">
            <StagePill value={item.type || '—'} />
            <code className="font-mono text-stone-600">{item.identifier}</code>
            <IdChip value={item.id} label="ID" />
            {item.run_id && <IdChip value={item.run_id} label="Run" />}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={GitBranch}
          onClick={() => onOpenItem(item.identifier)}
          aria-label={`Open lineage for item ${item.identifier}`}
        >
          Lineage
        </Button>
      </li>
    ))}
  </ul>
);
