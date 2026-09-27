import js from "@eslint/js";
import tsPlugin from "typescript-eslint";

export default tsPlugin.config(
  js.configs.recommended,
  ...tsPlugin.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
      ],
      "no-console": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".issuepilot/**",
      "tests/fixtures/**",
    ],
  }
);
