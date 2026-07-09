'use client';

import { useState } from 'react';
import { Link2, Check } from 'lucide-react';

// Sidebar share controls for a blog post. Copy-link needs the clipboard API, so
// this is the one interactive island on the otherwise-static post page; the X
// intent is a plain link that works anywhere.
export function BlogShare({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / denied) — the X link still works.
    }
  };

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const btn =
    'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-text';

  return (
    <section className="border-t border-border pt-4">
      <h2 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        Share
      </h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={btn}>
          {copied ? <Check size={13} /> : <Link2 size={13} />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a href={xHref} target="_blank" rel="noopener noreferrer" className={btn}>
          <span aria-hidden className="text-sm font-bold leading-none">X</span>
          Post
        </a>
      </div>
    </section>
  );
}
