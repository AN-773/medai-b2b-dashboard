import type { ModuleGenerationStage } from '@/types/ModuleGenerationTypes';

export const STAGE_ORDER: ModuleGenerationStage[] = ['analyzing', 'drafting_items', 'planning'];

export const STAGE_LABELS: Record<ModuleGenerationStage, string> = {
  analyzing: 'Analyzing files',
  drafting_items: 'Drafting missing items',
  planning: 'Planning modules and sessions',
};

export const STAGE_DESCRIPTIONS: Record<ModuleGenerationStage, string> = {
  analyzing: 'Reading your files, objectives and existing items.',
  drafting_items: 'Writing items for objectives that have none.',
  planning: 'Grouping objectives into modules and ordering sessions.',
};

/** `file_analyst#2` → `File analyst 2`. */
export const agentLabel = (agent: string) => {
  const [role, index] = agent.split('#');
  const names: Record<string, string> = {
    orchestrator: 'Planner',
    file_analyst: 'File analyst',
    item_author: 'Item author',
    session_designer: 'Session designer',
  };
  const name = names[role] ?? role.replace(/_/g, ' ');
  return index ? `${name} ${index}` : name;
};
