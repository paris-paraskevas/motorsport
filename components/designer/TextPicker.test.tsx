// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextPicker } from './TextPicker';

// The text picker (P1.11; APEX: the picker icon at the right of a text
// attribute in the Property Editor): a button named for its field, a popover
// with the shortcuts by key and their text, a filter, and a Preview of the
// field as the page will render it with the hovered shortcut in place; a pick
// hands the token and the field's cursor back and closes.

const STAMP = '2026-09-08T16:00:00.505502+00:00';
const shortcuts = [
  { key: 'times.local', text: 'All times are shown in your local time zone.', updatedAt: STAMP },
  { key: 'data.sources', text: 'Results from the official timing feeds.', updatedAt: STAMP },
];
const VALUE = 'Opened in 1922. {shortcut:data.sources}';

afterEach(cleanup);

function mount(over: Partial<Parameters<typeof TextPicker>[0]> = {}) {
  const onInsert = vi.fn();
  render(
    <div>
      <textarea id="f-text" aria-label="Field" defaultValue={VALUE} />
      <TextPicker field="Text" fieldId="f-text" shortcuts={shortcuts} value={VALUE} onInsert={onInsert} {...over} />
    </div>,
  );
  return { onInsert };
}
const button = () => screen.getByRole('button', { name: 'Insert a shortcut into Text' }) as HTMLButtonElement;
const popover = () => screen.getByRole('dialog', { name: 'Shortcuts for Text' });

describe('TextPicker', () => {
  it('is a button named for its field, disabled read-only and when no shortcut exists, with the reason in its tip', () => {
    mount({ disabled: true });
    expect(button().disabled).toBe(true);
    cleanup();
    mount({ shortcuts: [] });
    expect(button().disabled).toBe(true);
    expect(button().title).toBe('None yet: add one under Shared Components › Shortcuts');
    cleanup();
    mount();
    expect(button().disabled).toBe(false);
    expect(button().title).toBe('Insert a shortcut at the cursor; the page substitutes its text');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a popover listing the shortcuts by key with their text and a Preview of the field as the page renders it; the filter narrows by key or text', () => {
    mount();
    fireEvent.click(button());
    const pop = popover();
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(within(pop).getAllByRole('option').map(o => o.textContent)).toEqual([
      'times.localAll times are shown in your local time zone.',
      'data.sourcesResults from the official timing feeds.',
    ]);
    expect(within(pop).getByLabelText('Preview').textContent).toBe('Opened in 1922. Results from the official timing feeds.');
    const filter = within(pop).getByLabelText('Filter shortcuts');
    expect(document.activeElement).toBe(filter);
    fireEvent.change(filter, { target: { value: 'ZONE' } });
    expect(within(pop).getAllByRole('option').map(o => o.textContent)).toEqual(['times.localAll times are shown in your local time zone.']);
    fireEvent.change(filter, { target: { value: 'data.' } });
    expect(within(pop).getAllByRole('option').map(o => o.textContent)).toEqual(['data.sourcesResults from the official timing feeds.']);
    fireEvent.change(filter, { target: { value: 'nothing' } });
    expect(within(pop).queryAllByRole('option')).toEqual([]);
    expect(within(pop).getByText('No shortcut matches.')).toBeTruthy();
  });

  it('reads the field’s cursor when it opens, previews the hovered shortcut in that place, and a pick hands the token and the cursor back and closes', () => {
    const { onInsert } = mount();
    const field = screen.getByLabelText('Field') as HTMLTextAreaElement;
    field.focus();
    field.setSelectionRange(7, 10);
    fireEvent.click(button());
    const pop = popover();
    fireEvent.mouseEnter(within(pop).getByRole('option', { name: /times\.local/ }));
    expect(within(pop).getByLabelText('Preview').textContent).toBe('Opened All times are shown in your local time zone.1922. Results from the official timing feeds.');
    fireEvent.mouseLeave(within(pop).getByRole('option', { name: /times\.local/ }));
    expect(within(pop).getByLabelText('Preview').textContent).toBe('Opened in 1922. Results from the official timing feeds.');
    fireEvent.click(within(pop).getByRole('option', { name: /times\.local/ }));
    expect(onInsert).toHaveBeenCalledWith('{shortcut:times.local}', { start: 7, end: 10 });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on Escape and on a click outside without inserting; Enter on an option picks; the field’s end is the cursor when the field is not in the page', () => {
    const { onInsert } = mount({ fieldId: 'nowhere' });
    fireEvent.click(button());
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(button());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onInsert).not.toHaveBeenCalled();
    fireEvent.click(button());
    fireEvent.keyDown(screen.getByRole('option', { name: /data\.sources/ }), { key: 'Enter' });
    expect(onInsert).toHaveBeenCalledWith('{shortcut:data.sources}', { start: VALUE.length, end: VALUE.length });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
