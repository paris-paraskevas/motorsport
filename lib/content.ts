import fs from 'fs/promises';
import matter from 'gray-matter';
import { remark } from 'remark';
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
  const processed = await remark().use(remarkHtml).process(content);
  return processed.toString();
}
