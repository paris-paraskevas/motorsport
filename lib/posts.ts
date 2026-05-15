import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import type { Post, PostFrontmatter } from './types';

const POSTS_ROOT = path.join(process.cwd(), 'content', 'posts');

async function readDirSafe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isPublishable(fm: PostFrontmatter): boolean {
  if (!fm.title || !fm.summary || !fm.publishedAt) return false;
  if (fm.draft && isProduction()) return false;
  return true;
}

export async function listPostSlugs(): Promise<string[]> {
  const entries = await readDirSafe(POSTS_ROOT);
  return entries
    .filter(name => name.endsWith('.md') || name.endsWith('.mdx'))
    .map(name => name.replace(/\.(md|mdx)$/, ''));
}

export async function loadPost(slug: string): Promise<Post | null> {
  const candidates = [
    path.join(POSTS_ROOT, `${slug}.md`),
    path.join(POSTS_ROOT, `${slug}.mdx`),
  ];
  let raw: string | null = null;
  for (const p of candidates) {
    try {
      raw = await fs.readFile(p, 'utf-8');
      break;
    } catch {
      // try next
    }
  }
  if (!raw) return null;

  const parsed = matter(raw);
  const fm = parsed.data as PostFrontmatter;
  if (!isPublishable(fm)) return null;

  const processed = await remark().use(remarkHtml).process(parsed.content);
  return {
    slug,
    frontmatter: fm,
    contentHtml: processed.toString(),
  };
}

export async function loadAllPosts(): Promise<Post[]> {
  const slugs = await listPostSlugs();
  const posts = await Promise.all(slugs.map(loadPost));
  return posts
    .filter((p): p is Post => p !== null)
    .sort(
      (a, b) =>
        new Date(b.frontmatter.publishedAt).getTime() -
        new Date(a.frontmatter.publishedAt).getTime(),
    );
}
