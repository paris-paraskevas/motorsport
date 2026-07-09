import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { YouTube } from './YouTube';
import { slugify } from '@/lib/toc';

// Flatten heading children to plain text so we can derive a stable slug id that
// matches lib/toc's slugify — the blog-post sidebar table-of-contents links
// resolve to these ids.
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object' && 'props' in node) {
    return textOf((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return '';
}

export const mdxComponents = {
  YouTube,
  h2: (props: ComponentPropsWithoutRef<'h2'>) => <h2 id={slugify(textOf(props.children))} {...props} />,
  h3: (props: ComponentPropsWithoutRef<'h3'>) => <h3 id={slugify(textOf(props.children))} {...props} />,
};
