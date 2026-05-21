// Build the openGraph + twitter blocks for per-route Metadata.
//
// Next 16's Metadata API merges per-page metadata into the root config from
// app/layout.tsx — but it merges by top-level key. So if a page returns only
// { title, description } from generateMetadata, the root's openGraph + twitter
// blocks win and every social share preview uses the homepage title +
// description. We need explicit per-page overrides on the social blocks.
//
// Root layout already sets openGraph.type + url + siteName and twitter.card,
// so this helper only sets title + description (+ optional type override for
// blog posts). The other fields inherit correctly from layout.tsx.

import type { Metadata } from 'next';

export function withSocialMeta(args: {
  title: string;
  description: string;
  type?: 'website' | 'article';
}): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: {
      title: args.title,
      description: args.description,
      ...(args.type ? { type: args.type } : {}),
    },
    twitter: {
      // Per-page twitter block fully replaces the layout's twitter block in
      // Next 16's Metadata API (it doesn't deep-merge), so the `card` field
      // has to be set here too or every page degrades to the default `summary`
      // card without the large image.
      card: 'summary_large_image',
      title: args.title,
      description: args.description,
    },
  };
}
