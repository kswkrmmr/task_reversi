import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    // 統合テストは同じDBを使うため、ファイル単位で直列に実行する。
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["src/**/*.test.ts"], exclude: ["src/**/*.int.test.ts"] },
      },
      {
        // ローカルの docker compose の Postgres 上のテスト専用DBを使う（README参照）。
        resolve: { alias },
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          env: {
            DATABASE_URL:
              process.env.TEST_DATABASE_URL ??
              "postgresql://taskreversi:taskreversi@localhost:5434/taskreversi_test",
          },
          testTimeout: 30000,
        },
      },
    ],
  },
});
