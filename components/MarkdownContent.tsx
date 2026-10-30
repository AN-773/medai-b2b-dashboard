import React, { useContext, useMemo } from 'react';

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** `compact` for previews inside a card, `reading` when the text is what the page is for. */
  variant?: 'compact' | 'reading';
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong' | 'em' | 'strike'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] };

type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: HeadingLevel; children: InlineNode[] }
  | { type: 'blockquote'; children: InlineNode[] }
  | { type: 'ul' | 'ol'; items: InlineNode[][] }
  | { type: 'table'; header: InlineNode[][]; rows: InlineNode[][][] }
  | { type: 'code'; code: string; language?: string }
  | { type: 'hr' };

const INLINE_PATTERN =
  /(?:\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_)/g;

const joinClassNames = (...classes: Array<string | undefined>) =>
  classes.filter(Boolean).join(' ');

const isSafeHref = (href: string) => {
  try {
    const url = new URL(href, 'https://markdown.local');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
};

/** On for text a model wrote: words in a link can say anything, so the link also says where it goes. */
const ShowLinkHost = React.createContext(false);

/** Where a link goes, as the browser will read it. `null` for one that stays on this site. */
const linkHost = (href: string): string | null => {
  const url = new URL(href, window.location.href);
  if (url.protocol === 'mailto:') return url.pathname;
  return url.host === window.location.host ? null : url.hostname;
};

const LinkHost: React.FC<{ href: string }> = ({ href }) => {
  const host = useContext(ShowLinkHost) ? linkHost(href) : null;
  return host ? (
    <span dir="ltr" className="ml-1 text-xs text-stone-500">
      ({host})
    </span>
  ) : null;
};

const TABLE_DELIMITER = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

/** `| a | b |` as cells. A `\\|` stays in its cell. Scanned, not a lookbehind: old Safari cannot parse one. */
const tableCells = (line: string): string[] => {
  const body = line.trim().replace(/^\|/, '');
  const cells: string[] = [];
  let cell = '';
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === '\\' && body[index + 1] === '|') {
      cell += '|';
      index += 1;
    } else if (body[index] === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += body[index];
    }
  }
  if (cell.trim()) cells.push(cell.trim());
  return cells;
};

const isTableStart = (line: string, next: string | undefined) =>
  line.includes('|') && next !== undefined && next.includes('|') && TABLE_DELIMITER.test(next.trim());

const parseInline = (text: string): InlineNode[] => {
  const nodes: InlineNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push({ type: 'text', value: text.slice(cursor, index) });
    }

    if (match[1] && match[2]) {
      nodes.push({
        type: 'link',
        href: match[2],
        children: parseInline(match[1]),
      });
    } else if (match[3]) {
      nodes.push({ type: 'code', value: match[3] });
    } else if (match[4] || match[5]) {
      nodes.push({
        type: 'strong',
        children: parseInline(match[4] || match[5]),
      });
    } else if (match[6]) {
      nodes.push({
        type: 'strike',
        children: parseInline(match[6]),
      });
    } else if (match[7] || match[8]) {
      nodes.push({
        type: 'em',
        children: parseInline(match[7] || match[8]),
      });
    }

    cursor = index + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push({ type: 'text', value: text.slice(cursor) });
  }

  return nodes;
};

const parseBlocks = (content: string): BlockNode[] => {
  const blocks: BlockNode[] = [];
  const lines = content.replace(/\r\n/g, '\n').trim().split('\n');
  const paragraphLines: string[] = [];

  const flushParagraph = () => {
    const paragraph = paragraphLines.join(' ').trim();
    if (paragraph) {
      blocks.push({ type: 'paragraph', children: parseInline(paragraph) });
    }
    paragraphLines.length = 0;
  };

  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    const codeFence = trimmed.match(/^```([\w-]+)?\s*$/);
    if (codeFence) {
      flushParagraph();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: 'code',
        code: codeLines.join('\n'),
        language: codeFence[1],
      });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as HeadingLevel,
        children: parseInline(headingMatch[2].trim()),
      });
      index += 1;
      continue;
    }

    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({
        type: 'blockquote',
        children: parseInline(quoteLines.join(' ').trim()),
      });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      flushParagraph();
      const items: InlineNode[][] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(parseInline(lines[index].trim().replace(/^[-*+]\s+/, '')));
        index += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (isTableStart(trimmed, lines[index + 1])) {
      flushParagraph();
      const header = tableCells(trimmed).map(parseInline);
      index += 2;
      const rows: InlineNode[][][] = [];
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(tableCells(lines[index]).map(parseInline));
        index += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      const items: InlineNode[][] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(parseInline(lines[index].trim().replace(/^\d+\.\s+/, '')));
        index += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    paragraphLines.push(trimmed);
    index += 1;
  }

  flushParagraph();
  return blocks;
};

const renderInlineNodes = (nodes: InlineNode[], keyPrefix: string): React.ReactNode[] =>
  nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case 'text':
        return <React.Fragment key={key}>{node.value}</React.Fragment>;
      case 'code':
        return (
          <code
            key={key}
            className="rounded bg-slate-200/80 px-1 py-0.5 font-mono text-[11px] text-slate-700"
          >
            {node.value}
          </code>
        );
      case 'strong':
        return (
          <strong key={key} className="font-semibold text-slate-900">
            {renderInlineNodes(node.children, key)}
          </strong>
        );
      case 'em':
        return (
          <em key={key} className="italic text-slate-700">
            {renderInlineNodes(node.children, key)}
          </em>
        );
      case 'strike':
        return (
          <span key={key} className="line-through opacity-70">
            {renderInlineNodes(node.children, key)}
          </span>
        );
      case 'link':
        if (!isSafeHref(node.href)) {
          return <React.Fragment key={key}>{renderInlineNodes(node.children, key)}</React.Fragment>;
        }
        return (
          <React.Fragment key={key}>
            <a
              href={node.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
            >
              {renderInlineNodes(node.children, key)}
            </a>
            <LinkHost href={node.href} />
          </React.Fragment>
        );
      default:
        return null;
    }
  });

const ROOT_CLASS_NAMES = {
  compact: 'space-y-3 text-xs leading-relaxed text-slate-600',
  reading: 'space-y-3 text-sm leading-6 text-stone-700',
};

const headingClassName = (level: HeadingLevel, variant: 'compact' | 'reading') => {
  if (variant === 'reading') {
    return level <= 2 ? 'text-[15px] font-semibold text-stone-900' : 'text-sm font-semibold text-stone-900';
  }
  switch (level) {
    case 1:
      return 'text-sm font-bold text-slate-900';
    case 2:
      return 'text-sm font-semibold text-slate-900';
    case 3:
      return 'text-xs font-bold uppercase tracking-[0.08em] text-slate-700';
    default:
      return 'text-xs font-semibold text-slate-800';
  }
};

const MarkdownBlocks: React.FC<MarkdownContentProps> = ({ content, className, variant = 'compact' }) => {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  if (blocks.length === 0) return null;

  return (
    <div className={joinClassNames(ROOT_CLASS_NAMES[variant], className)}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <h4 key={index} className={headingClassName(block.level, variant)}>
                {renderInlineNodes(block.children, `heading-${index}`)}
              </h4>
            );
          case 'paragraph':
            return (
              <p key={index}>
                {renderInlineNodes(block.children, `paragraph-${index}`)}
              </p>
            );
          case 'blockquote':
            return (
              <blockquote
                key={index}
                className="border-l-2 border-slate-200 pl-3 italic text-slate-600"
              >
                {renderInlineNodes(block.children, `blockquote-${index}`)}
              </blockquote>
            );
          case 'ul':
            return (
              <ul key={index} className="ml-5 list-disc space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInlineNodes(item, `ul-${index}-${itemIndex}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={index} className="ml-5 list-decimal space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInlineNodes(item, `ol-${index}-${itemIndex}`)}</li>
                ))}
              </ol>
            );
          case 'table':
            return (
              <div key={index} className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex} scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-slate-600">
                          {renderInlineNodes(cell, `th-${index}-${cellIndex}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 align-top">
                            {renderInlineNodes(cell, `td-${index}-${rowIndex}-${cellIndex}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'code':
            return (
              <div
                key={index}
                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900"
              >
                {block.language && (
                  <div className="border-b border-slate-700 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
                    {block.language}
                  </div>
                )}
                <pre className="overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-slate-100">
                  <code>{block.code}</code>
                </pre>
              </div>
            );
          case 'hr':
            return <hr key={index} className="border-slate-200" />;
          default:
            return null;
        }
      })}
    </div>
  );
};

const MarkdownContent: React.FC<MarkdownContentProps> = (props) => (
  <ShowLinkHost.Provider value={props.variant === 'reading'}>
    <MarkdownBlocks {...props} />
  </ShowLinkHost.Provider>
);

export default MarkdownContent;
