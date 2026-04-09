import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "warn",
      // Large existing codebase — typing every `any` is a separate refactor task
      "@typescript-eslint/no-explicit-any": "warn",
      // tailwindcss-animate has no ESM export; require() is the only option here
      "@typescript-eslint/no-require-imports": "warn",
      // Empty catch blocks are intentional in many offline-first patterns
      "no-empty": ["warn", { allowEmptyCatch: true }],
      // Style preference — not a correctness issue
      "prefer-const": "warn",
      // Empty interfaces used as base types are common in React+TS codebases
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
);
