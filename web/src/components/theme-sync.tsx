"use client";

import { useEffect } from "react";
import { THEME_COOKIE, applyThemeToDocument } from "@/lib/theme";
import type { Theme } from "@/lib/types";

/**
 * 登入後以個人設定的主題為準：cookie 與設定不同時（例如換裝置）在掛載後校正，
 * 並補寫 cookie，讓下次重新載入時伺服器端第一次渲染就是對的主題。
 */
export function ThemeSync({ theme }: { theme: Theme }) {
  useEffect(() => {
    if (document.documentElement.dataset.theme !== theme) applyThemeToDocument(theme);
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${THEME_COOKIE}=`))
      ?.split("=")[1];
    if (current !== theme) {
      const secure = location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${secure}`;
    }
  }, [theme]);
  return null;
}
