import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn, IconButton } from '@/components/ui';
import type { ItemSuggestionType } from '@/types/CourseAITypes';
import {
  ITEM_TYPE_META,
  PLAN_MAX_PER_TYPE,
  VISIBLE_ITEM_TYPES,
  type ItemPlan,
} from './contentConfig';

interface PlanEditorProps {
  plan: ItemPlan;
  adjustPlan: (type: ItemSuggestionType, delta: number) => void;
  /** `inline`: compact steppers in a row. `stacked`: one labelled row per type. */
  layout?: 'inline' | 'stacked';
  /** Accessible name for the group, e.g. "Drafts per objective". */
  label?: string;
}

const Stepper: React.FC<{
  type: ItemSuggestionType;
  value: number;
  adjustPlan: PlanEditorProps['adjustPlan'];
}> = ({ type, value, adjustPlan }) => {
  const name = ITEM_TYPE_META[type].label.toLowerCase();
  return (
    <div className="inline-flex h-8 items-center rounded-lg border border-stone-200 bg-white px-0.5 shadow-card">
      <IconButton
        icon={Minus}
        label={`Fewer ${name} drafts`}
        size="sm"
        disabled={value <= 0}
        onClick={() => adjustPlan(type, -1)}
      />
      <span
        aria-live="polite"
        className={cn(
          'w-6 text-center text-[13px] font-medium tabular-nums',
          value > 0 ? 'text-stone-900' : 'text-stone-400',
        )}
      >
        {value}
      </span>
      <IconButton
        icon={Plus}
        label={`More ${name} drafts`}
        size="sm"
        disabled={value >= PLAN_MAX_PER_TYPE}
        onClick={() => adjustPlan(type, 1)}
      />
    </div>
  );
};

/** Per-type draft counts: label, then a − value + stepper. */
const PlanEditor: React.FC<PlanEditorProps> = ({
  plan,
  adjustPlan,
  layout = 'inline',
  label = 'Drafts to generate',
}) => {
  if (layout === 'stacked') {
    return (
      <div
        role="group"
        aria-label={label}
        className="divide-y divide-stone-100 rounded-xl border border-stone-200"
      >
        {VISIBLE_ITEM_TYPES.map((type) => (
          <div key={type} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <p className="min-w-0 text-sm text-stone-800">{ITEM_TYPE_META[type].label}</p>
            <Stepper type={type} value={plan[type]} adjustPlan={adjustPlan} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {VISIBLE_ITEM_TYPES.map((type) => (
        <div key={type} className="inline-flex items-center gap-2">
          <span className="text-[13px] text-stone-700">{ITEM_TYPE_META[type].short}</span>
          <Stepper type={type} value={plan[type]} adjustPlan={adjustPlan} />
        </div>
      ))}
    </div>
  );
};

export default PlanEditor;
