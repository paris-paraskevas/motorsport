import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/site';
import { ROW_PAGE_PATH, schemesAsked } from '@/lib/design/page-document';
import { resolvePage } from '@/lib/design/resolve-page';
import { findComponent } from '@/lib/design/components';
import { parseSourceRef } from '@/lib/design/sources';
import { SHAPES, findPreset, presetRows, type PresetColumn, type PresetRow } from '@/lib/design/presets';
import { readSource } from '@/lib/design/source-read';
import { REGION_ID, loadViewsFor } from '@/lib/design/views';
import { loadAuthzSchemes } from '@/lib/design/authz';
import { allowedKeys, currentVisitor } from '@/lib/design/authz-evaluate';
import { applySavedView, bindViewState, parseViewState } from '@/lib/design/view-state';
import { tableColumns } from '@/components/data/DataRegionViews';

export const runtime = 'nodejs';
// A route handler answers per request in Next 16 already; said, since the rows are never to be cached.
export const dynamic = 'force-dynamic';

// GET /api/data/csv?page=<path>&region=<id>&<state> → the rows of one Data region as CSV (P2.3 PR B; APEX: the Interactive
// Report's Download). The page is resolved as the catch-all resolves it, the region must be a Data region with Download CSV
// on, the page's and the region's authorization schemes are checked as the served page checks them (a refused reader gets
// 404, so nothing leaks), the state (sort, cols, filter, view) is read and bound as the served table reads it, and the rows
// come from the source, never the screen: as sorted, filtered and columned, at most CSV_MAX. RFC 4180 text, UTF-8 with a
// byte-order mark for the spreadsheets that want one, CRLF, a header row of the columns' labels; a date as the source says
// it (ISO), a link as its address.
export const CSV_MAX = 5000;

const cell = (v: PresetRow[string]): string => (v === null || v === undefined ? '' : String(v));
const quote = (s: string): string => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** The CSV of the columns over the rows: a link column's address made absolute when it is a path of this site. */
export function csvOf(columns: readonly PresetColumn[], rows: readonly PresetRow[]): string {
  const line = (cells: readonly string[]) => cells.map(quote).join(',');
  const value = (c: PresetColumn, r: PresetRow): string => {
    if (c.type === 'link') {
      const href = c.href ? cell(r[c.href]) : '';
      return href.startsWith('/') ? `${SITE_URL}${href}` : href;
    }
    return cell(r[c.key]);
  };
  return [line(columns.map(c => c.label)), ...rows.map(r => line(columns.map(c => value(c, r))))].join('\r\n') + '\r\n';
}

const notFound = () => new NextResponse('Not found', { status: 404 });

export async function GET(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const path = u.searchParams.get('page') ?? '';
  const regionId = u.searchParams.get('region') ?? '';
  if (!ROW_PAGE_PATH.test(path) || !REGION_ID.test(regionId)) return notFound();
  const r = await resolvePage(path);
  if (!r) return notFound();
  const region = r.document.regions.find(x => x.kind === 'component' && x.component === 'data.region' && x.id === regionId);
  if (!region || region.kind !== 'component' || region.settings.download !== true) return notFound();

  const asked = schemesAsked(r.page.authz, r.document);
  if (asked.length > 0) {
    const [visitor, schemes] = await Promise.all([currentVisitor(), loadAuthzSchemes()]);
    const allowed = allowedKeys(asked, schemes, visitor);
    const pageScheme = r.page.authz && r.page.authz !== 'public' ? r.page.authz : null;
    if ((pageScheme && !allowed.has(pageScheme)) || (region.authz && !allowed.has(region.authz))) return notFound();
  }

  const spec = findComponent('data.region');
  const source = region.source && spec?.sources?.length ? parseSourceRef(region.source, spec.sources).value : null;
  const preset = findPreset(typeof region.settings.preset === 'string' ? region.settings.preset : '');
  if (!source || !preset) return notFound();
  const shape = SHAPES[preset.shape];
  const url = bindViewState(parseViewState(u.searchParams).value, shape);
  const saved = url.view !== undefined && r.page.id ? (await loadViewsFor(r.page.id, regionId)).find(v => v.key === url.view) : undefined;
  const state = bindViewState(applySavedView(url, saved ? saved.definition : null), shape);

  const read = await readSource(source);
  const rows = presetRows(read.rows, preset, CSV_MAX, state);
  const columns = tableColumns(shape, preset, rows, state.cols);
  const slug = path.split('/').filter(Boolean).join('-');
  return new NextResponse(`\uFEFF${csvOf(columns, rows)}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-${regionId}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
