import fs from 'fs/promises';
import path from 'path';

// Server-only. Loads the curated site-help corpus that grounds the assistant.
// The corpus is the ONLY factual source the model may answer from (see
// lib/assistant/prompt.ts) — no live data, so it's safe to cache for the
// process lifetime. Missing file → empty string (the route degrades to
// "unavailable" upstream rather than letting the model answer ungrounded).

let cached: string | null = null;

export async function loadSiteHelpCorpus(): Promise<string> {
  if (cached != null) return cached;
  try {
    const file = path.join(process.cwd(), 'content', 'assistant', 'site-help.md');
    cached = await fs.readFile(file, 'utf-8');
  } catch {
    cached = '';
  }
  return cached;
}
