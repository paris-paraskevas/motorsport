import fs from 'fs/promises';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

export async function loadMarkdownAsHtml(filePath: string): Promise<string> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
  const { content } = matter(raw);
  if (!content.trim()) return '';
  const processed = await remark()
    .use(remarkGfm)
    .use(remarkHtml)
    .process(content);
  return processed.toString();
}

export interface MarkdownDocument {
  html: string;
  frontmatter: Record<string, unknown>;
}

export async function loadMarkdownWithFrontmatter(
  filePath: string,
): Promise<MarkdownDocument> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return { html: '', frontmatter: {} };
  }
  const { content, data } = matter(raw);
  if (!content.trim()) return { html: '', frontmatter: data };
  const processed = await remark()
    .use(remarkGfm)
    .use(remarkHtml)
    .process(content);
  return { html: processed.toString(), frontmatter: data };
}
