import React, { useMemo } from 'react';

interface MarkdownContentProps {
  content: string;
  className?: string;
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
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
          >
            {renderInlineNodes(node.children, key)}
          </a>
        );
      default:
        return null;
    }
  });

const headingClassName = (level: HeadingLevel) => {
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

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className }) => {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  if (blocks.length === 0) return null;

  return (
    <div className={joinClassNames('space-y-3 text-xs leading-relaxed text-slate-600', className)}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <h4 key={index} className={headingClassName(block.level)}>
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

export default MarkdownContent;
