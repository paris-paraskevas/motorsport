// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pills, PropertyPane, Ro, type PropGroup } from './PropertyPane';

// The Property Editor pane on its own: the filter, Show Common / Show All,
// folding, Go to Group, the help at the foot, a group labelled later.

afterEach(cleanup);

function groups(onPick = vi.fn()): PropGroup[] {
  return [
    {
      title: 'Identification',
      props: [
        { label: 'Name', common: true, htmlFor: 'f-name', control: <input id="f-name" aria-label="Name field" defaultValue="Calendar" />, help: 'How the page is called.' },
        { label: 'Page Alias', common: true, control: <Ro>/calendar</Ro>, note: 'Built-in route. Its path is code.' },
      ],
    },
    {
      title: 'Security',
      props: [
        {
          label: 'Authorization Scheme',
          common: true,
          control: (
            <Pills
              label="Page authorization"
              items={[
                { key: 'public', label: 'Public' },
                { key: 'signed_in', label: 'Signed in' },
              ]}
              current="public"
              onPick={onPick}
            />
          ),
          help: 'Who may see the page.',
        },
      ],
    },
    { title: 'Advanced', props: [{ label: 'Comments', control: <textarea aria-label="Comments field" /> }] },
    { title: 'Page CSS', props: [], later: true },
  ];
}

describe('PropertyPane', () => {
  it('shows the head, the groups and their rows, with a later group folded and labelled', () => {
    render(<PropertyPane head={{ kind: 'Page', name: 'c0de0002: Calendar' }} groups={groups()} />);
    expect(screen.getByText('c0de0002: Calendar')).toBeTruthy();
    for (const g of ['Identification', 'Security', 'Advanced']) expect(screen.getByRole('button', { name: g })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Page CSS/ }).textContent).toContain('later');
    expect(screen.getByText('Built-in route. Its path is code.')).toBeTruthy();
    expect(screen.getByLabelText('Name field')).toBeTruthy();
  });

  it('filters the rows, shows the common ones alone, folds and unfolds, and goes to a group', () => {
    render(<PropertyPane head={{ kind: 'Page', name: 'Calendar' }} groups={groups()} />);
    fireEvent.change(screen.getByLabelText('Filter properties'), { target: { value: 'alias' } });
    expect(screen.getByText('/calendar')).toBeTruthy();
    expect(screen.queryByLabelText('Name field')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Security' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Filter properties'), { target: { value: 'zzz' } });
    expect(screen.getByText('No property matches.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter properties'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show Common' }));
    expect(screen.queryByLabelText('Comments field')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show All' }));
    expect(screen.getByLabelText('Comments field')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.queryByLabelText('Comments field')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Group' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Advanced' }));
    expect(screen.getByLabelText('Comments field')).toBeTruthy();
  });

  it('reads the help of the property whose label is clicked, and the pills press', () => {
    const onPick = vi.fn();
    render(<PropertyPane head={{ kind: 'Page', name: 'Calendar' }} groups={groups(onPick)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show help' }));
    expect(screen.getByText("Click a property's label, or focus a field, to read its help here.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Authorization Scheme' }));
    expect(screen.getByText(/Who may see the page\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Signed in' }));
    expect(onPick).toHaveBeenCalledWith('signed_in');
    expect(screen.getByRole('button', { name: 'Public' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('marks a changed row, and splits Region and Attributes when attributes are given (P1.6)', () => {
    const region: PropGroup[] = [
      {
        title: 'Identification',
        props: [
          { label: 'Name', changed: true, htmlFor: 'f-rname', control: <input id="f-rname" aria-label="Name field" /> },
          { label: 'Type', control: <Ro>Component</Ro> },
        ],
      },
    ];
    const attributes: PropGroup[] = [{ title: 'Settings', props: [{ label: 'Items', htmlFor: 'f-items', control: <input id="f-items" aria-label="Items field" /> }] }];
    const wire = (extra: { focusGroup?: { title: string; n: number } } = {}) => <PropertyPane head={{ kind: 'Component', name: 'The wire' }} groups={region} attributes={attributes} {...extra} />;
    const { rerender } = render(wire());
    // The marker sits on the changed row alone, and the label's own name is untouched.
    expect(screen.getAllByRole('img', { name: 'Changed since the last save' })).toHaveLength(1);
    expect(screen.getByLabelText('Name field').closest('[data-changed]')).not.toBeNull();
    expect(screen.getByText('Component', { selector: 'div' }).closest('[data-changed]')).toBeNull();
    expect(screen.getByText('Name', { selector: 'label' })).toBeTruthy();
    // Region shows first; Attributes holds the settings; the filter works within the shown tab.
    const tabs = screen.getByRole('tablist', { name: 'Property Editor tabs' });
    expect(within(tabs).getByRole('tab', { name: 'Region' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByLabelText('Items field')).toBeNull();
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Attributes' }));
    expect(screen.getByLabelText('Items field')).toBeTruthy();
    expect(screen.queryByLabelText('Name field')).toBeNull();
    fireEvent.change(screen.getByLabelText('Filter properties'), { target: { value: 'name' } });
    expect(screen.getByText('No property matches.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter properties'), { target: { value: '' } });
    // Another component selected: a plain region has no tabs; the component again opens on Region.
    rerender(<PropertyPane head={{ kind: 'Static Content', name: 'Intro' }} groups={region} />);
    expect(screen.queryByRole('tablist', { name: 'Property Editor tabs' })).toBeNull();
    expect(screen.getByLabelText('Name field')).toBeTruthy();
    rerender(wire());
    expect(within(screen.getByRole('tablist', { name: 'Property Editor tabs' })).getByRole('tab', { name: 'Region' }).getAttribute('aria-selected')).toBe('true');
    // Messages and Page Search asking for a group under Attributes open that tab.
    rerender(wire({ focusGroup: { title: 'Settings', n: 1 } }));
    expect(screen.getByLabelText('Items field')).toBeTruthy();
  });
});
