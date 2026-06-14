import type { PromptCatalogItem, PromptCatalogVariable } from '../../types';

export interface PromptTypeOption {
  value: string;
  label: string;
  description: string;
  requiresExam: boolean;
  variables: PromptCatalogVariable[];
}

export const DEFAULT_PROMPT_EXAM = 'STEP 1';

export const toPromptTypeOption = (
  item: PromptCatalogItem | null | undefined,
  fallbackType = '',
): PromptTypeOption => ({
  value: item?.type ?? fallbackType,
  label: item?.label || item?.type || fallbackType || 'Unknown Prompt',
  description: item?.description || (fallbackType ? 'Custom prompt type.' : ''),
  requiresExam: item?.requiresExam ?? false,
  variables: item?.variables ?? [],
});

export const getPromptTypeOptions = (catalogItems: PromptCatalogItem[] = []): PromptTypeOption[] =>
  catalogItems.map(item => toPromptTypeOption(item));

export const getPromptTypeOption = (
  type: string,
  catalogItems: PromptCatalogItem[] = [],
): PromptTypeOption => {
  const match = catalogItems.find(item => item.type === type);
  return toPromptTypeOption(match, type);
};

export const normalizePromptExam = (requiresExam: boolean, exam?: string | null): string => {
  if (!requiresExam) {
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

export const formatPromptExam = (requiresExam: boolean, exam?: string | null): string => {
  if (!requiresExam) {
    return 'Global';
  }

  return normalizePromptExam(true, exam);
};

export const serializePromptSchema = (value: unknown): string => {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};
