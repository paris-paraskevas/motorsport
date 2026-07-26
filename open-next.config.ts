// OpenNext Cloudflare adapter config (spike/cloudflare-opennext migration).
// Minimal for the first build + local smoke test: no incremental-cache override
// yet (defaults to in-memory), so the first build needs zero Cloudflare
// resources provisioned. R2-backed incremental cache for ISR is added before the
// real deploy — see docs: https://opennext.js.org/cloudflare/caching
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
