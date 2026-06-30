import { INDEXNOW_KEY, INDEXNOW_KEY_LOCATION, SITE_URL } from './site';

const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const BATCH_SIZE = 1000;

// IndexNow is a fire-and-forget hint, not a critical path. Failures log
// and continue — never throw, never block a caller, never raise.
export async function submitUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const host = new URL(SITE_URL).host;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host,
          key: INDEXNOW_KEY,
          keyLocation: INDEXNOW_KEY_LOCATION,
          urlList: batch,
        }),
      });
      if (!res.ok) {
        console.warn(
          `[indexnow] ${res.status} ${res.statusText} on batch of ${batch.length}`,
        );
      } else {
        console.log(`[indexnow] accepted ${batch.length} URLs (HTTP ${res.status})`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[indexnow] request failed: ${message}`);
    }
  }
}
