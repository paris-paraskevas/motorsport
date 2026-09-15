import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: unknown; children: React.ReactNode; className?: string }) => (
    <a href={String(href)} className={className}>
      {children}
    </a>
  ),
}));
// The stand-in for next/image renders a plain image element.
vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className?: string }) =>
    React.createElement('img', { src, alt, width, height, className }),
}));

import { CodePageFrame, RowPageView, type RowPageData } from './RowPageView';
import { DEFAULT_NAV } from '@/lib/design/lists';
import type { PageDocument } from '@/lib/design/page-document';

const ASSET = 'c1b2c3d4-0000-4000-8000-000000000031';
const document: PageDocument = {
  version: 1,
  actions: [],
  regions: [
    { id: 'kicker', kind: 'static', title: '', position: 'header', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: null, text: 'A circuit history' },
    { id: 'crumbs', kind: 'list', title: '', position: 'breadcrumb', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: null, listKey: 'doors', style: 'links' },
    { id: 'intro', kind: 'static', title: 'A century of speed', position: 'body', seq: 10, column: 1, span: 8, newRow: false, hidden: false, authz: null, text: 'Opened in 1922.\nStill racing.\n\n{shortcut:times.local} {shortcut:missing}' },
    { id: 'grid', kind: 'image', title: '', position: 'body', seq: 20, column: 9, span: 4, newRow: false, hidden: false, authz: null, assetId: ASSET, alt: 'The banking', showCaption: true },
    { id: 'members', kind: 'static', title: 'Members', position: 'body', seq: 30, column: 1, span: 12, newRow: true, hidden: false, authz: 'signed_in', text: 'Secret' },
    { id: 'staff', kind: 'static', title: 'Staff', position: 'body', seq: 40, column: 1, span: 12, newRow: true, hidden: false, authz: 'administrator', text: 'Very secret' },
    { id: 'more', kind: 'list', title: 'Elsewhere', position: 'right', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: null, listKey: 'footer-site', style: 'cards' },
    { id: 'legal', kind: 'list', title: '', position: 'footer', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: null, listKey: 'footer-legal', style: 'links' },
    { id: 'bar', kind: 'list', title: '', position: 'phonebar', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: null, listKey: 'bar', style: 'links' },
  ],
};
const data: RowPageData = {
  page: { id: 'p', path: '/history/monza', name: 'Monza, a history', kind: 'row', group: 'editorial', template: 'paddock-standard', authz: 'public', title: 'Monza', rendering: 'cached', indexable: true, comments: null, updatedAt: 'x' },
  document,
  shortcuts: { 'times.local': 'All times are local.' },
  assets: new Map([[ASSET, { id: ASSET, key: '2026/09/a.jpg', url: '/media/2026/09/a.jpg', caption: 'The banking', credit: 'P.P.', licence: 'CC BY 4.0', width: 600, height: 400, bytes: 1, contentType: 'image/jpeg', createdAt: 'x', updatedAt: 'x' }]]),
  nav: DEFAULT_NAV,
  allowed: new Set(),
  messages: { signed_in: 'Sign in to see this.', administrator: null },
};

describe('RowPageView', () => {
  const html = renderToStaticMarkup(<RowPageView {...data} />);

  it('places the positions in the template order with the title between header and breadcrumb', () => {
    const at = (s: string) => html.indexOf(s);
    expect(at('A circuit history')).toBeGreaterThan(-1);
    expect(at('A circuit history')).toBeLessThan(at('<h1'));
    expect(html).toContain('>Monza</h1>');
    expect(at('<h1')).toBeLessThan(at('aria-label="crumbs"'));
    expect(at('aria-label="crumbs"')).toBeLessThan(at('A century of speed'));
    expect(at('A century of speed')).toBeLessThan(at('aria-label="Elsewhere"'));
    expect(at('aria-label="Elsewhere"')).toBeLessThan(at('aria-label="legal"'));
    expect(at('aria-label="legal"')).toBeLessThan(at('aria-label="bar"'));
    expect(html).toContain('lg:col-span-8');
    expect(html).toContain('lg:col-span-4');
  });

  it('keeps a region’s column and span for wide screens as a custom property and the full width on phones', () => {
    expect(html).toContain('--gc:1 / span 8');
    expect(html).toContain('--gc:9 / span 4');
    expect(html).toContain('col-span-12 min-w-0 lg:[grid-column:var(--gc)]');
  });

  it('renders Static Content as paragraphs with line breaks and shortcuts substituted, an unknown one dropped', () => {
    expect(html).toContain('<span>Opened in 1922.<br/></span><span>Still racing.</span></p>');
    expect(html).toContain('<span>All times are local.</span></p>');
    expect(html).not.toContain('{shortcut:');
  });

  it('renders the photo with its alternative text, caption, credit and licence', () => {
    expect(html).toContain('src="/media/2026/09/a.jpg"');
    expect(html).toContain('alt="The banking"');
    expect(html).toContain('The banking</span><span> · </span>P.P. · CC BY 4.0');
  });

  it('shows a refused region’s message in its place when it has one and nothing when it does not, and the region itself to a visitor who passes', () => {
    expect(html).not.toContain('Secret');
    expect(html).not.toContain('>Members<');
    expect(html).toContain('Sign in to see this.');
    expect(html).not.toContain('Very secret');
    expect(html).not.toContain('>Staff<');
    const member = renderToStaticMarkup(<RowPageView {...data} allowed={new Set(['signed_in'])} />);
    expect(member).toContain('>Members<');
    expect(member).toContain('Secret');
    expect(member).not.toContain('Sign in to see this.');
  });

  it('renders lists as links or cards from the navigation lists, skipping actions', () => {
    expect(html).toContain('href="/calendar"');
    expect(html).toContain('sm:grid-cols-2');
    expect(html).not.toContain('Contact');
  });

  it('wraps each region for the dynamic actions, renders a hidden region hidden, a Button as a link or a plain button, and mounts the interpreter only with actions', () => {
    expect(html).toContain('id="region-intro" data-region="intro"');
    expect(html).not.toContain('data-dynamic-actions');
    const withButtons = renderToStaticMarkup(
      <RowPageView
        {...data}
        document={{
          version: 1,
          actions: [{ id: 'reveal', name: '', when: { event: 'click', region: 'open' }, do: [{ action: 'show', region: 'more' }] }],
          regions: [
            { id: 'more', kind: 'static', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: false, hidden: true, authz: null, text: 'The rest.' },
            { id: 'open', kind: 'button', title: '', position: 'body', seq: 20, column: 1, span: 4, newRow: false, hidden: false, authz: null, label: 'Read more', dest: null },
            { id: 'cal', kind: 'button', title: 'Next', position: 'body', seq: 30, column: 5, span: 4, newRow: false, hidden: false, authz: null, label: 'Calendar', dest: 'calendar' },
            { id: 'coffee', kind: 'button', title: '', position: 'body', seq: 40, column: 9, span: 4, newRow: false, hidden: false, authz: null, label: 'Support', dest: 'external:support' },
          ],
        }}
      />,
    );
    expect(withButtons).toContain('data-region="more" hidden=""');
    expect(withButtons).toContain('<button type="button" class="inline-flex min-h-11');
    expect(withButtons).toContain('href="/calendar"');
    expect(withButtons).toContain('target="_blank"');
    expect(withButtons).toContain('>Read more</button>');
  });

  it('draws a region whose columns another region of its row already holds on a row of its own, never over its neighbour (R5)', () => {
    const wrapped = renderToStaticMarkup(
      <RowPageView
        {...data}
        document={{
          version: 2,
          actions: [],
          regions: [
            { id: 'x', kind: 'static', title: 'X', position: 'body', seq: 10, column: 1, span: 6, newRow: true, hidden: false, authz: null, text: 'Left.' },
            { id: 'y', kind: 'static', title: 'Y', position: 'body', seq: 20, column: 1, span: 6, newRow: false, hidden: false, authz: null, text: 'Also left.' },
          ],
        }}
      />,
    );
    expect((wrapped.match(/class="grid grid-cols-12 gap-6"/g) ?? []).length).toBe(2);
    expect(wrapped.indexOf('data-region="x"')).toBeLessThan(wrapped.indexOf('data-region="y"'));
  });

  it('draws Header Text above a region’s body and Footer Text below it, shortcuts substituted, and neither for a region the visitor is refused (P1.3)', () => {
    const texts = renderToStaticMarkup(
      <RowPageView
        {...data}
        document={{
          version: 2,
          actions: [],
          regions: [
            { id: 'intro', kind: 'static', title: 'Intro', position: 'body', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: null, text: 'The body.', headerText: 'Above · {shortcut:times.local}', footerText: 'Below · {shortcut:missing} end' },
            { id: 'plain', kind: 'static', title: '', position: 'body', seq: 20, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'No texts.' },
            { id: 'members', kind: 'static', title: 'Members', position: 'body', seq: 30, column: 1, span: 12, newRow: true, hidden: false, authz: 'signed_in', text: 'Secret', headerText: 'Members only', footerText: 'Ask us' },
          ],
        }}
      />,
    );
    const at = (s: string) => texts.indexOf(s);
    expect(texts).toContain('data-region-header=""');
    expect(texts).toContain('data-region-footer=""');
    expect(at('Above · All times are local.')).toBeGreaterThan(-1);
    expect(at('Above · All times are local.')).toBeLessThan(at('>Intro</h2>'));
    expect(at('>Intro</h2>')).toBeLessThan(at('The body.'));
    expect(at('The body.')).toBeLessThan(at('Below ·  end'));
    expect(texts).not.toContain('{shortcut:');
    expect((texts.match(/data-region-header=""/g) ?? []).length).toBe(1);
    expect(texts).not.toContain('Members only');
    expect(texts).not.toContain('Ask us');
    expect(texts).toContain('Sign in to see this.');
  });

  it('spans the body over twelve columns when nothing sits in the right column', () => {
    const noRight = renderToStaticMarkup(<RowPageView {...data} document={{ ...document, regions: document.regions.filter(r => r.position !== 'right') }} />);
    expect(noRight).toContain('lg:col-span-12');
    expect(noRight).not.toContain('lg:col-span-4');
  });
});

describe('RowPageView with lists of the operator’s own', () => {
  it('draws a List region from the entries it was handed by key, before the shell’s set, and nothing for a list with no entries', () => {
    const own: PageDocument = {
      version: 1,
      actions: [],
      regions: [
        { id: 'mine', kind: 'list', title: 'Useful links', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, listKey: 'useful-links', style: 'links' },
        { id: 'empty', kind: 'list', title: 'Ghost', position: 'body', seq: 20, column: 1, span: 12, newRow: true, hidden: false, authz: null, listKey: 'ghost', style: 'cards' },
        { id: 'doors', kind: 'list', title: 'Doors', position: 'footer', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, listKey: 'doors', style: 'links' },
      ],
    };
    const html = renderToStaticMarkup(
      <RowPageView
        {...data}
        document={own}
        lists={{ 'useful-links': [{ label: 'Race calendar', dest: 'calendar' }, { label: 'Members', dest: 'blog', authz: 'signed_in' }], ghost: [], doors: [{ label: 'Only door', dest: 'learn' }] }}
      />,
    );
    expect(html).toContain('aria-label="Useful links"');
    expect(html).toContain('>Race calendar</a>');
    expect(html).not.toContain('Members');
    expect(html).not.toContain('aria-label="Ghost"');
    expect(html).toContain('>Only door</a>');
    expect(html).not.toContain('>Calendar</a>');
  });
});

describe('Template Options (the components programme, P1.2)', () => {
  const region = (id: string, over: Record<string, unknown> = {}) =>
    ({ id, kind: 'static', title: id.toUpperCase(), position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'One.\n\nTwo.', ...over }) as PageDocument['regions'][number];
  /** The wrapper's class attribute of a region, and the markup of the region alone. */
  const wrapperOf = (html: string, id: string) => new RegExp(`id="region-${id}"[^>]*class="([^"]*)"`).exec(html)?.[1] ?? '';
  const markupOf = (html: string, id: string) => {
    const at = html.indexOf(`id="region-${id}"`);
    const next = html.indexOf('id="region-', at + 1);
    return html.slice(at, next < 0 ? undefined : next);
  };
  const ROOMY = { standard: { spacing: 'SPACING_ROOMY', heading: 'HEADING_LABEL', rule: 'RULE_NONE', emphasis: 'EMPHASIS_NORMAL', width: 'WIDTH_FULL' } };

  it('the acceptance: a changed preset reaches every region on Use Template Defaults, and a region that picked its own keeps it', () => {
    const own: PageDocument = { version: 2, actions: [], regions: [region('follows', { seq: 10 }), region('own', { seq: 20, templateOptions: ['#DEFAULT#', 'SPACING_COMPACT'] })] };
    const shipped = renderToStaticMarkup(<RowPageView {...data} document={own} />);
    expect(markupOf(shipped, 'follows')).toContain('class="space-y-3"');
    expect(markupOf(shipped, 'own')).toContain('class="space-y-1.5"');
    expect(wrapperOf(shipped, 'follows')).not.toContain('py-4');
    const roomy = renderToStaticMarkup(<RowPageView {...data} document={own} templates={ROOMY} />);
    expect(markupOf(roomy, 'follows')).toContain('class="space-y-6"');
    expect(wrapperOf(roomy, 'follows')).toContain('py-4');
    expect(markupOf(roomy, 'own')).toContain('class="space-y-1.5"');
    expect(wrapperOf(roomy, 'own')).not.toContain('py-4');
  });

  it('draws the region as before when nothing is stored, and each option on its own part: the headline, the hidden title, the rule, the measure, the muted text', () => {
    const own: PageDocument = {
      version: 2,
      actions: [],
      regions: [
        region('plain', { seq: 10 }),
        region('headline', { seq: 20, templateOptions: ['#DEFAULT#', 'HEADING_HEADLINE'] }),
        region('quiet', { seq: 30, templateOptions: ['HEADING_HIDDEN', 'EMPHASIS_MUTED'] }),
        region('ruled', { seq: 40, templateOptions: ['#DEFAULT#', 'RULE_ABOVE', 'WIDTH_READING'] }),
      ],
    };
    const html = renderToStaticMarkup(<RowPageView {...data} document={own} />);
    expect(markupOf(html, 'plain')).toMatch(/<h2 class="(?=[^"]*font-mono)(?=[^"]*border-b)[^"]*">PLAIN<\/h2>/);
    expect(markupOf(html, 'plain')).toMatch(/<p class="font-serif text-16 leading-relaxed text-text-muted">/);
    expect(markupOf(html, 'headline')).toMatch(/<h2 class="[^"]*font-serif[^"]*">HEADLINE<\/h2>/);
    expect(markupOf(html, 'headline')).not.toMatch(/<h2 class="[^"]*border-b/);
    expect(markupOf(html, 'quiet')).toMatch(/<h2 class="[^"]*sr-only[^"]*">QUIET<\/h2>/);
    expect(markupOf(html, 'quiet')).toMatch(/<p class="[^"]*text-text-faint">/);
    expect(wrapperOf(html, 'ruled')).toContain('border-t');
    expect(wrapperOf(html, 'ruled')).toContain('max-w-[65ch]');
    expect(wrapperOf(html, 'plain')).not.toContain('border-t');
  });

  it('a component region takes the wrapper’s options only, and a refused region draws its message without them', () => {
    const own: PageDocument = {
      version: 2,
      actions: [],
      regions: [
        region('drawn', { seq: 10, kind: 'component', component: 'page.body', settings: {}, text: undefined, templateOptions: ['#DEFAULT#', 'RULE_BELOW', 'HEADING_HEADLINE'] }),
        region('locked', { seq: 20, authz: 'signed_in', templateOptions: ['#DEFAULT#', 'RULE_ABOVE'] }),
      ],
    };
    const html = renderToStaticMarkup(<RowPageView {...data} document={own} components={{ drawn: <p>DRAWN</p> }} />);
    expect(wrapperOf(html, 'drawn')).toContain('border-b');
    expect(markupOf(html, 'drawn')).not.toContain('<h2');
    expect(markupOf(html, 'locked')).toContain('Sign in to see this.');
    expect(markupOf(html, 'locked')).not.toContain('<h2');
  });
});

describe('components (the components programme, R2a)', () => {
  const region = (id: string, over: Record<string, unknown> = {}) =>
    ({ id, kind: 'static', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: id.toUpperCase(), ...over }) as PageDocument['regions'][number];
  const component = (id: string, seq: number) => region(id, { kind: 'component', component: 'page.body', settings: {}, seq, text: undefined });

  it('renders a component region from what the server drew, nothing when it drew nothing, and the phones and desktop rules as classes', () => {
    const own: PageDocument = {
      version: 1,
      actions: [],
      regions: [component('drawn', 10), region('phone', { seq: 20, show: 'phones' }), region('wide', { seq: 30, show: 'desktop' }), component('blank', 40)],
    };
    const html = renderToStaticMarkup(<RowPageView {...data} document={own} components={{ drawn: <p>DRAWN BY THE SERVER</p> }} />);
    expect(html).toContain('DRAWN BY THE SERVER');
    expect(html).toContain('id="region-blank"');
    expect(html).toMatch(/id="region-phone"[^>]*class="[^"]*lg:hidden/);
    expect(html).toMatch(/id="region-wide"[^>]*class="[^"]*max-lg:hidden/);
    expect(html).not.toMatch(/id="region-drawn"[^>]*class="[^"]*hidden/);
  });

  it('CodePageFrame puts the code’s body where the transitional component sits, the operator’s body regions before and after it in the standard width, and first when no component names it', () => {
    const around: PageDocument = { version: 1, actions: [], regions: [region('above', { seq: 10 }), component('code-body', 20), region('below', { seq: 30 })] };
    const html = renderToStaticMarkup(
      <CodePageFrame d={{ ...data, document: around }}>
        <main>THE CODE BODY</main>
      </CodePageFrame>,
    );
    const at = (s: string) => html.indexOf(s);
    expect(at('ABOVE')).toBeGreaterThan(-1);
    expect(at('ABOVE')).toBeLessThan(at('THE CODE BODY'));
    expect(at('THE CODE BODY')).toBeLessThan(at('BELOW'));
    expect(html).toContain('data-page-frame="body-before"');
    expect(html).toContain('data-page-frame="body-after"');
    expect(html).not.toContain('id="region-code-body"');

    // Body regions without the transitional component: the operator has split
    // the page, and the code's body is not drawn at all.
    const split: PageDocument = { version: 1, actions: [], regions: [region('lead', { seq: 10, kind: 'component', component: 'home.lead', settings: {}, text: undefined }), region('after', { seq: 20 })] };
    const composed = renderToStaticMarkup(
      <CodePageFrame d={{ ...data, document: split, components: { lead: <h1>THE LEAD</h1> } }}>
        <main>THE CODE BODY</main>
      </CodePageFrame>,
    );
    expect(composed).not.toContain('THE CODE BODY');
    expect(composed.indexOf('THE LEAD')).toBeLessThan(composed.indexOf('AFTER'));
    expect(composed).toContain('data-page-frame="body"');
    expect(composed).not.toContain('body-after');

    // No Body regions at all (a revision from before the Body opened): the code's body alone.
    const none: PageDocument = { version: 1, actions: [], regions: [region('kicker', { position: 'header', seq: 10 })] };
    const plain = renderToStaticMarkup(
      <CodePageFrame d={{ ...data, document: none }}>
        <main>THE CODE BODY</main>
      </CodePageFrame>,
    );
    expect(plain).toContain('THE CODE BODY');
    expect(plain).toContain('KICKER');
    expect(plain).not.toContain('body-before');
    expect(plain).not.toContain('data-page-frame="body');
  });
});
