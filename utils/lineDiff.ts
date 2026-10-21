// A line diff of two texts, for comparing two versions of a tutor skill.
// Longest common subsequence over lines: a skill's body is at most 20 000
// characters, a few hundred lines, so the table stays small.

export type DiffLineKind = 'same' | 'removed' | 'added';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  /** Line number in the older text, or null for an added line. */
  before: number | null;
  /** Line number in the newer text, or null for a removed line. */
  after: number | null;
}

export const lineDiff = (before: string, after: string): DiffLine[] => {
  const a = before.split('\n');
  const b = after.split('\n');
  const cols = b.length + 1;

  // lcs[i * cols + j]: the longest common run of a[i..] and b[j..].
  const lcs = new Uint32Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i * cols + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * cols + j + 1] + 1
          : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ kind: 'same', text: a[i], before: i + 1, after: j + 1 });
      i += 1;
      j += 1;
    } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + j + 1]) {
      lines.push({ kind: 'removed', text: a[i], before: i + 1, after: null });
      i += 1;
    } else {
      lines.push({ kind: 'added', text: b[j], before: null, after: j + 1 });
      j += 1;
    }
  }
  for (; i < a.length; i += 1) lines.push({ kind: 'removed', text: a[i], before: i + 1, after: null });
  for (; j < b.length; j += 1) lines.push({ kind: 'added', text: b[j], before: null, after: j + 1 });
  return lines;
};

export const diffCounts = (lines: DiffLine[]) => ({
  added: lines.filter((line) => line.kind === 'added').length,
  removed: lines.filter((line) => line.kind === 'removed').length,
});
