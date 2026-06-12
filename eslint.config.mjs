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
    // Generated serwist bundles.
    "public/sw*.js",
    "public/swe-worker-*.js",
  ]),
]);

export default eslintConfig;
