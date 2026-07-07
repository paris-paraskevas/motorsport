// Test-only stub for the `server-only` package. The real package throws under
// Node's default export condition (it's designed to fail in client bundles),
// which would break vitest the moment a test imports a server-only module
// (lib/information/*, lib/search-index, …). Aliased in vitest.config.ts.
export {};
