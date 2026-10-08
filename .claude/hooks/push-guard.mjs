// PreToolUse on Bash: Claude never pushes to main and never merges into it. Only the
// operator merges next into main, once a day, and that merge is the only deploy (slot O4,
// 2026-10-08; the laws in CLAUDE.md): Claude opens pull requests into next and merges
// only there. Force pushes are refused everywhere; --force-with-lease on a branch passes.
//
// The command is read the way a shell reads it, not as text: a heredoc's body is data
// unless a shell runs it, a quoted string is one argument, and a command is found wherever
// one starts (after ; && || | & ( { then do, behind VAR=, env, timeout, xargs and !, inside
// $( ) and backticks, in the script of sh -c or eval, and in a heredoc fed to a shell).
// What cannot be checked before the command runs (a pull request named through the shell,
// a lookup that fails or runs out of time) is refused.
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { readInput, deny, allow } from './lib.mjs';

const input = readInput();
if (input.tool_name !== 'Bash') allow();
const source = String(input.tool_input?.command ?? '').replace(/\r\n?/g, '\n');
if (!/gh|git/.test(source)) allow();

const SHELL = /^(?:ba|z|da|k)?sh$/;
const SKIP = new Set(['!', '{', '}', 'then', 'do', 'else', 'elif', 'if', 'while', 'until', 'time', 'command', 'builtin', 'exec', 'nohup', 'sudo']);
// The flags that take a value, per command (gh 2.x, git 2.x); every other flag is a switch.
const CREATE = ['-a', '--assignee', '-B', '--base', '-b', '--body', '-F', '--body-file', '-H', '--head', '-l', '--label', '-m', '--milestone', '-p', '--project', '-r', '--reviewer', '-T', '--template', '-t', '--title', '-R', '--repo'];
const EDIT = ['--add-assignee', '--add-label', '--add-project', '--add-reviewer', '-B', '--base', '-b', '--body', '-F', '--body-file', '-m', '--milestone', '--remove-assignee', '--remove-label', '--remove-project', '--remove-reviewer', '-t', '--title', '-R', '--repo'];
const MERGE = ['-A', '--author-email', '-b', '--body', '-F', '--body-file', '--match-head-commit', '-t', '--subject', '-R', '--repo'];
const API = ['-X', '--method', '-f', '--raw-field', '-F', '--field', '-H', '--header', '--input', '-q', '--jq', '-t', '--template', '--cache', '-p', '--preview', '--hostname'];
const GIT = ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env'];
const PUSH = ['-o', '--push-option', '--receive-pack', '--exec', '--repo'];
// The settings give this hook 10 s, and a hook that runs out of time does not block; every
// lookup shares 8 s, and one that runs out of time is refused.
const deadline = Date.now() + 8000;

/** The index of the `)` closing the `(` at `open`, skipping quoted text; the text's end when unbalanced. */
function closing(s, open) {
  for (let i = open, depth = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') i++;
    else if (c === "'" || c === '"') { const j = s.indexOf(c, i + 1); i = j < 0 ? s.length : j; }
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return s.length;
}

/** Drops heredoc bodies, returning the ones a shell runs as scripts; an unterminated body stays as text. */
function heredocs(text) {
  const lines = text.split('\n'), kept = [], scripts = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    kept.push(line);
    for (const m of line.matchAll(/(?<!<)<<-?[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([A-Za-z_][\w.-]*))/g)) {
      const delim = m[1] ?? m[2] ?? m[3];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== delim) j++;
      if (j >= lines.length) break;
      if (/(?:^|[\s;&|(/])(?:ba|z|da|k)?sh(?:\.exe)?(?=[\s<|;&)]|$)/.test(line)) scripts.push(lines.slice(i + 1, j).join('\n'));
      i = j;
    }
  }
  return { text: kept.join('\n'), scripts };
}

/** The command behind its wrappers (VAR=x, env, timeout, xargs, !, then, do …), with the program's bare name first. */
function program(words) {
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (SKIP.has(w) || /^[A-Za-z_]\w*=/.test(w)) i++;
    else if (w === 'env') { i++; while (i < words.length && (/^[A-Za-z_]\w*=/.test(words[i]) || words[i].startsWith('-'))) i++; }
    else if (w === 'timeout') { i++; while (i < words.length && words[i].startsWith('-')) i++; i++; }
    else if (w === 'xargs') { i++; while (i < words.length && words[i].startsWith('-')) i += /^-[aEdILnPs]$/.test(words[i]) ? 2 : 1; }
    else break;
  }
  const p = words.slice(i);
  if (p.length) p[0] = path.basename(p[0].replace(/\\/g, '/')).replace(/\.exe$/i, '');
  return p;
}

/** Every simple command in the text, in order, as its words with the quotes removed. */
function commands(source, depth = 0) {
  if (depth > 5) return [];
  const { text, scripts } = heredocs(source);
  const found = [], inner = [...scripts];
  let words = [], word = '', open = false, target = false;
  const endWord = () => { if (open) { if (target) target = false; else words.push(word); } word = ''; open = false; };
  const endCommand = () => { endWord(); if (words.length) found.push(words); words = []; target = false; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { if (text[i + 1] !== '\n') { word += text[i + 1] ?? ''; open = true; } i++; }
    else if (c === "'") { const j = text.indexOf("'", i + 1), end = j < 0 ? text.length : j; word += text.slice(i + 1, end); open = true; i = end; }
    else if (c === '"') {
      let j = i + 1;
      for (; j < text.length && text[j] !== '"'; j++) {
        if (text[j] === '\\') word += text[++j] ?? '';
        else if (text[j] === '$' && text[j + 1] === '(') { const k = closing(text, j + 1); inner.push(text.slice(j + 2, k)); word += '$()'; j = k; }
        else if (text[j] === '`') { const k = text.indexOf('`', j + 1), end = k < 0 ? text.length : k; inner.push(text.slice(j + 1, end)); word += '``'; j = end; }
        else word += text[j];
      }
      open = true; i = j;
    }
    else if (c === '$' && text[i + 1] === '(') { const k = closing(text, i + 1); inner.push(text.slice(i + 2, k)); word += '$()'; open = true; i = k; }
    else if (c === '`') { const k = text.indexOf('`', i + 1), end = k < 0 ? text.length : k; inner.push(text.slice(i + 1, end)); word += '``'; open = true; i = end; }
    else if (c === '#' && !open) { const k = text.indexOf('\n', i); i = (k < 0 ? text.length : k) - 1; }
    else if (c === '<' || c === '>') {
      // A redirection: a file descriptor before it (2>) and the target after it are not arguments.
      if (/^\d+$/.test(word)) { word = ''; open = false; } else endWord();
      while (i + 1 < text.length && '<>&|-'.includes(text[i + 1])) i++;
      target = true;
    }
    else if (';&|()\n'.includes(c)) endCommand();
    else if (c === ' ' || c === '\t') endWord();
    else { word += c; open = true; }
  }
  endCommand();
  const out = [...found];
  for (const w of found) {
    const p = program(w);
    const c = SHELL.test(p[0] ?? '') ? p.findIndex((a, n) => n > 0 && /^-[A-Za-z]*c[A-Za-z]*$/.test(a)) : -1;
    if (c > 0 && p[c + 1] !== undefined) out.push(...commands(p[c + 1], depth + 1));
    if (p[0] === 'eval') out.push(...commands(p.slice(1).join(' '), depth + 1));
  }
  for (const s of inner) out.push(...commands(s, depth + 1));
  return out;
}

/** A command's flags (every value each was given) and its positional arguments; `valued` names the flags that take a value. */
function flags(args, valued) {
  const values = new Map(), positional = [];
  const add = (k, v) => values.set(k, [...(values.get(k) ?? []), v]);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { positional.push(...args.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) add(a.slice(0, eq), a.slice(eq + 1));
      else add(a, valued.includes(a) ? (args[++i] ?? '') : true);
    } else if (a.startsWith('-') && a.length > 1) {
      const k = a.slice(0, 2);
      add(k, valued.includes(k) ? (a.length > 2 ? a.slice(2).replace(/^=/, '') : (args[++i] ?? '')) : true);
    } else positional.push(a);
  }
  return { get: (...names) => names.flatMap((n) => values.get(n) ?? []), positional };
}

/** A directory the command names, resolved from `base` (Git Bash's /c/… and ~ included). */
function local(d, base) {
  let p = String(d);
  if (p === '~' || p.startsWith('~/')) p = os.homedir() + p.slice(1);
  if (process.platform === 'win32' && /^\/[A-Za-z](?:\/|$)/.test(p)) p = `${p[1]}:/${p.slice(3)}`;
  return path.resolve(base, p);
}

/** The base branch of a pull request, or '' when it cannot be read in time. */
function prBase(selector, repo, cwd) {
  // PUSH_GUARD_PR_BASE stands in for gh in the hook tests only: one base for every pull
  // request, or a JSON map of selector → base.
  const stub = process.env.PUSH_GUARD_PR_BASE;
  if (stub !== undefined) {
    if (!stub.startsWith('{')) return stub;
    try { return String(JSON.parse(stub)[selector] ?? ''); } catch { return ''; }
  }
  const timeout = deadline - Date.now();
  if (timeout <= 0) return '';
  const r = spawnSync('gh', ['pr', 'view', selector, ...(repo ? ['--repo', repo] : []), '--json', 'baseRefName', '--jq', '.baseRefName'], { encoding: 'utf8', cwd, timeout });
  return (r.stdout ?? '').trim();
}

let dir = String(input.cwd ?? process.cwd());
for (const words of commands(source)) {
  const p = program(words);
  if (p[0] === 'cd') { dir = local(p[1] ?? '~', dir); continue; }

  if (p[0] === 'gh' && p[1] === 'pr' && p[2] === 'create') {
    const bases = flags(p.slice(3), CREATE).get('--base', '-B');
    if (!bases.length || bases.some((b) => b !== 'next')) deny('Law: pull requests target next (gh pr create --base next); only the operator merges next into main.');
  }
  if (p[0] === 'gh' && p[1] === 'pr' && p[2] === 'edit') {
    if (flags(p.slice(3), EDIT).get('--base', '-B').some((b) => b !== 'next')) deny('Law: a pull request keeps next as its base; only the operator merges next into main.');
  }
  if (p[0] === 'gh' && p[1] === 'pr' && p[2] === 'merge') {
    const f = flags(p.slice(3), MERGE);
    const selector = String(f.positional[0] ?? '').replace(/^#/, '');
    if (!selector) deny('Law: name the pull request in gh pr merge (number, URL or branch), so its base can be checked.');
    if (/[$`*?]/.test(selector)) deny(`Law: gh pr merge ${selector} names its pull request through the shell; name it outright, so its base can be checked.`);
    const base = prBase(selector, f.get('--repo', '-R').pop(), dir);
    if (base !== 'next') deny(`Law: #${selector} targets ${base || 'an unknown branch'}; I merge only into next, and only the operator merges next into main.`);
  }

  if (p[0] === 'gh' && p[1] === 'api') {
    const f = flags(p.slice(2), API);
    const endpoint = String(f.positional[0] ?? '');
    const fields = [...f.get('-f', '--raw-field', '-F', '--field'), ...f.get('--input')].map(String);
    const method = String(f.get('-X', '--method').pop() ?? (fields.length ? 'POST' : 'GET')).toUpperCase();
    const said = [endpoint, ...fields].join(' ');
    if (/\/pulls\/[^/\s]+\/merge\b|\/merges\b/.test(endpoint) || /\b(?:mergePullRequest|enablePullRequestAutoMerge|mergeBranch)\b/.test(said)) {
      deny('Law: no merges through gh api; gh pr merge, into next only.');
    }
    if ((method !== 'GET' && /\/git\/refs\b/.test(endpoint)) || /\b(?:createRef|updateRefs?|deleteRef)\b/.test(said)) {
      deny('Law: no branch writes through gh api; push a branch and open a pull request into next.');
    }
    if ((/^(?:PUT|PATCH|DELETE)$/.test(method) && /\/(?:rulesets|protection)\b/.test(endpoint)) || /\b(?:update|delete)(?:RepositoryRuleset|BranchProtectionRule)\b/.test(said)) {
      deny('Law: the rules on main are the operator’s; Claude never edits or deletes them.');
    }
  }

  if (p[0] === 'git') {
    let i = 1, at = dir;
    while (i < p.length && p[i].startsWith('-')) {
      if (p[i] === '-C') at = local(p[i + 1] ?? '.', at);
      i += GIT.includes(p[i]) ? 2 : 1;
    }
    if (p[i] !== 'push') continue;
    const args = p.slice(i + 1);
    const f = flags(args, PUSH);
    const refspecs = f.positional.slice(1);
    if (f.get('--force').length || args.some((a) => /^-[A-Za-z]*f[A-Za-z]*$/.test(a)) || refspecs.some((r) => r.startsWith('+'))) {
      deny('Law: no force push; use --force-with-lease on a PR branch only.');
    }
    if (f.get('--all', '--mirror', '--branches').length) deny('Law: push one branch at a time, never --all or --mirror.');
    if (refspecs.some((r) => /^(?:refs\/heads\/)?(?:main|master)$/.test(r.split(':').pop()))) deny('Law: never push to main; open a PR from a branch into next.');
    if (!refspecs.length || refspecs.some((r) => /^(?:HEAD|@)$/.test(r))) {
      const r = spawnSync('git', ['-C', at, 'symbolic-ref', '--short', '-q', 'HEAD'], { encoding: 'utf8', timeout: Math.max(1, deadline - Date.now()) });
      if (/^(?:main|master)$/.test((r.stdout ?? '').trim())) deny('Law: never push to main; this checkout is on main, so open a PR from a branch into next.');
    }
  }
}
allow();
