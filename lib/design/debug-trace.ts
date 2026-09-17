import 'server-only';
import { Collector, type DebugLevel, type DebugReport } from './debug';
import { resolvePage } from './resolve-page';
import { loadRevisionPreview } from './live-page';
import { composedDocument } from './composed-page';
import { loadAuthzSchemes } from './authz';
import { allowedKeys, currentVisitor } from './authz-evaluate';
import { applyBuildOptions, applyShow, documentRefs, passesShow, schemesAsked, showAsks, type PageDocument, type Region } from './page-document';
import { loadBuildOptions } from './build-options';
import { READS, raceWeekendNow, renderComponents, type RenderPage } from './component-render';
import { findComponent } from './components';
import { loadComponents } from './definitions';
import { readSnapshotMeta, type SnapshotMeta } from '@/lib/source-snapshot';

// The Debug trace (P1.9; APEX: View Debug's report of a page's render, the
// Debugging chapter, run 13): the page's pipeline run again for the developer,
// exactly as the catch-all runs it for a visitor, with a collector on every
// step. The nodes are discarded; the timings, the rule verdicts and the sources
// are the trace. Produced on demand by the admin route, never on a visitor's
// render, so a cached page stays the same cached render.

export type TraceTarget = { path: string } | { revisionId: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const name = (r: Region) => r.title || r.id;

/** The loader runs behind a component's declared sources: each `snapshot:` or
 *  `kv:` prefix matched against the keys the loader wrote meta for. */
function runsFor(src: readonly string[], meta: Readonly<Record<string, SnapshotMeta>>): string | undefined {
  const lines: string[] = [];
  for (const s of src) {
    const m = s.match(/^(?:snapshot|kv):(.+)$/);
    if (!m) continue;
    for (const [key, info] of Object.entries(meta)) {
      if (!key.startsWith(m[1])) continue;
      const phases = [info.F !== undefined ? `F ${info.F}ms` : null, info.W !== undefined ? `W ${info.W}ms` : null].filter(Boolean).join(' · ');
      lines.push(`${key} · ${info.run} · ${info.at.replace('T', ' ').slice(0, 16)}Z${phases ? ` · ${phases}` : ''}`);
    }
  }
  return lines.length ? lines.join('\n') : undefined;
}

export async function tracePage(target: TraceTarget, level: DebugLevel, cid: string): Promise<DebugReport | null> {
  const label = 'path' in target ? target.path : `revision ${target.revisionId.slice(0, 8)}`;
  const d = new Collector(cid, level, label);

  const resolved = await d.step(4, 'resolve', label, async (): Promise<{ page: RenderPage['page'] & { authz: string | null; name: string }; document: PageDocument; where: RenderPage } | null> => {
    if ('path' in target) {
      const r = await resolvePage(target.path);
      if (!r) return null;
      const where: RenderPage = r.kind === 'composed' ? { path: r.pattern, params: r.params, page: r.page } : { path: target.path, params: {}, page: r.page };
      return { page: r.page, document: r.document, where };
    }
    const p = await loadRevisionPreview(target.revisionId);
    if (!p) return null;
    // Only a code page served from rows adopts a recipe; a row page is traced as stored (the preview's rule, P1.13).
    const document = p.page.kind !== 'row' ? composedDocument(p.document, p.page.path) : p.document;
    return { page: p.page, document, where: { path: p.page.path, params: {}, page: p.page } };
  });
  if (!resolved) return null;
  const { page, document: doc, where } = resolved;
  d.note(4, 'resolve', `${page.name}: ${plural(doc.regions.length, 'region')}, ${plural(doc.actions.length, 'dynamic action')}`);

  // The session: a live render reads it only when a scheme or a show rule asks; the trace always says who is tracing.
  const asked = schemesAsked(page.authz, doc);
  const asks = showAsks(doc);
  const [visitor, schemes] = await d.step(
    4,
    'session',
    asked.length > 0 || asks.visitor ? `the visitor, for ${plural(asked.length, 'scheme')}${asks.visitor ? ' and a show rule' : ''}` : 'the visitor (nothing asks; a live render skips this and stays cached)',
    () => Promise.all([currentVisitor(), asked.length > 0 ? loadAuthzSchemes() : Promise.resolve([])]),
  );
  d.note(6, 'session', visitor.signedIn ? `signed in${visitor.role ? ` as ${visitor.role}` : ''}` : 'signed out');

  // Authorization: the page's scheme, then every region's (APEX: which authorization schemes fired).
  const allowed = allowedKeys(asked, schemes, visitor);
  const pageScheme = page.authz && page.authz !== 'public' ? page.authz : null;
  d.note(4, 'authz', pageScheme ? `page scheme ${pageScheme}: ${allowed.has(pageScheme) ? 'allowed' : 'refused'} for you` : 'the page is public');
  for (const r of doc.regions) {
    if (r.authz && r.authz !== 'public') d.note(6, `authz:${r.id}`, `${name(r)}: scheme ${r.authz} ${allowed.has(r.authz) ? 'allowed' : 'refused'} for you`);
  }

  // Show rules (APEX: which conditions fired), with the facts they read.
  const raceWeekend = asks.calendar ? await d.step(6, 'show', 'the race-weekend fact', () => raceWeekendNow()) : null;
  const showCtx = { signedIn: visitor.signedIn, raceWeekend };
  const shown = applyShow(doc, showCtx);
  // A sub region (P1.4) leaves with its parent, whatever its own rule or option says.
  const parentName = (r: Region) => {
    const p = doc.regions.find(x => x.id === r.parent);
    return p ? name(p) : (r.parent ?? 'its parent');
  };
  d.note(4, 'show', `${plural(doc.regions.length - shown.regions.length, 'region')} hidden by a show rule (signed in: ${visitor.signedIn}; race weekend: ${raceWeekend === null ? 'not asked' : raceWeekend})`);
  for (const r of doc.regions) {
    if (!shown.regions.some(x => x.id === r.id)) d.note(6, `show:${r.id}`, passesShow(r.show, showCtx) ? `${name(r)} left with its parent ${parentName(r)}` : `${name(r)} hidden by the rule ${r.show ?? 'always'}`);
  }

  // Build options (P1.3) and Comment Out (P1.11): an Excluded or a commented-out region leaves before it is drawn, at this one step.
  const options = await d.step(6, 'build', 'the build options', () => loadBuildOptions());
  const built = applyBuildOptions(shown, options);
  const dropped = shown.regions.filter(r => !built.regions.some(x => x.id === r.id));
  const excluded = (r: Region) => r.buildOption !== undefined && options[r.buildOption] === 'exclude';
  const commented = dropped.filter(r => r.commentedOut).length;
  const byOption = dropped.filter(r => !r.commentedOut && excluded(r)).length;
  const withParent = dropped.length - commented - byOption;
  d.note(4, 'build', `${plural(byOption, 'region')} excluded by a build option, ${commented} commented out${withParent ? `, ${withParent} left with a parent` : ''}`);
  for (const r of dropped) d.note(6, `build:${r.id}`, r.commentedOut ? `${name(r)} commented out` : excluded(r) ? `${name(r)} excluded by ${r.buildOption}` : `${name(r)} left with its parent ${parentName(r)}`);

  // What the regions name: shortcuts, photos, lists.
  const refs = documentRefs(built, await loadComponents());
  d.note(4, 'refs', `${plural(refs.shortcuts.length, 'shortcut')}, ${plural(refs.assets.length, 'photo')}, ${plural(refs.lists.length, 'list')}`);
  if (level >= 9) d.note(9, 'refs', [...refs.shortcuts, ...refs.assets, ...refs.lists].join(', ') || 'none');

  // The components, each timed, with the sources it declares and the loader runs behind them.
  const rendered: { id: string; component: string; ms: number; ok: boolean }[] = [];
  const components = built.regions.filter(r => r.kind === 'component');
  await d.step(4, 'render', plural(components.length, 'component'), () =>
    renderComponents(built, where, { onRendered: (id, component, ms, ok) => rendered.push({ id, component, ms, ok }) }),
  );
  const meta = level >= 6 && rendered.length > 0 ? await d.step(6, 'render', "the loader's runs behind the sources", () => readSnapshotMeta()) : {};
  for (const c of rendered) {
    const src = READS[c.component] ?? [];
    d.note(4, `render:${c.id}`, `${findComponent(c.component)?.name ?? c.component}${c.ok ? '' : ' failed and drew nothing'}`, { ms: c.ms, src, run: level >= 6 ? runsFor(src, meta) : undefined });
    if (level >= 9) {
      const r = built.regions.find(x => x.id === c.id);
      if (r && r.kind === 'component') d.note(9, `render:${c.id}`, `settings ${JSON.stringify(r.settings)}`);
    }
  }
  return d.report();
}
