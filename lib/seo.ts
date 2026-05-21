// Build the openGraph + twitter blocks for per-route Metadata.
//
// Next 16's Metadata API does NOT deep-merge openGraph + twitter blocks —
// page-level returns fully replace the layout's matching block. If a page
// returns only { title, description } from generateMetadata, the root's
// openGraph + twitter blocks win (so every social share preview reads the
// homepage copy). If a page returns openGraph: { title, description } without
// setting type / url / siteName, those three fields are lost. Same for
// twitter.card.
//
// This helper re-sets every field that needs to survive the no-deep-merge
// override. siteName + default type live here as constants; url is required
// per-route (the layout's root URL is wrong on every non-home page).

import type { Metadata } from 'next';
import { SITE_TITLE, SITE_URL } from './site';

export function withSocialMeta(args: {
  title: string;
  description: string;
  // Path relative to SITE_URL, e.g. "/series/f1". Optional — the og:url field
  // is best-effort; omitting it falls back to the layout's site root, which
  // is wrong but not catastrophic (Twitter / Facebook crawlers re-resolve from
  // the actual fetch URL anyway).
  path?: string;
  type?: 'website' | 'article';
}): Pick<Metadata, 'openGraph' | 'twitter'> {
  const type = args.type ?? 'website';
  return {
    openGraph: {
      type,
      title: args.title,
      description: args.description,
      siteName: SITE_TITLE,
      ...(args.path ? { url: `${SITE_URL}${args.path}` } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: args.title,
      description: args.description,
    },
  };
}
