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
    // Any alternate build output directory. scripts/build.mjs writes to
    // .next-gate off-CI so it never cleans a running dev server's .next, and
    // the QA scripts use .next-qa. Globbed rather than listed: an unignored
    // build directory makes `bun run lint` report tens of thousands of problems
    // in generated JavaScript, which is how the deploy gate failed.
    ".next-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright artifacts (may or may not exist; avoid ESLint glob crashes)
    "test-results/**",
    "playwright-report/**",
    // Local agent/assistant artifacts
    ".claude/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/ban-ts-comment": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      // Pragmatic app codebase: keep these surfaced as warnings (they don't
      // block the deploy gate) rather than hard errors. `no-explicit-any` is
      // mostly DataTable row-cast noise; `set-state-in-effect` is the noisy
      // React 19 rule that also flags legitimate derived-state syncing.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
