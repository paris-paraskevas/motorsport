import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The wrapper is the seam: the operator's message goes first, the visitor's
// acknowledgement second, both through sendEmail.
const sendEmail = vi.fn<(opts: unknown) => Promise<{ ok: boolean; error?: string }>>();
vi.mock('@/lib/email', () => ({
  sendEmail: (opts: unknown) => sendEmail(opts),
  renderBrandedEmail: () => ({ html: '<p>x</p>', text: 'x' }),
}));
const kvSet = vi.fn(async () => 'OK');
vi.mock('@/lib/kv', () => ({ kv: { set: (...args: unknown[]) => kvSet(...(args as [])) } }));
vi.mock('@/lib/rate-limit', () => ({ allowRequest: async () => true, clientIp: () => '203.0.113.9' }));
vi.mock('@/lib/auth/server', () => ({ accountId: async () => null }));

import { POST } from './route';

const post = (body: unknown) =>
  POST(
    new Request('https://paddock-tracker.com/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
const VALID = { email: 'reader@example.com', message: 'The results box spills past my phone screen.', category: 'bug' };

describe('POST /api/contact', () => {
  let error: ReturnType<typeof vi.spyOn>;
  const env = { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  beforeEach(() => {
    sendEmail.mockReset();
    kvSet.mockClear();
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });
  afterEach(() => {
    error.mockRestore();
    if (env.url === undefined) delete process.env.KV_REST_API_URL; else process.env.KV_REST_API_URL = env.url;
    if (env.token === undefined) delete process.env.KV_REST_API_TOKEN; else process.env.KV_REST_API_TOKEN = env.token;
  });

  it('answers emailed: true once Resend took the operator’s message (reply-to the visitor, the category in the subject), then acknowledges the visitor; nothing logged', async () => {
    sendEmail.mockResolvedValue({ ok: true });
    const res = await post(VALID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, stored: false, emailed: true });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({
      replyTo: 'reader@example.com',
      subject: '[Bug report] Paddock Tracker contact from reader@example.com',
    });
    expect(sendEmail.mock.calls[1][0]).toMatchObject({ to: 'reader@example.com' });
    expect(error).not.toHaveBeenCalled();
  });

  it('a failed send with the store in place: emailed: false, stored: true, the failure named in the log with its phase, so a missing secret or a refused key is seen at the next tail instead of lost', async () => {
    process.env.KV_REST_API_URL = 'https://kv.test';
    process.env.KV_REST_API_TOKEN = 'token';
    sendEmail.mockResolvedValue({ ok: false, error: 'resend not configured' });
    const res = await post(VALID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, stored: true, emailed: false });
    expect(kvSet).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('[contact] send failed: resend not configured');
  });

  it('a failed send with no store answers 503 and sends no acknowledgement: a message nothing kept is not “received”', async () => {
    sendEmail.mockResolvedValue({ ok: false, error: 'resend 403: domain not verified' });
    const res = await post(VALID);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'the message could not be delivered; try again later' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('[contact] send failed: resend 403: domain not verified');
  });
});
