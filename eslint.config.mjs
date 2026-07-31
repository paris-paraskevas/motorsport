import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees are full repo copies; flat config skips neither
    // dot-dirs nor .gitignore, so without this every finding reports ~15×
    // and real errors drown (audit 4-3).
    ".claude/**",
    ".agents/**",
    // Generated serwist bundles.
    "public/sw*.js",
    "public/swe-worker-*.js",
    // OpenNext/Wrangler build output, created in the repo root by the Cloudflare
    // migration. `.open-next` alone is 332 MB / 3112 JS files, and because bare
    // `eslint` lints the whole cwd, walking it killed the process outright:
    // "FATAL ERROR: Ineffective mark-compacts near heap limit" — still fatal at
    // --max-old-space-size=8192. Same shape as the ".next/**" entry above.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
