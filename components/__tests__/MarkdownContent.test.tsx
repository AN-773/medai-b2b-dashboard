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

  it('shows markup as text, and drops a script link to its words', () => {
    const { container } = render(
      <MarkdownContent content={'<img src=x onerror=alert(1)> and [click](javascript:alert(1))'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
