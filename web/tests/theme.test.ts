import { describe, expect, it } from "vitest";
import { getProfile, updateProfile } from "@/lib/services/profiles";
import { DEFAULT_THEME, isTheme, normalizeTheme } from "@/lib/theme";
import { createTestDb, createUser } from "./helpers/db";

describe("主題代號", () => {
  it("只接受 a／b；舊代號 c／e 對應到 a／b；其他值回預設", () => {
    expect(isTheme("a") && isTheme("b")).toBe(true);
    expect(isTheme("c") || isTheme("e") || isTheme("")).toBe(false);
    expect(normalizeTheme("c")).toBe("a");
    expect(normalizeTheme("e")).toBe("b");
    expect(normalizeTheme("b")).toBe("b");
    expect(normalizeTheme(undefined)).toBe(DEFAULT_THEME);
    expect(normalizeTheme("x")).toBe(DEFAULT_THEME);
    // cookie 是使用者可控的：原型鏈上的名稱不能漏出去
    for (const v of ["constructor", "__proto__", "toString", "hasOwnProperty", 123, null, {}]) {
      expect(normalizeTheme(v)).toBe(DEFAULT_THEME);
    }
  });

  it("新帳號預設 a；可切到 b；舊代號會被拒", async () => {
    const db = await createTestDb();
    const user = await createUser(db);
    expect((await getProfile(db, user))?.theme).toBe("a");
    expect((await updateProfile(db, user, { theme: "b" })).theme).toBe("b");
    await expect(updateProfile(db, user, { theme: "e" })).rejects.toMatchObject({ code: "validation_failed" });
  });
});
