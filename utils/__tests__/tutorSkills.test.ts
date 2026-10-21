import { describe, expect, it } from 'vitest';
import { diffCounts, lineDiff } from '../lineDiff';
import { parseSkillFile } from '../skillFile';
import { skillProblemOf } from '../../services/tutorSkillsService';

describe('lineDiff', () => {
  it('marks the lines each side holds alone, with their numbers', () => {
    const lines = lineDiff('one\ntwo\nthree', 'one\n2\nthree\nfour');

    expect(lines).toEqual([
      { kind: 'same', text: 'one', before: 1, after: 1 },
      { kind: 'removed', text: 'two', before: 2, after: null },
      { kind: 'added', text: '2', before: null, after: 2 },
      { kind: 'same', text: 'three', before: 3, after: 3 },
      { kind: 'added', text: 'four', before: null, after: 4 },
    ]);
    expect(diffCounts(lines)).toEqual({ added: 2, removed: 1 });
  });

  it('finds nothing to change in identical texts', () => {
    expect(diffCounts(lineDiff('a\nb', 'a\nb'))).toEqual({ added: 0, removed: 0 });
  });
});

describe('parseSkillFile', () => {
  it('reads the three fields and the body of a SKILL.md as agent-v2 exports it', () => {
    const parsed = parseSkillFile(
      [
        '---',
        'name: osce-station-practice',
        'description: "Use when: a student asks to practise"',
        'metadata:',
        '  modes: study clinical',
        '---',
        '',
        '# OSCE practice',
        '',
        'Play the patient.',
        '',
      ].join('\r\n'),
    );

    expect(parsed).toEqual({
      name: 'osce-station-practice',
      description: 'Use when: a student asks to practise',
      modes: ['study', 'clinical'],
      body: '# OSCE practice\n\nPlay the patient.',
    });
  });

  it('refuses text that does not open with frontmatter', () => {
    expect(parseSkillFile('# Just markdown')).toBeNull();
    expect(parseSkillFile('---\nname: x\n')).toBeNull();
  });
});

describe('skillProblemOf', () => {
  it("reads agent-v2's refusal off the request error, and nothing else", () => {
    const error = Object.assign(new Error('x'), {
      status: 409,
      data: { error: { code: 'skill_version_conflict', message: 'Version 3 was saved…', latestNumber: 3 } },
    });

    expect(skillProblemOf(error)).toMatchObject({ code: 'skill_version_conflict', latestNumber: 3 });
    expect(skillProblemOf(new Error('network'))).toBeNull();
    expect(skillProblemOf(Object.assign(new Error('x'), { data: { error: 'plain string' } }))).toBeNull();
  });
});
