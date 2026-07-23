'use client';

import { useState, useSyncExternalStore } from 'react';
import { Link2, Check, Share2 } from 'lucide-react';

// navigator.share is a client-only capability; a stable no-op subscribe lets
// useSyncExternalStore read it once (it never changes during a session).
const noopSubscribe = () => () => {};

// Sidebar share controls for a blog post. Copy-link + the native Web Share sheet
// need browser APIs, so this is the one interactive island on the otherwise-
// static post page; the network intents (Facebook / WhatsApp / X) are plain links
// that work anywhere. Instagram has no web share-intent URL, so it is reachable
// only through the native share sheet (mobile) — that is what the Share button is for.
export function BlogShare({ url, title, slug }: { url: string; title: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  // Feature-detect navigator.share as a client-only value: the server snapshot is
  // false, the client snapshot reads the API, and React reconciles after hydration
  // (no setState-in-effect, no hydration mismatch). The Share button then appears
  // on supporting devices (mostly mobile), where the OS sheet offers Instagram,
  // WhatsApp, Messenger, etc — the only route to Instagram from the web.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false,
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / denied) — the link buttons still work.
    }
  };

  const nativeShare = async () => {
    const data: ShareData = { title, url };
    // Instagram (and other visual targets) only offer "Add to story" for MEDIA,
    // never a bare link — so attach the post's 9:16 portrait card, which fills a
    // phone Story (the 1200x630 og:image would letterbox into a small band). The
    // story-image route has a stable path, so fetch it directly by slug.
    try {
      if (typeof navigator.canShare === 'function') {
        const res = await fetch(`/blog/${encodeURIComponent(slug)}/story-image`);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], 'paddock-story.png', { type: blob.type || 'image/png' });
          if (navigator.canShare({ files: [file] })) data.files = [file];
        }
      }
    } catch {
      // Couldn't build the image (fetch blocked / unsupported) — share link-only.
    }
    try {
      await navigator.share(data);
    } catch (err) {
      // AbortError = the user dismissed the sheet. Any other error while sharing
      // files means the platform rejected the file+link combo, so retry
      // link-only so the button still does something.
      if (data.files && (err as Error)?.name !== 'AbortError') {
        try {
          await navigator.share({ title, url });
        } catch {
          // cancelled — no-op
        }
      }
    }
  };

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  const btn =
    'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-text';

  return (
    <section className="border-t border-border pt-4">
      <h2 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        Share
      </h2>
      <div className="flex flex-wrap gap-2">
        {canShare && (
          <button type="button" onClick={nativeShare} className={btn}>
            <Share2 size={13} />
            Share
          </button>
        )}
        <a
          href={fbHref}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
          aria-label="Share on Facebook"
        >
          <svg viewBox="0 0 24 24" width={13} height={13} fill="currentColor" aria-hidden>
            <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.628-5.373-12-12-12s-12 5.372-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
          </svg>
          Facebook
        </a>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
          aria-label="Share on WhatsApp"
        >
          <svg viewBox="0 0 24 24" width={13} height={13} fill="currentColor" aria-hidden>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 0 0 5.71 1.447h.006c6.585 0 11.946-5.335 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411" />
          </svg>
          WhatsApp
        </a>
        <a
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
          aria-label="Share on X"
        >
          <span aria-hidden className="text-sm font-bold leading-none">
            X
          </span>
          Post
        </a>
        <button type="button" onClick={copy} className={btn}>
          {copied ? <Check size={13} /> : <Link2 size={13} />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </section>
  );
}
