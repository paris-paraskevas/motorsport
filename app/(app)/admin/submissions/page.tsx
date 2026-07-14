import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-guard';
import { listSeriesSubmissions } from '@/lib/feeder';
import { AdminPageHeader, SubmissionRow } from '@/components/admin/AdminUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Submissions · Admin' };

// Submissions route: feeder-series data intake from /contribute. Metadata only —
// the base64 file blob is never inlined here; downloads go through the admin-gated
// /api/admin/submissions/[id] route. Fail-soft to an empty list.
export default async function AdminSubmissionsPage() {
  await requireAdmin();
  const submissions = await listSeriesSubmissions(20);

  return (
    <div>
      <AdminPageHeader
        title="Submissions"
        tagline={submissions.length ? `Feeder-series intake · ${submissions.length} on file` : 'Feeder-series intake'}
      />
      {submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-6 text-center">
          <p className="text-sm text-text-muted">
            Series that send their data via{' '}
            <Link href="/contribute" className="text-brand hover:underline">
              /contribute
            </Link>{' '}
            land here for review. None yet.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
          <ul className="divide-y divide-border">
            {submissions.map(s => (
              <SubmissionRow key={s.id} s={s} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
