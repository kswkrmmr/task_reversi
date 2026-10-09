import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // useActionState の (prevState, formData) のように、使わない引数は _ 始まりで明示する。
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma が生成するファイルと、エージェント用スキルのミラー
    "src/prisma/contract.d.ts",
    "migrations/**",
    ".claude/**",
    ".agents/**",
    ".cursor/**",
    ".devin/**",
  ]),
]);

export default eslintConfig;
