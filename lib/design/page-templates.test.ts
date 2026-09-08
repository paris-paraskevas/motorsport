import { describe, expect, it } from 'vitest';
import { PAGE_GROUPS } from './page-registry';
import { documentRefs, parsePageDocument, refRows } from './page-document';
import { PAGE_TEMPLATES, TEMPLATE_LIST_KEYS, pageTemplate } from './page-templates';

describe('page templates', () => {
  it('has unique keys, a group among the six, and Blank with no regions', () => {
    expect(new Set(PAGE_TEMPLATES.map(t => t.key)).size).toBe(PAGE_TEMPLATES.length);
    for (const t of PAGE_TEMPLATES) expect(PAGE_GROUPS).toContain(t.group);
    expect(pageTemplate('blank')?.document.regions).toEqual([]);
    expect(pageTemplate('nope')).toBeNull();
    expect(pageTemplate(undefined)).toBeNull();
  });

  it('every template is a document the strict parser accepts unchanged', () => {
    for (const t of PAGE_TEMPLATES) {
      expect(parsePageDocument(t.document), t.key).toEqual({ value: t.document, problems: [] });
    }
  });

  it('a template names only the four seeded navigation lists: no photos, no shortcuts, no schemes', () => {
    for (const t of PAGE_TEMPLATES) {
      const refs = documentRefs(t.document);
      for (const key of refs.lists) expect(TEMPLATE_LIST_KEYS, `${t.key} names ${key}`).toContain(key);
      expect(refs.assets, t.key).toEqual([]);
      expect(refs.shortcuts, t.key).toEqual([]);
      expect(refs.authz, t.key).toEqual([]);
    }
    expect(refRows(documentRefs(pageTemplate('guide')!.document))).toEqual([
      { kind: 'list', key: 'bar' },
      { kind: 'list', key: 'footer-legal' },
    ]);
  });
});
