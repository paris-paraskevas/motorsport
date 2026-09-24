import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth/server';
import { isAdmin } from '@/lib/threads';
import { isBettingConfigured } from '@/lib/betting/client';
import { loadDefinitionsForEditing } from '@/lib/design/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/design/definitions → { definitions: EditableDefinition[] }
//
// The component definitions for the Plug-ins page (P2.0, PR B): the code's,
// merged with their rows, with Utilization and History. Admin-only (404).
// Writes are ./[key]/route.ts.
export async function GET() {
  if (!isAdmin(await currentAccount())) return new Response('not found', { status: 404 });
  if (!isBettingConfigured()) {
    return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  }
  const definitions = await loadDefinitionsForEditing();
  if (!definitions) return NextResponse.json({ error: 'the definitions could not be read' }, { status: 500 });
  return NextResponse.json({ definitions });
}
