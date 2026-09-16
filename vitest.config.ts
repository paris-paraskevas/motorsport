import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'lib/**/*.test.{ts,tsx}',
      'tests/**/*.test.ts',
      'app/**/*.test.{ts,tsx}',
      'components/**/*.test.{ts,tsx}',
    ],
    // `node` stays the default because almost everything here is pure logic and
    // a DOM per file is not free. A component or hook test opts in per file with
    // a `// @vitest-environment jsdom` docblock on line 1.
    //
    // jsdom is pinned to 29 deliberately: 30 declares `node: ^24.15.0` and this
    // machine runs 24.14.0, so it installs with an EBADENGINE warning on every
    // npm i. 29.1.1 declares `>=24.0.0` and is otherwise the same.
    // Capped because unbounded was BOTH flaky and slower. Fork-worker start
    // timeouts reproduce whenever a dev server runs alongside the suite, and on
    // this 22-core machine the uncapped default over-subscribes badly:
    //
    //   unpinned      8.57s   (import 48.48s of contended work)
    //   maxWorkers 4  9.25s
    //   maxWorkers 50% 6.91s  (import 24.46s)
    //
    // So half the cores is faster than all of them AND leaves room for a dev
    // server. A PERCENTAGE rather than a number so it adapts: a 2-core CI runner
    // gets 1 worker, not an over-subscribed 4. Nothing is skipped — all 1481
    // tests still run.
    maxWorkers: '50%',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // The `server-only` marker package throws under Node's default export
      // condition; stub it so tests can import server-only modules.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
});
