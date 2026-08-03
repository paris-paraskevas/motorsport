import { betDb } from './betting/client';
import { sendEmail, renderBrandedEmail } from './email';
import { SITE_URL } from './site';

// Server-only. Become-an-author applications (item 14): a signed-in reader
// pitches on /write-for-us, the operator decides on /admin/users. Approval's
// role grant (Clerk publicMetadata.role = 'contributor') lives in the admin API
// route, not here — this module owns the rows and the emails. Mirrors lib/blog's
// contract style: validation before the DB, status-guarded exact-count updates,
// and notify functions that are best-effort by construction (callers wrap in
// after(); a mail hiccup never fails the action that triggered it).

export type AuthorRequestStatus = 'pending' | 'approved' | 'declined';

export interface AuthorRequest {
  id: string;
  clerkUserId: string;
  displayName: string;
  pitch: string;
  links: string | null;
  sample: string | null;
  status: AuthorRequestStatus;
  createdAt: string;
}

export const PITCH_MAX = 2000;
export const LINKS_MAX = 1000;
export const SAMPLE_MAX = 8000;
const NAME_MAX = 140;

const COLS = 'id, clerk_user_id, display_name, pitch, links, sample, status, created_at';

function toRequest(r: Record<string, unknown>): AuthorRequest {
  return {
    id: r.id as string,
    clerkUserId: r.clerk_user_id as string,
    displayName: r.display_name as string,
    pitch: r.pitch as string,
    links: (r.links as string | null) ?? null,
    sample: (r.sample as string | null) ?? null,
    status: r.status as AuthorRequestStatus,
    createdAt: r.created_at as string,
  };
}

export interface AuthorRequestInput {
  displayName: string;
  pitch: string;
  links?: string | null;
  sample?: string | null;
}

/** File an application. One pending per account (DB partial-unique backstop; the
 *  friendly duplicate message is raised here first). A previously declined
 *  applicant may re-apply. */
export async function createAuthorRequest(clerkUserId: string, input: AuthorRequestInput): Promise<string> {
  const displayName = input.displayName.trim();
  const pitch = input.pitch.trim();
  const links = input.links?.trim() || null;
  const sample = input.sample?.trim() || null;
  if (!displayName || displayName.length > NAME_MAX) throw new Error(`name must be 1–${NAME_MAX} characters`);
  if (!pitch || pitch.length > PITCH_MAX) throw new Error(`pitch must be 1–${PITCH_MAX} characters`);
  if (links && links.length > LINKS_MAX) throw new Error(`links must be at most ${LINKS_MAX} characters`);
  if (sample && sample.length > SAMPLE_MAX) throw new Error(`sample must be at most ${SAMPLE_MAX} characters`);

  const db = betDb();
  const { data: dupe } = await db
    .from('author_request')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .eq('status', 'pending')
    .maybeSingle();
  if (dupe) throw new Error('application already in review');

  const { data, error } = await db
    .from('author_request')
    .insert({ clerk_user_id: clerkUserId, display_name: displayName, pitch, links, sample })
    .select('id')
    .single();
  if (error) throw new Error(`createAuthorRequest failed: ${error.message}`);
  return data.id as string;
}

/** Applications in a status, oldest first — the queue reads pending in arrival
 *  order, first come first read. */
export async function listAuthorRequests(status: AuthorRequestStatus = 'pending'): Promise<AuthorRequest[]> {
  const { data, error } = await betDb()
    .from('author_request')
    .select(COLS)
    .eq('status', status)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listAuthorRequests failed: ${error.message}`);
  return (data ?? []).map(toRequest);
}

/** One application by id, or null. */
export async function getAuthorRequestById(id: string): Promise<AuthorRequest | null> {
  const { data, error } = await betDb().from('author_request').select(COLS).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return toRequest(data);
}

/** Decide a pending application. Status-guarded with an exact count so a
 *  double-click or race can't re-decide; the caller (admin API route) grants the
 *  Clerk role BEFORE flipping the row, so a granted-but-unrecorded state is the
 *  crash shape rather than recorded-but-ungranted (the queue re-lists the former,
 *  the latter would silently strand the applicant). */
export async function decideAuthorRequest(id: string, adminId: string, approve: boolean): Promise<void> {
  const { error, count } = await betDb()
    .from('author_request')
    .update(
      { status: approve ? 'approved' : 'declined', decided_by: adminId, decided_at: new Date().toISOString() },
      { count: 'exact' },
    )
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw new Error(`decideAuthorRequest failed: ${error.message}`);
  if (!count) throw new Error('application is not pending (already decided?)');
}

/** Tell the operator an application arrived. Email only — this is operational
 *  mail to the site inbox, same channel as the blog review alert. */
export async function notifyAdminsAuthorRequest(req: { displayName: string; pitch: string }): Promise<void> {
  const { html, text } = renderBrandedEmail({
    preheader: 'Someone wants to write for Paddock.',
    heading: 'Author application',
    intro: req.displayName,
    paragraphs: [
      req.pitch.length > 400 ? `${req.pitch.slice(0, 400)}…` : req.pitch,
      'Approve or decline it from the admin console; approval grants studio access immediately.',
    ],
    cta: { label: 'Review the application', href: `${SITE_URL}/admin/users` },
  });
  await sendEmail({ subject: `[Authors] Application: ${req.displayName}`, text, html });
}

/** Tell the applicant what was decided. Approved mail carries the studio link —
 *  the next step is writing, not searching for where to write. */
export async function notifyApplicantDecision(args: {
  to: string;
  displayName: string;
  approved: boolean;
}): Promise<void> {
  const { html, text } = args.approved
    ? renderBrandedEmail({
        preheader: 'You can start writing now.',
        heading: 'Welcome to Paddock',
        intro: args.displayName,
        paragraphs: [
          'Your application is approved. Your account can now draft posts in the studio and submit them for review; an editor schedules what goes live.',
          'Set up your public author page from your account settings when you are ready.',
        ],
        cta: { label: 'Open the studio', href: `${SITE_URL}/studio` },
      })
    : renderBrandedEmail({
        preheader: 'About your application.',
        heading: 'Thanks for applying',
        intro: args.displayName,
        paragraphs: [
          'We read your application and will not be taking it further right now. You are welcome to apply again with new work.',
        ],
      });
  await sendEmail({
    to: args.to,
    subject: args.approved ? 'You can write for Paddock' : 'About your Paddock application',
    text,
    html,
  });
}
