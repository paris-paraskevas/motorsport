import { describe, it, expect } from 'vitest';
import { isAllowedPushEndpoint } from './push-hosts';

const u = (s: string) => new URL(s);

describe('isAllowedPushEndpoint', () => {
  it('accepts real Web Push service endpoints', () => {
    expect(isAllowedPushEndpoint(u('https://fcm.googleapis.com/fcm/send/abc123'))).toBe(true);
    expect(
      isAllowedPushEndpoint(u('https://updates.push.services.mozilla.com/wpush/v2/xyz')),
    ).toBe(true);
    expect(
      isAllowedPushEndpoint(u('https://autopush.services.mozilla.com/wpush/v1/foo')),
    ).toBe(true);
    expect(isAllowedPushEndpoint(u('https://web.push.apple.com/QABC/def'))).toBe(true);
    expect(isAllowedPushEndpoint(u('https://abc.push.apple.com/token'))).toBe(true);
    expect(isAllowedPushEndpoint(u('https://xyz.notify.windows.com/w/?token=1'))).toBe(true);
  });

  it('accepts subdomains of allowlisted parent domains', () => {
    expect(
      isAllowedPushEndpoint(u('https://push-1.autopush.services.mozilla.com/wpush/v1/a')),
    ).toBe(true);
    expect(isAllowedPushEndpoint(u('https://sub.push.services.mozilla.com/x'))).toBe(true);
  });

  it('rejects look-alike hosts that merely contain an allowed host as a substring', () => {
    // The classic bypass: attacker registers a domain that ends with the trusted
    // token as a label prefix, not on a dot boundary.
    expect(isAllowedPushEndpoint(u('https://fcm.googleapis.com.evil.com/x'))).toBe(false);
    expect(isAllowedPushEndpoint(u('https://web.push.apple.com.attacker.net/x'))).toBe(false);
    expect(isAllowedPushEndpoint(u('https://notify.windows.com.evil.com/x'))).toBe(false);
    expect(isAllowedPushEndpoint(u('https://evilfcm.googleapis.com/x'))).toBe(false);
    expect(isAllowedPushEndpoint(u('https://myfcm.googleapis.com/x'))).toBe(false);
  });

  it('rejects arbitrary and internal/SSRF-flavoured hosts', () => {
    expect(isAllowedPushEndpoint(u('https://evil.example.com/collect'))).toBe(false);
    expect(isAllowedPushEndpoint(u('https://169.254.169.254/latest/meta-data/'))).toBe(false);
    expect(isAllowedPushEndpoint(u('https://localhost/x'))).toBe(false);
    expect(isAllowedPushEndpoint(u('https://127.0.0.1/x'))).toBe(false);
  });

  it('rejects non-https schemes even for allowlisted hosts', () => {
    expect(isAllowedPushEndpoint(u('http://fcm.googleapis.com/fcm/send/abc'))).toBe(false);
    expect(isAllowedPushEndpoint(u('ftp://web.push.apple.com/x'))).toBe(false);
  });

  it('is case-insensitive on the host', () => {
    expect(isAllowedPushEndpoint(u('https://FCM.GoogleAPIs.com/fcm/send/abc'))).toBe(true);
  });
});
