import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SuppleMate 的頁面都是使用者個人的即時資料（今日計畫、庫存），沒有可共用的快取，
  // 所以不用 Cache Components；頁面在瀏覽器端讀取資料。
  cacheComponents: false,
  // 上層資料夾另有 lockfile，明確指定追蹤根目錄避免 Next 誤判 monorepo
  outputFileTracingRoot: import.meta.dirname,
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
