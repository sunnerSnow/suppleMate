"""
把繁中字型切成自架的 woff2 分片（兩套都是 SIL OFL 1.1，可子集化與再散布）。

為什麼不用 next/font/google：Noto Sans TC 有三百多個分片，Vercel 建置時向 Google 下載偶爾會回 500，
Next 會把下載失敗當成 module not found，整個 build 跟著失敗。自架之後建置不再依賴外部網路。

做法跟 Google Fonts 一樣用 unicode-range 分片：瀏覽器只下載頁面上真的用到的那幾片。
- 第 0 片：英數標點＋程式碼與內建資料裡出現的所有中文字（介面一定會用到）
- 其餘：Big5 常用字（A440–C67E，5401 字）中剩下的字，依碼位切成數片，涵蓋使用者輸入的保健品名稱等
不在這些範圍的字，會用 CSS 字體清單後面的系統字體顯示。

用法（需要 fonttools 與 brotli：python -m pip install fonttools brotli）：
  python scripts/subset-font.py huninn       <Huninn-Regular.ttf 的路徑>
  python scripts/subset-font.py noto-sans-tc <NotoSansTC[wght].ttf 的路徑>
原始字檔（含 OFL.txt）：
  https://github.com/google/fonts/tree/main/ofl/huninn
  https://github.com/google/fonts/tree/main/ofl/notosanstc
"""

import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHUNK = 900

FONTS = {
    # key: (CSS font-family, font-weight 描述, 輸出資料夾, 檔名前綴)
    "huninn": ("Huninn", "400", "huninn", "huninn"),
    "noto-sans-tc": ("Noto Sans TC", "100 900", "noto-sans-tc", "noto-sans-tc"),
}

BASIC = (
    set(range(0x20, 0x7F))
    | set(range(0xA0, 0x100))
    | set(range(0x2010, 0x2028))
    | set(range(0x2030, 0x203F))
    | {0x2190, 0x2192, 0x2212, 0x00D7, 0x2026, 0x2713, 0x2714}
    | set(range(0x3000, 0x3020))
    | set(range(0xFF01, 0xFF5F))
)


def ui_chars() -> set[int]:
    chars: set[int] = set()
    for pattern in ("src/**/*.ts", "src/**/*.tsx", "db/migrations/*.sql"):
        for path in ROOT.glob(pattern):
            chars |= {ord(c) for c in path.read_text(encoding="utf-8") if ord(c) >= 0x2E80}
    return chars


def big5_common() -> set[int]:
    chars: set[int] = set()
    for lead in range(0xA4, 0xC7):
        for trail in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
            if (lead, trail) > (0xC6, 0x7E):
                break
            try:
                chars.add(ord(bytes([lead, trail]).decode("big5")))
            except UnicodeDecodeError:
                pass
    return chars


def to_ranges(codes: list[int]) -> str:
    codes = sorted(codes)
    parts, start, prev = [], codes[0], codes[0]
    for c in codes[1:] + [None]:
        if c is not None and c == prev + 1:
            prev = c
            continue
        parts.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
        if c is not None:
            start = prev = c
    return ", ".join(parts)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 3 or sys.argv[1] not in FONTS:
        print(__doc__)
        raise SystemExit(1)
    family, weight, folder, prefix = FONTS[sys.argv[1]]
    source = pathlib.Path(sys.argv[2])
    out = ROOT / "src" / "app" / "fonts" / folder

    available = set(TTFont(source, lazy=True).getBestCmap().keys())
    first = (BASIC | ui_chars()) & available
    rest = sorted((big5_common() & available) - first)
    slices = [sorted(first)] + [rest[i : i + CHUNK] for i in range(0, len(rest), CHUNK)]

    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.woff2"):
        old.unlink()
    css = [f"/* 由 scripts/subset-font.py 產生，不要手動修改。{family}：SIL Open Font License 1.1（見 OFL.txt） */"]
    for i, codes in enumerate(slices):
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.hinting = False
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        font = subset.load_font(str(source), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=codes)
        subsetter.subset(font)
        name = f"{prefix}-{i:02d}.woff2"
        subset.save_font(font, str(out / name), options)
        size = (out / name).stat().st_size
        print(f"{name}: {len(codes)} 字, {size / 1024:.0f} KB")
        css.append(
            "@font-face {\n"
            f'  font-family: "{family}";\n'
            "  font-style: normal;\n"
            f"  font-weight: {weight};\n"
            "  font-display: swap;\n"
            f'  src: url("./{name}") format("woff2");\n'
            f"  unicode-range: {to_ranges(codes)};\n"
            "}"
        )
    (out / f"{prefix}.css").write_text("\n".join(css) + "\n", encoding="utf-8", newline="\n")
    license_src = source.with_name("OFL.txt")
    if license_src.exists():
        (out / "OFL.txt").write_text(license_src.read_text(encoding="utf-8"), encoding="utf-8", newline="\n")
    print("已寫入", out)


if __name__ == "__main__":
    main()
