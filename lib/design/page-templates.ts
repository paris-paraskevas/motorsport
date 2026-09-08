// The templates a new row page starts from (APEX: the page types in the Create
// Page wizard, each drawn with its layout). A template is a starting layout
// named for the kind of page the site already has, so the operator picks "an
// Article, like a blog post" rather than an empty grid. Every region a template
// places can be changed or removed afterwards; Blank places none.
//
// A template may only name rows that exist on every database the designer
// runs against: the four navigation lists seeded in Phase 2. No photos (there
// are none until the operator uploads one) and no shortcut tokens (the operator
// inserts those by name). lib/design/page-templates.test.ts holds the templates
// to those rules and to the document parser.

import type { PageGroup } from './page-registry';
import { PAGE_DOCUMENT_VERSION, type ListRegion, type PageDocument, type Position, type StaticRegion } from './page-document';

export type PageTemplateKey = 'article' | 'guide' | 'hub' | 'landing' | 'notice' | 'blank';

export interface PageTemplate {
  key: PageTemplateKey;
  name: string;
  /** The page on the site it is like: "a blog post", "the Privacy page". */
  like: string;
  description: string;
  /** The group it is filed under unless the operator picks another. */
  group: PageGroup;
  document: PageDocument;
}

/** The navigation lists a template may name; all four are seeded rows. */
export const TEMPLATE_LIST_KEYS = ['doors', 'bar', 'footer-site', 'footer-legal'] as const;

function text(id: string, title: string, position: Position, seq: number, column: number, span: number, body: string, newRow = false): StaticRegion {
  return { id, kind: 'static', title, position, seq, column, span, newRow, authz: null, hidden: false, text: body };
}

function list(
  id: string,
  title: string,
  position: Position,
  seq: number,
  column: number,
  span: number,
  listKey: (typeof TEMPLATE_LIST_KEYS)[number],
  style: ListRegion['style'],
  newRow = false,
): ListRegion {
  return { id, kind: 'list', title, position, seq, column, span, newRow, authz: null, hidden: false, listKey, style };
}

export const PAGE_TEMPLATES: readonly PageTemplate[] = [
  {
    key: 'article',
    name: 'Article',
    like: 'a blog post',
    description: 'A standfirst across the top, the story over eight columns with an aside beside it, and the site’s links in the right column.',
    group: 'editorial',
    document: {
      version: PAGE_DOCUMENT_VERSION,
      actions: [],
      regions: [
        text('standfirst', 'Standfirst', 'body', 10, 1, 12, 'One or two sentences that say what this page is about.'),
        text('story', 'The story', 'body', 20, 1, 8, 'Write the story here.', true),
        text('aside', 'Aside', 'body', 30, 9, 4, 'A fact, a date or a quotation worth pulling out.'),
        list('elsewhere', 'Elsewhere on Paddock', 'right', 10, 1, 12, 'footer-site', 'links'),
      ],
    },
  },
  {
    key: 'guide',
    name: 'Guide',
    like: 'a Learn answer',
    description: 'One long answer at full width, related links to the right and the legal list below.',
    group: 'editorial',
    document: {
      version: PAGE_DOCUMENT_VERSION,
      actions: [],
      regions: [
        text('answer', 'The answer', 'body', 10, 1, 12, 'Answer the question here, from the top down.'),
        list('related', 'Related', 'right', 10, 1, 12, 'bar', 'links'),
        list('legal', '', 'footer', 10, 1, 12, 'footer-legal', 'links'),
      ],
    },
  },
  {
    key: 'hub',
    name: 'Hub',
    like: 'the Series index',
    description: 'An introduction across the header, then two lists as cards side by side.',
    group: 'home',
    document: {
      version: PAGE_DOCUMENT_VERSION,
      actions: [],
      regions: [
        text('intro', 'Introduction', 'header', 10, 1, 12, 'Say what this part of the site holds.'),
        list('around', 'Around the site', 'body', 10, 1, 6, 'doors', 'cards'),
        list('quick', 'Quick links', 'body', 20, 7, 6, 'bar', 'cards'),
      ],
    },
  },
  {
    key: 'landing',
    name: 'Landing',
    like: 'the Home page',
    description: 'A headline in the header, a seven-column lead with links beside it, and the phone bar for small screens.',
    group: 'home',
    document: {
      version: PAGE_DOCUMENT_VERSION,
      actions: [],
      regions: [
        text('headline', 'Headline', 'header', 10, 1, 12, 'The one line this page is for.'),
        text('lead', 'Lead', 'body', 10, 1, 7, 'The opening paragraphs.'),
        list('start', 'Start here', 'body', 20, 8, 5, 'bar', 'links'),
        list('phone', '', 'phonebar', 10, 1, 12, 'bar', 'links'),
      ],
    },
  },
  {
    key: 'notice',
    name: 'Notice',
    like: 'the Privacy page',
    description: 'One column of text at full width with the legal list beneath it.',
    group: 'site',
    document: {
      version: PAGE_DOCUMENT_VERSION,
      actions: [],
      regions: [
        text('notice', 'The notice', 'body', 10, 1, 12, 'The text of the notice.'),
        list('legal', '', 'footer', 10, 1, 12, 'footer-legal', 'links'),
      ],
    },
  },
  {
    key: 'blank',
    name: 'Blank',
    like: 'nothing yet',
    description: 'An empty schematic: place every region yourself.',
    group: 'editorial',
    document: { version: PAGE_DOCUMENT_VERSION, regions: [], actions: [] },
  },
];

export function pageTemplate(key: unknown): PageTemplate | null {
  return PAGE_TEMPLATES.find(t => t.key === key) ?? null;
}
