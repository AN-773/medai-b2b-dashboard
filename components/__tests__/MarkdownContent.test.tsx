// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import MarkdownContent from '../MarkdownContent';

afterEach(cleanup);

describe('MarkdownContent', () => {
  it('renders a pipe table as a table', () => {
    render(
      <MarkdownContent
        content={['Before', '', '| Topic | % correct |', '|---|:--:|', '| Renal | **41** |', '| a \\| b | 60 |', '', 'After'].join('\n')}
      />,
    );

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Topic', '% correct']);
    expect(within(table).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Renal', '41', 'a | b', '60']);
    expect(screen.getByText('After')).toBeTruthy();
  });

  it('leaves a line with a pipe alone when no delimiter row follows', () => {
    render(<MarkdownContent content={'a | b\nc | d'} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('a | b c | d')).toBeTruthy();
  });

  describe('where a link goes', () => {
    const reading = (href: string) => {
      const { container } = render(<MarkdownContent variant="reading" content={`See [your report](${href}).`} />);
      return container.textContent;
    };

    it('shows the real host beside the words', () => {
      expect(reading('https://evil.example/collect?data=Sara')).toBe('See your report(evil.example).');
    });

    it.each([
      ['credentials in the URL', 'https://university.edu@evil.example/x'],
      ['no scheme', '//evil.example/x'],
      ['backslashes', '\\\\evil.example/x'],
    ])('is not fooled by %s', (_name, href) => {
      expect(reading(href)).toBe('See your report(evil.example).');
    });

    it('shows the address of a mail link, not what it would send', () => {
      expect(reading('mailto:someone@evil.example?body=Sara')).toBe('See your report(someone@evil.example).');
    });

    it('says nothing for a link that stays on this site', () => {
      expect(reading('/faculty')).toBe('See your report.');
    });

    it('stays out of the compact previews', () => {
      const { container } = render(<MarkdownContent content="[your report](https://example.test/x)" />);
      expect(container.textContent).toBe('your report');
    });
  });

  it('shows markup as text, and drops a script link to its words', () => {
    const { container } = render(
      <MarkdownContent content={'<img src=x onerror=alert(1)> and [click](javascript:alert(1))'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
