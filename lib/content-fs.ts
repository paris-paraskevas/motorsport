// Drop-in replacement for the `fs` reads the content loaders use, backed by the
// build-time CONTENT_BUNDLE (webpack-inlined) instead of the runtime filesystem.
// Cloudflare's unenv Node shim does NOT implement fs.readFile/readdir for bundled
// files, so on Workers the real fs reads throw and every content page fail-softs
// to "not found". Loaders import THIS module instead of 'fs/promises' / 'node:fs'
// and keep calling readFile/readFileSync/readdir with the same paths.
//
// Bundle miss → fall back to real fs. In Node (tests, `next dev`) that reads the
// real file, so fixtures outside content/ keep working; on Workers real fs throws
// "not implemented" for a non-bundled path, exactly as before — the loaders
// already catch and fail soft. Every real content/** file IS in the bundle, so
// the fallback never fires for production content on Workers.
import { readFile as realReadFile, readdir as realReaddir } from 'node:fs/promises';
import { readFileSync as realReadFileSync } from 'node:fs';
import { CONTENT_BUNDLE } from './content-bundle.generated';

/** Normalise an absolute/relative fs path to a bundle key
 *  ("<cwd>/content/series/f1/meta.json" -> "content/series/f1/meta.json";
 *   "<cwd>/RELEASES.md" -> "RELEASES.md"). */
function toKey(p: string): string {
  const norm = p.replace(/\\/g, '/').replace(/\/+$/, '');
  const idx = norm.indexOf('content/');
  if (idx >= 0 && (idx === 0 || norm[idx - 1] === '/')) return norm.slice(idx);
  return norm.slice(norm.lastIndexOf('/') + 1); // repo-root file (e.g. RELEASES.md)
}

export async function readFile(p: string, _encoding?: unknown): Promise<string> {
  const v = CONTENT_BUNDLE[toKey(p)];
  return v !== undefined ? v : realReadFile(p, 'utf-8');
}

export function readFileSync(p: string, _encoding?: unknown): string {
  const v = CONTENT_BUNDLE[toKey(p)];
  return v !== undefined ? v : realReadFileSync(p, 'utf-8');
}

interface Dirent {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

export function readdir(p: string): Promise<string[]>;
export function readdir(p: string, opts: { withFileTypes: true }): Promise<Dirent[]>;
export function readdir(p: string, opts?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]>;
export async function readdir(
  p: string,
  opts?: { withFileTypes?: boolean },
): Promise<string[] | Dirent[]> {
  const prefix = toKey(p).replace(/\/+$/, '') + '/';
  const dirs = new Set<string>();
  const files = new Set<string>();
  for (const key of Object.keys(CONTENT_BUNDLE)) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash === -1) files.add(rest);
    else dirs.add(rest.slice(0, slash));
  }
  if (dirs.size === 0 && files.size === 0) {
    // Not a bundled dir (e.g. a test temp dir) — defer to the real fs.
    return opts?.withFileTypes
      ? ((await realReaddir(p, { withFileTypes: true })) as unknown as Dirent[])
      : realReaddir(p);
  }
  const names = [...dirs, ...files];
  if (opts?.withFileTypes) {
    return names.map(name => ({
      name,
      isDirectory: () => dirs.has(name),
      isFile: () => files.has(name),
    }));
  }
  return names;
}

const contentFs = { readFile, readFileSync, readdir };
export default contentFs;
