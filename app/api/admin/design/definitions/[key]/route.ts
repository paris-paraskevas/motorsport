import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { isProductionWorker } from '@/lib/env';
import { DEFINITIONS, EMPTY_OVERLAY, mergeDefinition, parseOverlay, type EditableDefinition } from '@/lib/design/component-definitions';
import { DEFINITION_APPLICATION_KEY, loadDefinitionsForEditing, loadOverlayRow, loadUsage, resetDefinitionsMemo } from '@/lib/design/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT /api/admin/design/definitions/<key> ← { overlay, updatedAt: string | null }
//
// The one write path for a definition's overlay (P2.0, PR B): the key must be
// one the code defines (404); the overlay is read against it (400 with the
// problems); an attribute the previous overlay had and this one lacks is kept
// while any live page's newest or live revision carries a value for it (409,
// naming the pages: the guard of rule 10); then an insert when the caller
// loaded no row (`updatedAt` null; a row created meanwhile is 409), else one
// conditional update on the stamp the caller loaded (0 rows → 409 with the
// current list). Admin-only (404), production-only (403). No DELETE: a row is
// emptied by saving an empty overlay; the definition itself is the code's.

function refused(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

type Gate = { fail: Response; user?: undefined } | { fail: null; user: Awaited<ReturnType<typeof currentUser>> };

async function gate(): Promise<Gate> {
  const user = await currentUser();
  if (!isAdmin(user)) return { fail: new Response('not found', { status: 404 }) };
  if (!isProductionWorker()) return { fail: refused(403, 'Design edits are made on production; this copy of the site is read-only.') };
  if (!isBettingConfigured()) return { fail: refused(503, 'database not configured') };
  return { fail: null, user };
}

export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const g = await gate();
  if (g.fail) return g.fail;
  const { key } = await params;
  const shipped = DEFINITIONS.find(d => d.key === key);
  if (!shipped) return new Response('not found', { status: 404 });

  let body: { overlay?: unknown; updatedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return refused(400, 'invalid body');
  }
  if (body.updatedAt !== null && (typeof body.updatedAt !== 'string' || !body.updatedAt)) {
    return refused(400, 'updatedAt must be the stamp you loaded, or null for a definition with no row yet');
  }
  const parsed = parseOverlay(body.overlay, shipped);
  if (parsed.problems.length) return refused(400, parsed.problems.join('; '), { problems: parsed.problems });
  const overlay = parsed.value;

  // The guard: an attribute a page still carries stays. A page carries every
  // attribute of its components from its next save (the Property Editor writes
  // them all), and a key the parser no longer knows would cost the page that
  // region, so the refusal says how the key got there rather than promise a
  // way to take it off; whether a stale key should read as a warning instead is
  // the operator's question (the Inbox). The previous overlay is the row as it
  // is now, read fresh: the readers' 60-second memo is per isolate, and a stale
  // one would not know an attribute added elsewhere (the reviewer's finding).
  let previous;
  try {
    previous = (await loadOverlayRow(key))?.overlay ?? EMPTY_OVERLAY;
  } catch (err) {
    return refused(500, `The definition could not be read: ${err instanceof Error ? err.message : 'unknown'}`);
  }
  const removed = previous.attributes.filter(a => !overlay.attributes.some(x => x.key === a.key));
  const usage = (await loadUsage())[key];
  for (const a of removed) {
    const on = (usage?.usedOn ?? []).filter(p => p.attributes.includes(a.key));
    if (on.length) {
      return refused(409, `${a.label} is on ${on.length === 1 ? 'a page' : `${on.length} pages`}, ${on.map(p => p.name).join(', ')}: their regions have carried it since they were last saved. It stays while any page carries it.`, {
        current: await loadDefinitionsForEditing(),
      });
    }
  }

  try {
    let stamp: string;
    if (body.updatedAt === null) {
      const { data, error } = await betDb()
        .from('component_definition')
        .insert({ application_key: DEFINITION_APPLICATION_KEY, key, overlay, updated_by: g.user?.id ?? null })
        .select('updated_at')
        .single();
      if (error) {
        if (error.code === '23505') return refused(409, 'A row for this definition was created after you loaded it.', { current: await loadDefinitionsForEditing() });
        return refused(500, error.message);
      }
      stamp = String((data as { updated_at: string }).updated_at);
    } else {
      const { data, error } = await betDb()
        .from('component_definition')
        .update({ overlay, updated_by: g.user?.id ?? null })
        .eq('application_key', DEFINITION_APPLICATION_KEY)
        .eq('key', key)
        .eq('updated_at', body.updatedAt)
        .select('updated_at');
      if (error) return refused(500, error.message);
      const rows = (data ?? []) as { updated_at: string }[];
      if (rows.length === 0) return refused(409, 'This definition was saved again after you loaded it.', { current: await loadDefinitionsForEditing() });
      stamp = String(rows[0].updated_at);
    }
    resetDefinitionsMemo();
    const definition: EditableDefinition = {
      key,
      definition: mergeDefinition(shipped, overlay),
      overlay,
      updatedAt: stamp,
      updatedBy: g.user?.id ?? null,
      usedOn: (usage?.usedOn ?? []).map(({ id, path, name }) => ({ id, path, name })),
      regions: usage?.regions ?? 0,
    };
    return NextResponse.json({ ok: true, definition });
  } catch (err) {
    return refused(500, err instanceof Error ? err.message : 'unknown');
  }
}
