# SuppleMate｜保健品管理助手

手機優先的保健品管理網頁：記錄每天該吃什麼、吃了沒、還剩多少，並依內建資料與 AI 給你服用時機、搭配與整體健檢的建議。

- 正式站：https://supple-mate.vercel.app
- 規格：`SuppleMate_MVP規格.md`（實作與規格的差異見最後一節）
- 原則：**系統只顯示建議，使用者按下才會改資料**；所有營養資訊都是一般資訊，不是醫療建議。

## 功能

| 頁面 | 做什麼 |
|---|---|
| **今日** `/today` | 依每個保健品的時段展開當天的服用表；勾選扣庫存、取消加回去；同一項同一天只會扣一次。時段「尚未確認」的那一次不提醒、不推定。 |
| **保健品** `/supplements` | 新增／編輯／封存；輸入名稱就顯示小知識與「套用為 ○○」的建議時段；詳細頁有庫存異動紀錄。 |
| **庫存** `/inventory` | 每項的剩餘量、低庫存門檻、預估可吃天數；補貨與調整各記一筆異動。 |
| **紀錄** `/history` | 服用與庫存的歷史，依日期分組。 |
| **方案** `/guide` | 依目前的保健品與小知識，排出一天的時段總覽、建議補上的時段、要分開／可一起的搭配提醒。 |
| **健檢** `/checkup` | 一鍵健檢：內建規則立刻找出可調整、可考慮不用、建議增加、要注意的地方；再按一下請 AI 做整體深度分析。 |
| **設定** `/settings` | 介面主題（C／E 兩套可切換）、時區、帳號、重設範例資料／清除資料。 |

## 技術架構

Next.js 16（App Router）＋ TypeScript ＋ Tailwind 4 ＋ zod ＋ Drizzle ORM ＋ PostgreSQL（正式用 Neon，本機與測試用 PGlite）＋ Better Auth ＋ Google Gemini（結構化輸出）＋ Vitest。

```
瀏覽器（React client components）
  └─ StoreProvider（整份資料快照、樂觀鎖定）
       └─ RemoteRepository → Server Actions（app/actions.ts，每個都自己檢查 session）
            └─ services/（交易內套用 domain 純函式、zod 驗證、限流）
                 ├─ withUser()：set local role authenticated ＋ RLS → Neon Postgres（sm／auth schema）
                 └─ lib/ai/：provider 介面（Gemini／mock）→ generateValidated（JSON Schema ＋ zod 驗證、重試）
```

- **領域邏輯是純函式**（`lib/domain/`、`lib/knowledge/`），有單元測試；服務層只負責交易、驗證與持久化。
- **本機示範模式**：沒有 `DATABASE_URL` 時用 PGlite 跑同一份 migration，登入頁可一鍵以示範使用者登入。
- **兩套主題共用同一份 DOM**：長相由 `<html data-theme>` 與 `globals.css` 的語意 class 決定。

## 快速開始（本機示範模式，不需要資料庫）

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

`.env.local` 沒有設定 `DATABASE_URL` 時就是本機示範模式：

- 資料存在 `web/.data/pglite`（已在 .gitignore），啟動時自動跑 migration。
- 登入頁可以一鍵以「示範使用者 A（有範例資料）／B（空的）」登入，兩位的資料互相看不到；也可以用 Email 註冊。
- AI 預設是 `mock` provider：小知識與健檢會回標明「示範內容」的固定範本，用來走完流程；要看真的結果請設定 Gemini（見環境變數）。

## 環境變數

完整範本在 `web/.env.example`，複製成 `web/.env.local` 再填。

| 變數 | 必填 | 說明 |
|---|---|---|
| `DATABASE_URL` | 正式環境 | Neon 的 **pooled** 連線（主機名稱含 `-pooler`）。設了就切到 Postgres 模式；留空＝本機示範模式。 |
| `DATABASE_URL_UNPOOLED` | 選填 | Neon 的 **direct** 連線，只給 `npm run db:migrate` 用。 |
| `BETTER_AUTH_SECRET` | Postgres 模式 | 至少 32 個隨機字元（`openssl rand -base64 32`）。 |
| `BETTER_AUTH_URL` | 部署時 | 網站自己的網址（例如 `https://supple-mate.vercel.app`），不是 Neon 後台的 Neon Auth 網址。本機可留空。 |
| `AI_PROVIDER` | 選填 | `mock`（預設）或 `gemini`。正式環境用 `mock` 時，AI 功能會回「尚未開放」而不是存示範內容。 |
| `GEMINI_API_KEY` | `gemini` 時 | Google AI Studio 的金鑰，只在伺服器使用。 |
| `GEMINI_MODEL`／`GEMINI_FALLBACK_MODEL`／`GEMINI_THINKING` | 選填 | 預設 `gemini-3.6-flash`／`gemini-3.5-flash-lite`／`low`。主要模型過載時自動換備用。 |
| `AI_HOURLY_LIMIT`／`AI_DAILY_LIMIT` | 選填 | 每位使用者每小時、全站每 24 小時的 AI 次數上限（預設 10／100；小知識與健檢共用）。 |
| `SM_LOCAL_MODE=1` | 只限本機 | 用 `next start` 跑本機示範時才需要；**不要**設在 Vercel。 |

## 指令

| 指令 | 說明 |
|---|---|
| `npm run dev` / `npm run build` / `npm run start` | 開發／建置／以正式模式啟動 |
| `npm run test` | Vitest：領域邏輯單元測試＋服務層／RLS／Better Auth／小知識／健檢整合測試（記憶體內 PGlite，不需要外部資料庫） |
| `SMOKE_DATABASE_URL=1 npm run test` | 另外對 `.env.local` 的 Neon 跑端到端煙霧測試 |
| `npm run lint` / `npm run typecheck` | ESLint／`tsc --noEmit` |
| `npm run db:migrate` | 對 `DATABASE_URL_UNPOOLED`（或 `DATABASE_URL`）依序執行 `db/migrations/*.sql`，並驗證權限與 RLS |
| `npm run format` | Prettier（printWidth 120） |
| `python scripts/subset-font.py <huninn\|noto-sans-tc> <ttf>` | 重新產生自架的繁中字型分片（見「介面主題與字型」） |

## 接上 Neon（正式環境）

1. 在 https://console.neon.tech 建立一個**新的專案**（免費方案；區域建議 Singapore `ap-southeast-1`，`vercel.json` 把函式固定在 `sin1`）。不要跟其他 app 共用同一個資料庫：Better Auth 的帳號表都在 `auth` schema，會互相干擾。
2. 從 Neon 的 **Connect** 取兩條連線字串寫進 `web/.env.local`：`DATABASE_URL` 用 pooled、`DATABASE_URL_UNPOOLED` 用 direct。注意 Neon 控制台匯出的名稱是 `DATABASE_URL`（direct）與 `DATABASE_URL_POOLED`（pooled），跟本專案的用法相反，貼的時候請對調。
3. 跑 migration（每份都可重複執行）：`npm run db:migrate`。也可以到 Neon 的 SQL Editor 依檔名順序貼 `db/migrations/` 裡的檔案。
4. `npm run dev` 後用 Email 註冊即可；示範使用者的按鈕只在沒有 `DATABASE_URL` 時出現。

正式環境（`NODE_ENV=production`）沒設 `DATABASE_URL` 會直接報錯，不會默默改用本機資料庫。Neon 免費方案的 compute 閒置會休眠，第一個請求多約半秒到一秒；pooled 連線是 PgBouncer transaction mode，程式已關閉 prepared statements，`withUser` 的 `set local role` 與 `set_config(..., true)` 都在交易內。

## 部署到 Vercel

正式站 https://supple-mate.vercel.app 對應 Vercel 專案 `supple-mate`，連到 GitHub 的 `main`，push 就會自動建置部署。

- 專案設定：**Root Directory = `web`**，Framework = Next.js；`web/vercel.json` 把函式固定在新加坡 `sin1`（與 Neon 同區）。
- 環境變數（Production）：`DATABASE_URL`（pooled）、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL=https://supple-mate.vercel.app`；要開 AI 再加 `AI_PROVIDER=gemini` 與 `GEMINI_API_KEY`。**不要**設 `SM_LOCAL_MODE`。
- **新增 migration 後要先手動 `npm run db:migrate` 再 push**，部署流程不會自動跑 migration；push 前可用 `information_schema` 查一下表與欄位是否真的存在。
- 繁中字型自架（原因見下一節），所以建置不依賴 Google Fonts 是否可連。
- 本機用 CLI：`cd web && npx vercel login`，之後 `npx vercel env ls`、`npx vercel ls supple-mate`、`npx vercel inspect <部署網址> --logs` 可看環境變數、部署與建置紀錄（`.vercel/` 已在 .gitignore）。

## 資料模型與安全

### 資料表（`web/db/migrations/`，皆可重複執行）

| 表 | 內容 |
|---|---|
| `auth.*` | Better Auth 的 users／sessions／accounts／verifications，id 是 uuid |
| `sm.profiles` | 顯示名稱、時區、主題、保健目標、年齡區間、性別（後三者選填，只供健檢） |
| `sm.supplements` | 保健品：劑量與單位分開存、每日次數、各次時段陣列、庫存、門檻、效期、狀態 |
| `sm.intake_logs` | 服用紀錄：計畫項目鍵、名稱／劑量快照、taken／reversed；部分唯一索引擋重複扣庫存 |
| `sm.inventory_transactions` | 庫存異動：initial／intake／reversal／restock／adjustment，入庫為正扣庫存為負 |
| `sm.knowledge` | AI 整理的小知識共用快取（以使用者輸入正規化後的 slug 當鍵；所有登入者可讀，只有伺服器寫） |
| `sm.checkups` | AI 健檢報告，每人一份；`input_hash` 不等於目前資料的雜湊就視為過期 |
| `sm.rate_limits` | 登入與 AI 的固定視窗計數，只有伺服器讀寫 |

### 登入與資料隔離

- Email＋密碼（Better Auth）。session 存資料庫，cookie 只放 token（httpOnly、SameSite=Lax、正式環境 Secure）。登入／註冊／登出全部走 Server Action，並以資料庫計數限流（IP 與 Email 兩個維度）。
- `src/proxy.ts` 只做樂觀的未登入轉址；真正的檢查在 `(app)/layout.tsx` 的 `requireUser()` 與每個 Server Action。
- 每個資料操作都在 `withUser()` 交易內切換成 `authenticated` 角色，RLS policy 以 `auth.uid() = user_id` 擋下別人的資料；服務層的每個查詢仍自己帶 `user_id`。
- 同一計畫項目同一天只能有一筆有效服用紀錄：服務層先擋，資料庫的部分唯一索引 `intake_logs_taken_once_uq` 再擋一次。
- 伺服器日誌只記錯誤類型與資料庫錯誤碼，不記使用者輸入的內容；AI 回傳的內容一律經 zod 驗證才存、只以 React 文字節點顯示。

## 保健品小知識與建議方案

- 內建約 38 種常見保健品的小知識（`web/src/lib/knowledge/builtin.ts`）：常見服用時機與原因、一般攝取範圍、小知識、注意事項、建議分開／可以一起的組合。以正規化名稱比對，別名、英文、劑量字串都能對上（例如「Nordic Naturals Fish Oil 1000mg」→ 魚油）。
- 內建沒有的，使用者可按「請 AI 整理」：Gemini 結構化輸出，zod 驗證後存進共用快取 `sm.knowledge`，之後任何人查同名都直接用。快取只用使用者輸入的 slug 當鍵、別名只供顯示，避免模型輸出成為查詢鍵污染共用內容；名稱拒絕控制字元與角括號。
- 新增／編輯保健品時輸入名稱即顯示小知識與「套用為 ○○」；詳細頁可套用建議時段；「方案」頁排出一天的時段總覽、建議補上的時段、搭配提醒（要分開／可一起）與各項小知識。

## 一鍵健檢

「方案」頁進入 `/checkup`。先填選填的個人資料（保健目標多選、年齡區間、性別；只用來套用一般人口的常見差異，不收病史），按「開始健檢」：

- **內建規則**（`web/src/lib/knowledge/checkup.ts`，純函式、前端立刻算）：
  - 建議調整：小知識說要分開卻排同時段（優先）、時段尚未確認、隨餐／空腹與時段不合（可一鍵套用建議時段）、同一時段 5 項以上。
  - 可以考慮不用：同成分兩項以上（只在明確重複時出現）。
  - 建議增加：勾選的目標還沒有對應的保健品（列常見選擇）、年齡區間的常見補充、常見搭配還沒有（例如鈣→維生素 D）；同一名稱不重複建議，品名沒對到小知識時降為「可考慮」並說明可忽略。
  - 注意：綜合維他命與單方重疊的總量、成年男性或年長者長期補鐵先確認、未成年以專業建議為準。
- **AI 深度分析**（`web/src/lib/services/checkup.ts`）：把清單、個人資料與規則發現交給 Gemini，產生結構化報告（overview、add、remove、adjust、cautions、askProfessional）；remove／adjust 只保留清單裡的名稱。報告存在 `sm.checkups`，同樣的資料不重複分析、不扣額度；資料改了畫面會標「資料已變更」。
- 「建議增加」可一鍵帶到新增頁預填名稱（`/supplements/new?name=`）；套用時段、新增都要使用者按下。

## 介面主題與字型

兩套主題共用同一份頁面結構，長相由 `<html data-theme>` 的 CSS 決定（`web/src/app/globals.css`）；使用者在設定頁切換，選擇存在 `sm.profiles.theme`，另外寫 `sm-theme` cookie 讓伺服器端第一次渲染就套對主題，登入後 `ThemeSync` 再依個人設定校正。

- **C 繪本粗線**（預設）：奶油米底、炭黑 3px 線框、珊瑚紅與藍、粗圓體（Huninn＋Zen Maru Gothic）、點狀虛線底線；今日頁是左側黑直線串起時段的時間軸；深色區塊與 L 形轉角線。
- **E 旅行雜誌濃彩**：濃綠底、深藍／水藍／橘／黃色帶、白卡 3px 黑框＋黃標題條＋紅標籤、波浪分隔、黃點點、跑馬燈、大圓角綠容器；Montserrat＋Noto Sans TC。

文字一律深色或深底白字（對比達 WCAG AA），顏色只做背景、邊框與圖示；`prefers-reduced-motion` 時動畫關閉。設計稿在 `design/theme-proposals.html`。

App icon 是「四格藥盒」（膠囊、打勾、錠劑、愛心），C、E 各一套色（`web/public/icons/`，提案在 `design/icon-proposals.html`）。favicon、Apple touch icon 與 PWA manifest 都依 `sm-theme` cookie 跟著主題切換（`layout.tsx` 的 `generateMetadata`、`app/manifest.ts`）；PNG 由 SVG 以無頭瀏覽器轉出，`src/app/favicon.ico` 是 C 版的 16／32／48。

繁中字型（Huninn、Noto Sans TC，皆 SIL OFL 1.1）不用 `next/font/google`，改為自架分片：`scripts/subset-font.py` 用 fonttools 依 unicode-range 切成各 6 片 woff2（第 0 片是基本符號＋介面用到的中文字，其餘是 Big5 常用字），瀏覽器只下載用到的片；Noto Sans TC 保留可變字重軸。原因是 Vercel 建置時向 Google 下載幾百個分片偶爾回 500，整個 build 會跟著失敗。改了介面文案後重跑腳本，新字才會進第 0 片（不重跑也只是多一個請求）。英數字型（Zen Maru Gothic、Montserrat）體積小，仍走 `next/font/google`。

## 專案結構

```
web/
├─ db/migrations/             可重複執行的 SQL（auth schema → sm schema → knowledge → theme → checkup）
├─ scripts/migrate.ts         對 Neon 跑 migration 並驗證權限／RLS
├─ scripts/subset-font.py     把繁中字型切成自架的 woff2 分片（產生 src/app/fonts/）
├─ src/app/
│  ├─ layout.tsx              字型（英數 next/font、繁中自架）、主題 cookie、ToastProvider
│  ├─ fonts/                  Huninn、Noto Sans TC 的分片與 @font-face（OFL 授權）
│  ├─ actions.ts              Server Actions：登入／登出、資料操作、小知識、健檢（每個都自己檢查 session）
│  ├─ login/                  登入／註冊頁（本機示範模式可一鍵登入）
│  └─ (app)/                  登入後的頁面群：layout 內 requireUser → ThemeSync → StoreProvider → 底部導覽
│     ├─ today/ supplements/ inventory/ history/ guide/ checkup/ settings/
├─ src/components/            ui（button、card、field、dialog、toast、state、decor、icons…）、nav、today、supplements、inventory、knowledge、checkup
├─ src/lib/
│  ├─ types.ts constants.ts date.ts theme.ts
│  ├─ domain/                 ledger（勾選／取消／補貨／調整的純函式）、plan、inventory、validation
│  ├─ knowledge/              內建小知識、名稱比對、建議方案、健檢規則（純函式）、AI 提示與報告結構
│  ├─ ai/                     provider 介面、Gemini／mock、結構化輸出驗證與重試
│  ├─ db/                     client（Neon／PGlite）、schema、auth-schema、with-user（RLS）、local
│  ├─ auth/                   Better Auth 設定、session、示範使用者
│  ├─ services/               supplements、ledger、snapshot、profiles、sample、rate-limit、knowledge、checkup
│  └─ store/                  repository 介面、remote-repository（呼叫 Server Action）、store-provider（React context）
└─ tests/                     domain 單元測試＋services／auth／knowledge／checkup 整合測試（PGlite）、Neon 煙霧測試
```

## 測試

```bash
cd web
npm run test
```

| 檔案 | 涵蓋 |
|---|---|
| `ledger.test.ts`、`plan.test.ts`、`date-inventory.test.ts` | 勾選／取消／補貨／調整的純函式、計畫項目展開、日期與庫存計算 |
| `services.test.ts`、`auth.test.ts` | 服務層交易、RLS 擋別人的資料、重複扣庫存被擋、Better Auth 註冊登入與限流 |
| `knowledge.test.ts` | 內建資料 schema 與 slug、名稱比對、建議方案、小知識服務（快取、名稱驗證、mock 在 Gemini 環境視為未命中、限流順序） |
| `checkup.test.ts` | 健檢規則各情境、「套用建議時段後不會再被提醒」的內建資料不變量、報告清理、服務快取與過期、個人資料驗證 |
| `neon-smoke.test.ts` | 設 `SMOKE_DATABASE_URL=1` 時對 Neon 跑端到端流程 |

## 與規格的差異

- **服用時段改為陣列** `scheduleSlots: ScheduleSlot[]`，長度等於 `dailyFrequency`，每一次都可以各自設時段或「尚未確認」。規格 4.2 原本是單一 `scheduleSlot`，但同一產品一天多個時段時單一欄位無法表達；每次服用各成一個計畫項目，`planItemKey = supplementId|planDate|slot|序號` 作為防重複扣庫存的唯一鍵。
- **庫存不足仍要記錄**時，庫存照實扣除、允許為負並標示「庫存不足」，讓庫存數量與異動紀錄保持一致。
- **編輯時改動庫存數字**不直接覆蓋，而是記一筆 `adjustment` 異動。
- **後端**：規格建議 Firebase，本專案改用 Neon Postgres＋Better Auth；資料隔離改用 Postgres RLS 取代 Firestore Security Rules，勾選／取消／補貨放在資料庫交易內。
- **規格之外新增**：小知識與建議方案、一鍵健檢、兩套可切換的主題。

## 安全與內容原則

- 未確認的服用時段顯示「尚未確認」，系統不推定。
- 不提供醫療診斷、治療、停藥或劑量處方；所有建議標示「一般資訊，非醫療建議」，注意事項用「請先諮詢醫師或藥師」的語氣。
- 不儲存不必要的健康敏感資料：健檢只收保健目標、年齡區間、性別三個選填欄位，不收病史；日誌不記錄使用者輸入的內容。
- AI 只在使用者明確按下時呼叫、有次數上限；輸出經 schema 驗證、名稱經清理才存入；使用者文字放進提示詞前去掉角括號與換行。

## 進度

| 階段 | 狀態 |
|---|---|
| Step 1–4 MVP：四個主要頁面、CRUD、服用紀錄與庫存交易 | 完成 |
| Step 5 後端：Neon Postgres＋Better Auth＋RLS | 完成 |
| 第二階段：小知識＋建議方案（內建資料＋AI 補充） | 完成 |
| 介面主題：C／E 可切換 | 完成 |
| 一鍵健檢：內建規則＋AI 深度分析 | 完成 |
| Step 6 部署到 Vercel | 完成 |

已知可改進：查小知識失敗時前端不會自動重試；AI 產生結果寫入共用快取時無條件覆蓋；多個分頁同時按 AI 分析會各扣一次額度；AI 失敗不退額度。
