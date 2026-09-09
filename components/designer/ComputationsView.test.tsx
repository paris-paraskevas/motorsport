// @vitest-environment jsdom
//
// Application Computations: a read-only account of what the code computes and
// when; every entry it names exists in the catalogue and opens from the row.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPUTATIONS, ComputationsView } from './ComputationsView';
import { CATALOGUE } from './catalogue';

afterEach(cleanup);

describe('ComputationsView', () => {
  it('names only catalogue entries as inputs, each of them editable, and opens one from its row', () => {
    const items = CATALOGUE.flatMap(g => g.items);
    for (const c of COMPUTATIONS) {
      if (!c.from) continue;
      const item = items.find(i => i.key === c.from);
      expect(item, c.from).toBeTruthy();
      expect(item!.editor ?? item!.listKey, c.from).toBeTruthy();
    }
    const onOpen = vi.fn();
    render(<ComputationsView onOpen={onOpen} />);
    expect(screen.getByRole('heading', { name: 'Application Computations' })).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(COMPUTATIONS.length + 1);
    fireEvent.click(screen.getByRole('button', { name: /^Component Settings/ }));
    expect(onOpen).toHaveBeenCalledWith('compsettings');
  });
});
