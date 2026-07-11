import { currentUser } from '@clerk/nextjs/server';
import { isAdmin } from '@/lib/threads';
import { getSubmissionFile } from '@/lib/feeder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin-only download of a feeder submission's attached file. The base64 blob is
// never exposed in the /admin page HTML — the dashboard links here, and this
// route decodes + streams it as an attachment. 404s for non-admins (same shape
// as the page gate, no existence oracle).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(await currentUser())) return new Response('not found', { status: 404 });
  const { id } = await params;
  const file = await getSubmissionFile(id);
  if (!file) return new Response('not found', { status: 404 });

  const bytes = Buffer.from(file.dataBase64, 'base64');
  const safeName = file.name.replace(/[^\w.\-]+/g, '_') || 'submission';
  return new Response(bytes, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
