import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render assertions for the "From our contributors" band (/information hub +
// every topic page). Written with createElement rather than JSX because the
// vitest config only picks .tsx up under app/**, and this needs no new dependency
// or config change to run.
//
// It exists because the band's populated state could not be verified in a
// browser: there is no local Supabase (Docker down) and the admin toggle sits
// behind Clerk admin auth. The reader's query shape is covered in lib/blog.test.ts;
// this covers what the reader's rows turn into.

// next/link is a client component; in a plain Node render it only needs to become
// an anchor for these assertions to mean anything.
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: unknown }) =>
    createElement('a', { href }, children as never),
}));

const { ContributorPosts } = await import('@/components/information/ContributorPosts');

type Post = Parameters<typeof ContributorPosts>[0]['posts'][number];

const post = (over: Partial<Post> = {}): Post =>
  ({
    id: 'p1',
    slug: 'a-post',
    title: 'How a Formula 1 weekend works',
    summary: 'Practice, qualifying, race.',
    body: '',
    seriesSlug: 'f1',
    tags: [],
    originalUrl: null,
    status: 'published',
    authorId: 'u1',
    authorName: 'Paris Paraskevas',
    publishAt: null,
    publishedAt: '2026-08-24T07:30:54.413Z',
    heroImage: null,
    learnTopic: 'formula-1',
    createdAt: '2026-08-24T00:00:00Z',
    updatedAt: null,
    ...over,
  }) as Post;

const render = (props: Parameters<typeof ContributorPosts>[0]) =>
  renderToStaticMarkup(createElement(ContributorPosts, props));

describe('ContributorPosts', () => {
  // The band must vanish rather than leave a headed, empty section behind — it is
  // rendered unconditionally by both pages.
  it('renders nothing at all when there are no posts', () => {
    expect(render({ posts: [] })).toBe('');
  });

  it('links each post to its own blog URL, not an /information one', () => {
    const html = render({ posts: [post()] });
    expect(html).toContain('href="/blog/a-post"');
    expect(html).not.toContain('/information/');
  });

  it('shows the title, the summary and the byline', () => {
    const html = render({ posts: [post()] });
    expect(html).toContain('How a Formula 1 weekend works');
    expect(html).toContain('Practice, qualifying, race.');
    expect(html).toContain('Paris Paraskevas');
  });

  // Fixed en-GB, because the page prerenders and revalidates hourly — a
  // locale-dependent string would differ between cached HTML and a re-render.
  it('formats the date as en-GB', () => {
    expect(render({ posts: [post()] })).toContain('24 Aug 2026');
  });

  // The topic label belongs on the hub (mixed topics) and not on a topic page,
  // where it would restate the page title.
  it('adds the topic label only when asked', () => {
    expect(render({ posts: [post()], showTopic: true })).toContain('Formula 1 &amp; Open-Wheel');
    expect(render({ posts: [post()] })).not.toContain('Formula 1 &amp; Open-Wheel');
  });

  it('drops missing byline parts instead of rendering empty separators', () => {
    const html = render({ posts: [post({ authorName: null, publishedAt: null })] });
    expect(html).not.toContain('·');
  });

  it('counts the posts in the section header', () => {
    const html = render({ posts: [post(), post({ id: 'p2', slug: 'b-post' })] });
    expect(html).toContain('>2<');
  });
});
