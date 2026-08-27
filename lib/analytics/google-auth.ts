import { kv } from '@/lib/kv';

/**
 * A Google access token from a service-account key, minted with nothing but
 * WebCrypto and `fetch`.
 *
 * WHY THIS FILE EXISTS. The GA4 and Search Console panels were deleted in
 * 0.334.27 because `@google-analytics/data` and `@googleapis/searchconsole`
 * were server imports inside server components, so they landed in the Worker
 * script: **653 KiB gzipped** of a 10 MiB budget that had 19 KiB left. Nearly
 * double what chunk analysis predicted, because the transitive `google-gax`,
 * `@grpc` and `google-auth-library` trees went with them.
 *
 * The SDKs were the cost, not the data. Both APIs are ordinary JSON over
 * HTTPS, and the only thing the SDKs were really providing was this: sign a
 * JWT with the service account's RSA key, swap it for an access token. Workers
 * ship `crypto.subtle` with `RSASSA-PKCS1-v1_5` / SHA-256, which is exactly
 * RS256 — so that is about sixty lines and **zero dependencies**.
 *
 * Node's `crypto` module is deliberately untouched here: workerd has no Node
 * crypto, and reaching for it is how a module ends up working locally and
 * failing in the deployed runtime.
 */

/** Base64url, no padding — what JWS requires and what `btoa` does not give. */
function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlText(text: string): string {
  return b64url(new TextEncoder().encode(text));
}

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

/**
 * Parse a base64-encoded service-account JSON out of an env var.
 *
 * Base64 rather than raw JSON because the key is a multi-line PEM: pasting it
 * unencoded into a secret is how newlines get mangled into `\n` literals that
 * then fail to import, silently, at the first signature.
 */
export function readServiceAccount(envVar: string): ServiceAccount | null {
  const b64 = process.env[envVar];
  if (!b64) return null;
  try {
    const json = JSON.parse(atob(b64)) as Record<string, unknown>;
    if (typeof json.client_email !== 'string' || typeof json.private_key !== 'string') return null;
    return {
      client_email: json.client_email,
      private_key: json.private_key,
      token_uri: typeof json.token_uri === 'string' ? json.token_uri : 'https://oauth2.googleapis.com/token',
    };
  } catch {
    // Malformed or not base64 — treat as unconfigured rather than throwing, so
    // the panel shows "connect" instead of taking the console down.
    return null;
  }
}

/** PEM (PKCS#8) → a WebCrypto signing key. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  const der = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) der[i] = raw.charCodeAt(i);
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

/**
 * Tokens last an hour; we keep them for 50 minutes.
 *
 * Signing is a real RSA operation against a per-request CPU budget, and every
 * panel on a page would otherwise mint its own. Cached in KV rather than a
 * module variable because Workers isolates are short-lived and numerous — a
 * module cache would miss far more often than it hit.
 */
const TOKEN_TTL_SECONDS = 50 * 60;

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * An access token for `scopes`, cached per (account, scopes).
 *
 * Returns null rather than throwing: every caller is a dashboard panel whose
 * contract is to degrade to "unavailable".
 */
export async function googleAccessToken(sa: ServiceAccount, scopes: string[]): Promise<string | null> {
  const cacheKey = `paddock:google-token:${sa.client_email}:${scopes.join(',')}`;

  if (isKvConfigured()) {
    try {
      const cached = await kv.get<string>(cacheKey);
      if (typeof cached === 'string' && cached) return cached;
    } catch {
      // Cache miss by way of outage — mint a fresh one.
    }
  }

  try {
    // `iat` one minute in the past absorbs clock skew between the Worker and
    // Google's token endpoint; a JWT issued "in the future" is rejected.
    const now = Math.floor(Date.now() / 1000) - 60;
    const header = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64urlText(
      JSON.stringify({
        iss: sa.client_email,
        scope: scopes.join(' '),
        aud: sa.token_uri,
        iat: now,
        exp: now + 3600,
      }),
    );
    const input = `${header}.${claims}`;
    const key = await importPrivateKey(sa.private_key);
    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      new TextEncoder().encode(input),
    );
    const assertion = `${input}.${b64url(signature)}`;

    const res = await fetch(sa.token_uri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    const token = data.access_token;
    if (!token) return null;

    if (isKvConfigured()) {
      try {
        await kv.set(cacheKey, token, { ex: TOKEN_TTL_SECONDS });
      } catch {
        // A token we cannot cache is still a token we can use.
      }
    }
    return token;
  } catch {
    return null;
  }
}

/** POST JSON to a Google API with a bearer token. null on any non-ok. */
export async function googleJson<T>(url: string, token: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
