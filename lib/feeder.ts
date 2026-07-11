import { betDb, isBettingConfigured } from './betting/client';
import { sendEmail, renderBrandedEmail } from './email';
import { SITE_URL, SITE_TITLE } from './site';

// Server-only. Feeder-series self-serve data intake (design doc:
// docs/research/2026-07-06-feeder-series-intake.md). A public, ANONYMOUS submit
// surface (/contribute + POST /api/contribute) lets a feeder championship hand us
// their schedule/results data in any format; each submission lands in
// `series_submission` (RLS-on / no-policies / service_role-only) for the operator
// to review + curate into content/series/<slug>. No account, no app_user FK.
//
// MVP storage: the attached file is stored inline as base64 in the row, capped
// small (FILE_MAX_BYTES). Supabase Storage + signed upload URLs is the Phase-2
// upgrade for larger files; until then, larger data uses the `data_url` link.

export type SubmissionStatus = 'new' | 'reviewing' | 'ingested' | 'rejected';

export interface SeriesSubmission {
  id: string;
  seriesName: string;
  contactEmail: string;
  season: string | null;
  note: string | null;
  dataUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  status: SubmissionStatus;
  createdAt: string;
}

// Validation limits + the accepted-file allow-list (design decision #2).
export const SERIES_NAME_MAX = 120;
export const SEASON_MAX = 40;
export const NOTE_MAX = 4000;
export const URL_MAX = 500;
export const EMAIL_MAX = 200;
// 2 MB decoded — comfortably under Vercel's ~4.5 MB request-body limit once
// base64-encoded (~1.37x). Larger files paste a link instead until Storage lands.
export const FILE_MAX_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf', '.json', '.txt', '.tsv'] as const;

export interface SubmissionInput {
  seriesName: string;
  contactEmail: string;
  season?: string | null;
  note?: string | null;
  dataUrl?: string | null;
  file?: { name: string; type: string; dataBase64: string } | null;
  refToken?: string | null;
}

export interface CleanSubmission {
  series_name: string;
  contact_email: string;
  season: string | null;
  note: string | null;
  data_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  file_data: string | null;
  ref_token: string | null;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  clean?: CleanSubmission;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True if the string holds any C0 control char (code < 32, incl. CR/LF/TAB).
 *  Kept out of the series name so it can't inject headers into the notification
 *  email subject. Char-code check — no control chars in the source. */
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 32) return true;
  }
  return false;
}

/** Decoded byte length of a base64 string (pure arithmetic — no atob/Buffer). */
export function base64Bytes(b64: string): number {
  const len = b64.length;
  if (len === 0) return 0;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

/** Pure validation + normalization of a public submission. No I/O — unit-tested. */
export function validateSubmission(input: SubmissionInput): ValidationResult {
  const seriesName = (input.seriesName ?? '').trim();
  const contactEmail = (input.contactEmail ?? '').trim();
  const season = (input.season ?? '').trim();
  const note = (input.note ?? '').trim();
  const dataUrl = (input.dataUrl ?? '').trim();
  const refToken = (input.refToken ?? '').trim();

  if (!seriesName || seriesName.length > SERIES_NAME_MAX || hasControlChar(seriesName))
    return { ok: false, error: `series name is required (max ${SERIES_NAME_MAX} characters)` };
  if (!contactEmail || contactEmail.length > EMAIL_MAX || /\s/.test(contactEmail) || !EMAIL_RE.test(contactEmail))
    return { ok: false, error: 'a valid contact email is required' };
  if (season.length > SEASON_MAX) return { ok: false, error: `season is too long (max ${SEASON_MAX})` };
  if (note.length > NOTE_MAX) return { ok: false, error: `note is too long (max ${NOTE_MAX})` };
  if (dataUrl) {
    if (dataUrl.length > URL_MAX) return { ok: false, error: `link is too long (max ${URL_MAX})` };
    if (!/^https?:\/\//i.test(dataUrl)) return { ok: false, error: 'link must start with http:// or https://' };
  }

  let file_name: string | null = null;
  let file_type: string | null = null;
  let file_size: number | null = null;
  let file_data: string | null = null;

  if (input.file && input.file.dataBase64) {
    const name = (input.file.name ?? '').trim().slice(0, 200) || 'upload';
    const ext = extOf(name);
    if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number]))
      return { ok: false, error: `file type not accepted (allowed: ${ACCEPTED_EXTENSIONS.join(', ')})` };
    const b64 = input.file.dataBase64;
    // Reject anything that isn't plain base64 (a data: URL prefix, whitespace, …).
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, error: 'malformed file data' };
    const bytes = base64Bytes(b64);
    if (bytes === 0) return { ok: false, error: 'attached file is empty' };
    if (bytes > FILE_MAX_BYTES)
      return {
        ok: false,
        error: `file too large (max ${Math.round(FILE_MAX_BYTES / (1024 * 1024))} MB) — paste a link instead`,
      };
    file_name = name;
    // MIME type sanitised to safe chars — it flows into a Content-Type response
    // header on the admin download; a raw CR/LF here would 500 that route.
    file_type = (input.file.type ?? '').replace(/[^\w.+/-]/g, '').slice(0, 100) || 'application/octet-stream';
    file_size = bytes;
    file_data = b64;
  }

  // Must give us something to work with: a file or a link.
  if (!file_data && !dataUrl) return { ok: false, error: 'attach a data file or paste a link to your data' };

  return {
    ok: true,
    clean: {
      series_name: seriesName,
      contact_email: contactEmail,
      season: season || null,
      note: note || null,
      data_url: dataUrl || null,
      file_name,
      file_type,
      file_size,
      file_data,
      ref_token: refToken ? refToken.slice(0, 100) : null,
    },
  };
}

function toSubmission(r: Record<string, unknown>): SeriesSubmission {
  return {
    id: r.id as string,
    seriesName: r.series_name as string,
    contactEmail: r.contact_email as string,
    season: (r.season as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    dataUrl: (r.data_url as string | null) ?? null,
    fileName: (r.file_name as string | null) ?? null,
    fileType: (r.file_type as string | null) ?? null,
    fileSize: (r.file_size as number | null) ?? null,
    status: r.status as SubmissionStatus,
    createdAt: r.created_at as string,
  };
}

/** Persist a validated submission. Returns the new row id + the cleaned fields,
 *  or an error string (validation errors are client-fixable; DB errors carry
 *  "failed:"). Server-only. */
export async function createSeriesSubmission(
  input: SubmissionInput,
): Promise<{ id: string; clean: CleanSubmission } | { error: string }> {
  const v = validateSubmission(input);
  if (!v.ok || !v.clean) return { error: v.error ?? 'invalid submission' };
  if (!isBettingConfigured()) return { error: 'submissions are not configured' };
  try {
    const { data, error } = await betDb()
      .from('series_submission')
      .insert(v.clean)
      .select('id')
      .single();
    if (error) return { error: `createSeriesSubmission failed: ${error.message}` };
    return { id: data.id as string, clean: v.clean };
  } catch (e) {
    return { error: `createSeriesSubmission failed: ${e instanceof Error ? e.message : 'db error'}` };
  }
}

/** Recent submissions (metadata only — never the base64 blob), newest first.
 *  Fail-soft for the admin dashboard. */
export async function listSeriesSubmissions(limit = 20): Promise<SeriesSubmission[]> {
  if (!isBettingConfigured()) return [];
  try {
    const { data, error } = await betDb()
      .from('series_submission')
      .select('id, series_name, contact_email, season, note, data_url, file_name, file_type, file_size, status, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(toSubmission);
  } catch {
    return [];
  }
}

/** The stored file for one submission (admin download). null if none / unconfigured. */
export async function getSubmissionFile(
  id: string,
): Promise<{ name: string; type: string; dataBase64: string } | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('series_submission')
      .select('file_name, file_type, file_data')
      .eq('id', id)
      .single();
    if (error || !data || !data.file_data) return null;
    return {
      name: (data.file_name as string | null) ?? 'submission',
      type: (data.file_type as string | null) ?? 'application/octet-stream',
      dataBase64: data.file_data as string,
    };
  } catch {
    return null;
  }
}

/** Best-effort operator notification (CONTACT_TO_EMAIL). Echoes submitter content
 *  — safe, it lands in the operator's own inbox. Never throws. */
export async function notifyNewSubmission(item: {
  seriesName: string;
  contactEmail: string;
  season: string | null;
  note: string | null;
  dataUrl: string | null;
  fileName: string | null;
}): Promise<void> {
  const paragraphs: string[] = [`Series: ${item.seriesName}`, `Contact: ${item.contactEmail}`];
  if (item.season) paragraphs.push(`Season: ${item.season}`);
  if (item.fileName) paragraphs.push(`File: ${item.fileName}`);
  if (item.dataUrl) paragraphs.push(`Link: ${item.dataUrl}`);
  if (item.note) paragraphs.push(`Note: ${item.note}`);
  const { html, text } = renderBrandedEmail({
    preheader: `New feeder-series submission — ${item.seriesName}`,
    heading: 'New feeder-series submission',
    intro: `${item.seriesName} · ${item.contactEmail}`,
    paragraphs,
    cta: { label: 'Review in the admin dashboard', href: `${SITE_URL}/admin#submissions` },
    footerNote: 'A feeder series submitted data through /contribute.',
  });
  await sendEmail({ subject: `[Feeder intake] ${item.seriesName}`, text, html });
}

/** Best-effort receipt to the submitter. Receipt-only — never echoes their
 *  content (the address is submitter-supplied; echoing would make us a relay). */
export async function ackSubmission(toEmail: string, seriesName: string): Promise<void> {
  const { html, text } = renderBrandedEmail({
    preheader: 'Thanks — we’ve got your data.',
    heading: 'Thanks — we’ve got your submission',
    paragraphs: [
      `Thanks for sending ${SITE_TITLE} the data for ${seriesName}. We’ve received it and will review it.`,
      'If we need anything else to add your series, we’ll reply to this address.',
    ],
    cta: { label: 'Open Paddock', href: `${SITE_URL}/app` },
    footerNote: `You’re receiving this because you submitted series data at ${SITE_URL.replace(/^https?:\/\//, '')}/contribute.`,
  });
  await sendEmail({ to: toEmail, subject: `We’ve got your submission — ${SITE_TITLE}`, text, html });
}
