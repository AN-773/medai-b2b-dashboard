// Reading a SKILL.md (the open Agent Skills format) into the tutor-skill
// editor's fields, for "Import SKILL.md". Only the three fields a tutor skill
// has — `name`, `description` and `metadata.modes` (space-separated) — read
// leniently: agent-v2 judges every save and every check with the tutor's own
// reader, and its sentences are what the editor shows.

export interface ParsedSkillFile {
  name: string;
  description: string;
  modes: string[];
  body: string;
}

/** A YAML scalar as the format writes it: bare, "double-quoted" or 'single-quoted'. */
const unquote = (value: string): string => {
  const text = value.trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    try {
      return JSON.parse(text) as string;
    } catch {
      return text.slice(1, -1);
    }
  }
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replaceAll("''", "'");
  }
  return text;
};

/** null when the text does not open with frontmatter between two `---` lines. */
export const parseSkillFile = (source: string): ParsedSkillFile | null => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  if (lines[0] !== '---') return null;
  const closing = lines.indexOf('---', 1);
  if (closing === -1) return null;

  const fields: ParsedSkillFile = { name: '', description: '', modes: [], body: '' };
  let inMetadata = false;
  for (const line of lines.slice(1, closing)) {
    const top = /^([a-z]+):\s*(.*)$/.exec(line);
    if (top) {
      inMetadata = top[1] === 'metadata' && top[2].trim() === '';
      if (top[1] === 'name') fields.name = unquote(top[2]);
      if (top[1] === 'description') fields.description = unquote(top[2]);
      continue;
    }
    const nested = /^\s+modes:\s*(.*)$/.exec(line);
    if (inMetadata && nested) fields.modes = unquote(nested[1]).split(/\s+/).filter(Boolean);
  }

  fields.body = lines
    .slice(closing + 1)
    .join('\n')
    .replace(/^(?:[ \t]*\n)+/, '')
    .trimEnd();
  return fields;
};
