'use client';

import type { MouseEvent, ReactNode } from 'react';
import { ChevronDown, ChevronRight, FileText, Lock, Puzzle, RefreshCw, Zap } from 'lucide-react';
import { POSITIONS, REGION_KIND_LABELS, type PageDocument, type Position } from '@/lib/design/page-document';
import type { PageRow } from '@/lib/design/pages';
import {
  PD_POSITION,
  PD_SHARED,
  STEP_POINTS,
  actionName,
  effectText,
  regionName,
  sameSelection,
  spanName,
  systemSteps,
  triggerText,
  type Selection,
  type SharedKey,
} from './page-designer-model';
import { KIND_ICON, type Drag } from './PageDesignerLayout';

// The left pane's four trees (Paddock Designer v2.4, renderLeft): Rendering
// (Pre-Rendering, the Components by position with the shared components
// locked, Post-Rendering), Dynamic Actions (by event, each with its effects),
// Processing (the system steps, read-only) and Page Shared Components (what the
// page borrows from the application). A node selects; a right-click opens its
// context menu; a region node drags onto the Layout.

export type LeftTab = 'rend' | 'da' | 'proc' | 'psc';

export const LEFT_TABS: { key: LeftTab; label: string; k: string }[] = [
  { key: 'rend', label: 'Rendering', k: 'Alt+1' },
  { key: 'da', label: 'Dynamic Actions', k: 'Alt+2' },
  { key: 'proc', label: 'Processing', k: 'Alt+3' },
  { key: 'psc', label: 'Page Shared Components', k: 'Alt+4' },
];

interface NodeSpec {
  key: string;
  label: string;
  icon?: ReactNode;
  /** A mono tag at the right: a count, a span, "shared". */
  tag?: string;
  cls?: 'grp' | 'pos' | 'locked';
  marker?: 'err' | 'warn';
  sel?: Selection;
  drag?: Drag;
  onClick?: () => void;
  children?: NodeSpec[];
}

export function PageDesignerTree({
  page,
  doc,
  tab,
  query,
  selection,
  markers,
  expanded,
  shared,
  usage,
  onToggle,
  onSelect,
  onContext,
  onDragStart,
  onTab,
  onCreateAction,
  onOpenShared,
  readOnly,
}: {
  page: PageRow;
  doc: PageDocument;
  tab: LeftTab;
  query: string;
  selection: Selection;
  markers: Record<string, 'err' | 'warn'>;
  /** Folded nodes by key; a node absent is open. */
  expanded: Record<string, boolean>;
  /** One line per shared list: its entry count. */
  shared: Record<SharedKey, string>;
  /** What this page borrows, for the Page Shared Components tab. */
  usage: { theme: string; schemes: string[]; shortcuts: string[]; assets: string[]; lists: string[] };
  onToggle: (key: string) => void;
  onSelect: (sel: Selection) => void;
  onContext: (at: { x: number; y: number }, sel: Selection) => void;
  onDragStart: (drag: Drag) => void;
  onTab: (tab: LeftTab) => void;
  onCreateAction: () => void;
  /** A Page Shared Components node: the entry opens in Shared Components. */
  onOpenShared: (sc: string) => void;
  readOnly: boolean;
}) {
  const q = query.trim().toLowerCase();
  const matches = (...parts: (string | undefined)[]) => !q || parts.filter(Boolean).join(' ').toLowerCase().includes(q);
  const isSel = (s?: Selection) => (s ? sameSelection(selection, s) : false);
  const code = page.kind === 'code';
  const number = page.id ? page.id.slice(0, 8) : 'no row';

  const regionNodes = (pos: Position): NodeSpec[] =>
    doc.regions
      .filter(r => r.position === pos && matches(regionName(r), REGION_KIND_LABELS[r.kind].label))
      .map(r => {
        const Icon = KIND_ICON[r.kind];
        return {
          key: `region:${r.id}`,
          label: regionName(r),
          icon: <Icon size={11} />,
          tag: pos === 'body' ? spanName(r.span) : r.hidden ? 'hidden' : undefined,
          marker: markers[`region:${r.id}`],
          sel: { kind: 'region', id: r.id },
          drag: { type: 'region', id: r.id },
        };
      });
  const positionNode = (pos: Position): NodeSpec => {
    const kids = regionNodes(pos);
    const n = doc.regions.filter(r => r.position === pos).length;
    return { key: `pos:${pos}`, label: PD_POSITION[pos].label, cls: 'pos', tag: n ? String(n) : 'empty', sel: { kind: 'position', id: pos }, children: kids };
  };
  const sharedNode = (key: SharedKey, label: string): NodeSpec => ({
    key: `shared:${key}`,
    label,
    icon: <Puzzle size={11} />,
    cls: 'locked',
    tag: 'shared',
    sel: { kind: 'shared', id: key },
  });
  const steps = systemSteps(page.kind);
  const stepNodes = (point: (typeof STEP_POINTS)[number]['key']): NodeSpec[] =>
    steps
      .filter(s => s.point === point && matches(s.name, s.note))
      .map(s => ({ key: `proc:${s.id}`, label: s.name, icon: <RefreshCw size={10} />, cls: 'locked', tag: 'system', sel: { kind: 'proc', id: s.id } }));

  let tree: NodeSpec[] = [];
  let foot: ReactNode = null;

  if (tab === 'rend') {
    const components: NodeSpec[] = [
      sharedNode('doors', 'Header · Navigation Menu'),
      code
        ? { key: 'pos:header', label: PD_POSITION.header.label, cls: 'pos', tag: 'the code’s' }
        : positionNode('header'),
      ...(code ? [] : [positionNode('breadcrumb')]),
      code
        ? { key: 'pos:body', label: 'Body', cls: 'pos', tag: 'the code’s', children: [{ key: 'code-body', label: page.name, icon: <Lock size={10} />, cls: 'locked', tag: 'Full' }] }
        : positionNode('body'),
      code ? { key: 'pos:right', label: PD_POSITION.right.label, cls: 'pos', tag: 'empty' } : positionNode('right'),
      { key: 'pos:dialog', label: 'Inline Dialogs', cls: 'pos', tag: 'later' },
      ...(code ? [] : [positionNode('footer')]),
      sharedNode('footer', 'Footer · Site footer'),
      ...(code ? [] : [positionNode('phonebar')]),
      sharedNode('bar', 'Navigation Bar · Phone bar'),
    ];
    tree = [
      {
        key: 'page',
        label: `Page ${number}: ${page.name}`,
        icon: <FileText size={11} />,
        cls: 'grp',
        marker: markers.page,
        sel: { kind: 'page' },
        children: [
          {
            key: 'pre',
            label: 'Pre-Rendering',
            cls: 'pos',
            onClick: () => onTab('proc'),
            children: [
              { key: 'bh', label: 'Before Header', cls: 'pos', children: stepNodes('before-header') },
              { key: 'ah', label: 'After Header', cls: 'pos', children: stepNodes('after-header') },
            ],
          },
          { key: 'comps', label: 'Components', cls: 'pos', sel: { kind: 'page' }, children: components },
          { key: 'post', label: 'Post-Rendering', cls: 'pos', onClick: () => onTab('proc'), children: [{ key: 'af', label: 'After Footer', cls: 'pos', children: stepNodes('after-footer') }] },
        ],
      },
    ];
  } else if (tab === 'da') {
    const byEvent: Record<string, NodeSpec[]> = {};
    const eventLabel: Record<string, string> = { click: 'Click', visible: 'Scrolled into view', load: 'Page Load', timer: 'Timer' };
    for (const a of doc.actions) {
      if (!matches(actionName(a), triggerText(a.when, doc.regions))) continue;
      (byEvent[a.when.event] ??= []).push({
        key: `action:${a.id}`,
        label: actionName(a),
        icon: <Zap size={11} />,
        tag: triggerText(a.when, doc.regions).split(' · ')[1],
        marker: markers[`action:${a.id}`],
        sel: { kind: 'action', id: a.id },
        children: [
          {
            key: `ta:${a.id}`,
            label: 'True Actions',
            cls: 'pos',
            children: a.do.map((e, i) => ({ key: `effect:${a.id}:${i}`, label: effectText(e, doc.regions), icon: <ChevronRight size={10} />, sel: { kind: 'effect', id: a.id, index: i } })),
          },
        ],
      });
    }
    tree = ['click', 'load', 'timer', 'visible']
      .filter(ev => byEvent[ev])
      .map(ev => ({ key: `ev:${ev}`, label: eventLabel[ev], cls: 'pos', tag: String(byEvent[ev].length), children: byEvent[ev] }));
    foot = (
      <>
        {!readOnly && !code && (
          <button type="button" className="mx-3 my-1.5 border border-edit px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-edit hover:bg-edit-dim" onClick={onCreateAction}>
            ＋ Create Dynamic Action
          </button>
        )}
        <p className="m-0 px-3.5 py-3 text-12 leading-relaxed text-text-faint">
          {code
            ? 'A page the code serves has no dynamic actions of its own; they arrive with regions of your own.'
            : 'A dynamic action is When (an event on a region or the page) plus Actions (show, hide, toggle, scroll to, go), each chosen from lists. The running page executes them; nobody writes JavaScript.'}
        </p>
      </>
    );
  } else if (tab === 'proc') {
    tree = [
      {
        key: 'ppre',
        label: 'Pre-Rendering',
        cls: 'grp',
        children: [
          { key: 'pbh', label: 'Before Header', cls: 'pos', children: stepNodes('before-header') },
          { key: 'pah', label: 'After Header', cls: 'pos', children: stepNodes('after-header') },
        ],
      },
      { key: 'ppost', label: 'Post-Rendering', cls: 'grp', children: [{ key: 'paf', label: 'After Footer', cls: 'pos', children: stepNodes('after-footer') }] },
    ];
    foot = (
      <p className="m-0 px-3.5 py-3 text-12 leading-relaxed text-text-faint">
        System processes are what the site already does at each point when it serves this page; they are read-only, and a change is a deploy. Rules and scheduled processes arrive with a later phase.
      </p>
    );
  } else {
    const n = (key: string, label: string, tag: string, sc: string): NodeSpec => ({ key: `psc:${key}`, label, icon: <Puzzle size={11} />, tag, onClick: () => onOpenShared(sc) });
    tree = [
      {
        key: 'pn',
        label: 'Navigation',
        cls: 'grp',
        children: [n('doors', 'Navigation Menu · Doors', shared.doors, 'doors'), n('bar', 'Navigation Bar · Phone bar', shared.bar, 'bar'), n('footer', 'Footer lists', shared.footer, 'footer-site')],
      },
      {
        key: 'pu',
        label: 'User Interface',
        cls: 'grp',
        children: [n('themes', `Theme · default ${usage.theme}`, '', 'themes'), n('appearance', 'Appearance · faces and sizes', '', 'appearance'), n('template', 'Page template · Paddock Standard', '1 of 1', 'themes')],
      },
      {
        key: 'ps',
        label: 'Security',
        cls: 'grp',
        children: [n('auth', 'Authentication · Clerk', '', 'authz'), n('authz', 'Authorization schemes used', usage.schemes.join(', ') || 'Public', 'authz')],
      },
      {
        key: 'po',
        label: 'Other Components',
        cls: 'grp',
        children: [
          n('shortcuts', 'Shortcuts used', usage.shortcuts.length ? usage.shortcuts.join(', ') : 'none on this page', 'shortcuts'),
          n('assets', 'Photos used', usage.assets.length ? String(usage.assets.length) : 'none on this page', 'assets'),
          n('lists', 'Lists used', usage.lists.length ? usage.lists.join(', ') : 'none on this page', 'doors'),
          n('text', 'Text Messages', '', 'text'),
        ],
      },
    ];
    foot = (
      <p className="m-0 px-3.5 py-3 text-12 leading-relaxed text-text-faint">
        What this page borrows from the application. Each opens in Shared Components; a change there lands on every page that uses it.
      </p>
    );
  }

  const node = (n: NodeSpec, depth: number): ReactNode => {
    const kids = n.children ?? [];
    const hasKids = kids.length > 0;
    const open = expanded[n.key] !== false;
    const selected = isSel(n.sel);
    const ctx = (e: MouseEvent) => {
      if (!n.sel) return;
      e.preventDefault();
      e.stopPropagation();
      if (!selected) onSelect(n.sel);
      onContext({ x: e.clientX, y: e.clientY }, n.sel);
    };
    return (
      <li key={n.key} className="m-0">
        <div
          role="treeitem"
          aria-selected={selected}
          aria-expanded={hasKids ? open : undefined}
          tabIndex={0}
          draggable={Boolean(n.drag) && !readOnly}
          className={`flex select-none items-center gap-1.5 border px-1.5 py-1 text-12 ${
            selected ? 'border-edit bg-edit-dim text-text' : 'border-transparent text-text-muted hover:bg-surface-elevated hover:text-text'
          } ${n.cls === 'grp' ? 'font-semibold text-text' : ''} ${n.cls === 'pos' ? 'font-mono text-9 uppercase tracking-[0.14em] text-text-faint' : ''} ${n.cls === 'locked' ? 'text-text-faint' : ''} ${n.sel || n.onClick ? 'cursor-pointer' : 'cursor-default'}`}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => {
            if (n.onClick) n.onClick();
            else if (n.sel) onSelect(n.sel);
            else if (hasKids) onToggle(n.key);
          }}
          onDoubleClick={() => hasKids && onToggle(n.key)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (n.onClick) n.onClick();
              else if (n.sel) onSelect(n.sel);
              else if (hasKids) onToggle(n.key);
            }
          }}
          onContextMenu={ctx}
          onDragStart={e => {
            if (!n.drag) return;
            e.dataTransfer.setData('text/plain', n.key);
            onDragStart(n.drag);
          }}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={hasKids ? (open ? 'Collapse' : 'Expand') : undefined}
            className="grid w-3 shrink-0 place-items-center text-text-faint"
            onClick={e => {
              e.stopPropagation();
              if (hasKids) onToggle(n.key);
            }}
          >
            {hasKids ? open ? <ChevronDown size={10} /> : <ChevronRight size={10} /> : null}
          </button>
          {n.icon && <span className="grid w-3.5 shrink-0 place-items-center text-text-faint">{n.icon}</span>}
          <span className="min-w-0 flex-1 truncate normal-case tracking-normal">{n.label}</span>
          {n.marker && <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${n.marker === 'err' ? 'bg-negative' : 'bg-[color:var(--amber,#e0a52d)]'}`} aria-label={n.marker === 'err' ? 'error' : 'warning'} />}
          {n.tag && <span className="whitespace-nowrap font-mono text-8 uppercase tracking-[0.1em] text-text-faint">{n.tag}</span>}
        </div>
        {hasKids && open && (
          <ul className="m-0 list-none p-0" role="group">
            {kids.map(k => node(k, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div>
      {tree.length > 0 ? (
        <ul role="tree" aria-label={LEFT_TABS.find(t => t.key === tab)!.label} className="m-0 list-none px-1.5 pb-3 pt-1">
          {tree.map(n => node(n, 0))}
        </ul>
      ) : (
        <p className="m-0 px-3.5 pt-3 text-12 text-text-faint">{tab === 'da' ? (q ? 'No dynamic action matches.' : 'No dynamic actions on this page yet.') : 'Nothing matches.'}</p>
      )}
      {foot}
    </div>
  );
}

/** Every node key, so Expand All and Collapse All can set them. */
export function treeKeys(doc: PageDocument): string[] {
  const keys = ['page', 'pre', 'bh', 'ah', 'comps', 'post', 'af', 'ppre', 'pbh', 'pah', 'ppost', 'paf', 'pn', 'pu', 'ps', 'po', 'pos:dialog'];
  for (const p of POSITIONS) keys.push(`pos:${p}`);
  for (const a of doc.actions) keys.push(`action:${a.id}`, `ta:${a.id}`);
  for (const ev of ['click', 'load', 'timer', 'visible']) keys.push(`ev:${ev}`);
  return keys;
}

export { PD_SHARED };
