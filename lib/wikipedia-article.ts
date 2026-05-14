import * as cheerio from 'cheerio';

const UA = 'Paddock-PWA (https://paddock-tracker.com)';

interface SectionMatch {
  html: string;
  sectionName: string;
  pageUrl: string;
}

interface WikiSection {
  toclevel?: number;
  level?: string;
  line?: string;
  number?: string;
  index?: string;
  anchor?: string;
}

/**
 * Fetch a specific section from a Wikipedia article by heading name.
 * Returns rendered HTML for the section, cleaned of footnote refs and editsections.
 * Internal /wiki/ links are rewritten to absolute and open in a new tab.
 *
 * Returns null if the page or matching section is not found.
 */
export async function fetchWikipediaSection(
  pageTitle: string,
  candidateSectionNames: string[],
): Promise<SectionMatch | null> {
  if (!pageTitle) return null;

  try {
    const sectionsUrl =
      `https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=sections&page=${pageTitle}&origin=*`;
    const listRes = await fetch(sectionsUrl, {
      next: { revalidate: 86400 },
      headers: { 'User-Agent': UA },
    } as RequestInit);
    if (!listRes.ok) return null;
    const listData = await listRes.json();
    const sections: WikiSection[] = listData?.parse?.sections ?? [];

    const lowered = candidateSectionNames.map(c => c.toLowerCase());
    // Prefer exact match before substring match.
    let matched = sections.find(s => {
      const line = s.line?.toLowerCase() ?? '';
      return lowered.includes(line);
    });
    if (!matched) {
      matched = sections.find(s => {
        const line = s.line?.toLowerCase() ?? '';
        return lowered.some(c => line.includes(c));
      });
    }
    if (!matched || !matched.index) return null;

    const sectionUrl =
      `https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=text&page=${pageTitle}&section=${matched.index}&origin=*`;
    const sectionRes = await fetch(sectionUrl, {
      next: { revalidate: 86400 },
      headers: { 'User-Agent': UA },
    } as RequestInit);
    if (!sectionRes.ok) return null;
    const sectionData = await sectionRes.json();
    const rawHtml: string | undefined = sectionData?.parse?.text?.['*'];
    if (!rawHtml) return null;

    const html = cleanSectionHtml(rawHtml);
    return {
      html,
      sectionName: matched.line ?? candidateSectionNames[0],
      pageUrl: `https://en.wikipedia.org/wiki/${pageTitle}`,
    };
  } catch {
    return null;
  }
}

function cleanSectionHtml(html: string): string {
  const $ = cheerio.load(html, { xmlMode: false });

  // Strip Wikipedia chrome that doesn't belong in our render.
  $('sup.reference, sup.noprint').remove();
  $('.mw-editsection').remove();
  $('.mw-empty-elt').remove();
  $('table.navbox, table.vertical-navbox, table.metadata, table.sidebar').remove();
  $('.hatnote, .ambox, .shortdescription').remove();
  $('style').remove();
  $('.thumbcaption .magnify').remove();
  // Wikipedia in-article navigation (table of contents, etc.) — the rendered
  // output for a section sometimes embeds a TOC of its sub-headings which
  // ends up as a list of underlined-but-broken anchors in our prose.
  $('.toc, #toc, nav.toc, .mw-tochidden, .toclimit-2, .toclimit-3, .toclimit-4').remove();
  // Strip lone anchor-only headings that the section API sometimes emits.
  $('.mw-headline-anchor').remove();
  // Anchor-only links (href starts with #) become dead text in our render —
  // unwrap them so they aren't styled as broken links.
  $('a[href^="#"]').each((_, el) => {
    const $a = $(el);
    $a.replaceWith($a.contents());
  });

  // Rewrite internal links to absolute and open in new tab.
  $('a').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    if (!href) return;
    if (href.startsWith('/wiki/')) {
      $a.attr('href', `https://en.wikipedia.org${href}`);
      $a.attr('target', '_blank');
      $a.attr('rel', 'noopener noreferrer');
    } else if (href.startsWith('#')) {
      $a.removeAttr('href');
    } else if (href.startsWith('//')) {
      $a.attr('href', `https:${href}`);
      $a.attr('target', '_blank');
      $a.attr('rel', 'noopener noreferrer');
    } else if (href.startsWith('http')) {
      $a.attr('target', '_blank');
      $a.attr('rel', 'noopener noreferrer');
    }
  });

  // Promote protocol-relative image URLs to https.
  $('img').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('src');
    if (src?.startsWith('//')) {
      $img.attr('src', `https:${src}`);
    }
    // Strip srcset — those are protocol-relative too and the browser
    // resolves them against the current host (us), breaking the image.
    $img.removeAttr('srcset');
  });

  // Strip inline background/text colours from tables — Wikipedia's
  // medal-position cells (gold/silver/bronze) clash with our dark theme.
  $('table, table td, table th, table tr').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style');
    if (!style) return;
    const cleaned = style
      .split(';')
      .filter(d => d.trim() && !/background/i.test(d) && !/^\s*color\s*:/i.test(d))
      .join(';')
      .trim();
    if (cleaned) $el.attr('style', cleaned);
    else $el.removeAttr('style');
  });

  // Wrap each top-level table in a horizontal scroll container so it can't
  // push the page wider than the viewport on mobile.
  $('table').each((_, el) => {
    const $table = $(el);
    if ($table.parent('.wiki-table-scroll').length > 0) return;
    $table.addClass('wiki-table');
    $table.wrap('<div class="wiki-table-scroll"></div>');
  });

  return $.html();
}
