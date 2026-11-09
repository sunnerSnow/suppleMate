import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SuppleMate 的頁面都是登入後的個人即時資料（今日計畫、庫存），沒有可共用的快取，
  // 所以不用 Cache Components；讀 cookie 的頁面自然是動態頁。
  cacheComponents: false,
  // 上層資料夾另有 lockfile，明確指定追蹤根目錄避免 Next 誤判 monorepo
  outputFileTracingRoot: import.meta.dirname,
  // PGlite 會在執行時載入 WASM 與資料檔，postgres 是原生 TCP 驅動，都不要被打包
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
