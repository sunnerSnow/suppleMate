# SuppleMate｜保健品管理助手

手機優先的保健品管理網頁：每日服用表、保健品清單、庫存與補貨提醒、服用歷史。
規格見 `SuppleMate_MVP規格.md`。

技術：Next.js 16（App Router）＋ TypeScript ＋ Tailwind 4 ＋ zod ＋ Drizzle ORM ＋ PostgreSQL（正式用 Neon，本機與測試用 PGlite）＋ Better Auth ＋ Vitest。

## 目前進度

| 階段 | 狀態 |
|---|---|
| Step 1 初始化專案 | 完成 |
| Step 2 四個主要頁面 | 完成 |
| Step 3 資料模型與 CRUD（新增／編輯／封存、表單驗證、空狀態與錯誤狀態） | 完成 |
| Step 4 服用紀錄與庫存交易（勾選／取消、防重複扣庫存、異動紀錄、低庫存計算） | 完成 |
| Step 5 後端：Neon Postgres＋Better Auth 登入＋RLS 依使用者隔離 | 完成（已接上 Neon） |
| 第二階段：保健品小知識＋建議方案（內建資料＋AI 補充） | 完成 |
| 介面主題：C 繪本粗線／E 旅行雜誌濃彩，使用者可切換 | 完成 |
| Step 6 部署到 Vercel | 未開始 |

## 快速開始（本機示範模式，不需要資料庫）

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

`.env.local` 沒有設定 `DATABASE_URL` 時就是**本機示範模式**：

- 資料存在 `web/.data/pglite`（已在 .gitignore），啟動時自動跑 migration。
- 登入頁可以一鍵以「示範使用者 A（有範例資料）／B（空的）」登入，兩位的資料互相看不到；也可以用 Email 註冊。
- 設定頁可重設為範例資料或清除全部資料。

其他指令：

| 指令 | 說明 |
|---|---|
| `npm run test` | Vitest：領域邏輯＋服務層／RLS／Better Auth 整合測試（記憶體內 PGlite） |
| `npm run lint`、`npm run typecheck`、`npm run build` | 品質檢查 |
| `npm run db:migrate` | 對 `DATABASE_URL_UNPOOLED`（或 `DATABASE_URL`）依序執行 `db/migrations/*.sql`，並驗證權限與 RLS |
| `npm run format` | Prettier |

## 接上 Neon（正式環境）

1. 在 https://console.neon.tech 建立一個**新的專案**（免費方案；區域建議 Singapore `ap-southeast-1`，`vercel.json` 把函式固定在 `sin1`）。不要跟其他 app 共用同一個資料庫：Better Auth 的帳號表都在 `auth` schema，會互相干擾。
2. 從 Neon 的 **Connect** 取兩條連線字串，寫進 `web/.env.local`（格式見 `.env.example`）：
   - `DATABASE_URL`：**pooled**（主機名稱含 `-pooler`），給應用程式用。
   - `DATABASE_URL_UNPOOLED`：**direct**（不含 `-pooler`），只給 migration 用。
   - `BETTER_AUTH_SECRET`：至少 32 個隨機字元（`openssl rand -base64 32`）。
   - 部署時另外設 `BETTER_AUTH_URL=https://<網址>`。
   - 注意：Neon 控制台匯出的名稱是 `DATABASE_URL`（direct）與 `DATABASE_URL_POOLED`（pooled），跟本專案的用法相反，貼的時候請對調。
3. 跑 migration（每份都可重複執行）：`npm run db:migrate`。也可以到 Neon 的 SQL Editor 依檔名順序貼 `db/migrations/` 裡的檔案。
4. `npm run dev` 後用 Email 註冊即可；示範使用者的按鈕只在沒有 `DATABASE_URL` 時出現。

正式環境（`NODE_ENV=production`）沒設 `DATABASE_URL` 會直接報錯，不會默默改用本機資料庫。Neon 免費方案的 compute 閒置會休眠，第一個請求多約半秒到一秒；pooled 連線是 PgBouncer transaction mode，程式已關閉 prepared statements，`withUser` 的 `set local role` 與 `set_config(..., true)` 都在交易內。

### 登入與資料隔離

- Email＋密碼（Better Auth），使用者、session、帳號表在 Postgres 的 `auth` schema，id 是 uuid；`sm.profiles.id` 直接引用。
- session 存資料庫，cookie 只放 token（httpOnly、SameSite=Lax、正式環境 Secure）。登入／註冊／登出全部走 Server Action，並以資料庫計數限流。
- `src/proxy.ts` 只做樂觀的未登入轉址；真正的檢查在 `(app)/layout.tsx` 的 `requireUser()` 與每個 Server Action。
- 每個資料操作都在 `withUser()` 交易內切換成 `authenticated` 角色，RLS policy 以 `auth.uid() = user_id` 擋下別人的資料；服務層的每個查詢仍自己帶 `user_id`。
- 同一計畫項目同一天只能有一筆有效服用紀錄：服務層先擋，資料庫的部分唯一索引 `intake_logs_taken_once_uq` 再擋一次。

## 專案結構

```
web/
├─ db/migrations/             可重複執行的 SQL（auth schema → sm schema）
├─ scripts/migrate.ts         對 Neon 跑 migration 並驗證權限／RLS
├─ src/app/
│  ├─ layout.tsx              字型、ToastProvider
│  ├─ actions.ts              Server Actions：登入／登出、資料操作（每個都自己檢查 session）
│  ├─ login/                  登入／註冊頁（本機示範模式可一鍵登入）
│  └─ (app)/                  登入後的頁面群：layout 內 requireUser → StoreProvider → 底部導覽
│     ├─ today/ supplements/ inventory/ history/ settings/
├─ src/components/            ui（button、card、field、dialog、toast、state、decor、tone…）、nav、today、supplements、inventory
├─ src/lib/
│  ├─ types.ts constants.ts date.ts theme.ts
│  ├─ knowledge/              內建小知識、名稱比對、建議方案（純函式）、AI 提示
│  ├─ ai/                     provider 介面、Gemini／mock、結構化輸出驗證
│  ├─ domain/                 ledger（勾選／取消／補貨／調整的純函式）、plan、inventory、validation
│  ├─ db/                     client（Neon／PGlite）、schema、auth-schema、with-user（RLS）、local
│  ├─ auth/                   Better Auth 設定、session、示範使用者
│  ├─ services/               supplements、ledger（交易內套用純函式）、snapshot、profiles、sample、rate-limit、knowledge
│  └─ store/                  repository 介面、remote-repository（呼叫 Server Action）、store-provider（React context）
└─ tests/                     domain 單元測試＋services／auth 整合測試（PGlite）
```

## 介面主題

兩套主題共用同一份頁面結構，長相由 `<html data-theme>` 的 CSS 決定（`web/src/app/globals.css`）；使用者在設定頁切換，選擇存在 `sm.profiles.theme`，另外寫 `sm-theme` cookie 讓伺服器端第一次渲染就套對主題。

- **C 繪本粗線**（預設）：奶油米底、炭黑 3px 線框、珊瑚紅與藍、粗圓體（Huninn＋Zen Maru Gothic）、點狀虛線底線；今日頁是左側黑直線串起時段的時間軸；深色區塊與 L 形轉角線。
- **E 旅行雜誌濃彩**：濃綠底、深藍／水藍／橘／黃色帶、白卡 3px 黑框＋黃標題條＋紅標籤、波浪分隔、黃點點、跑馬燈、大圓角綠容器；Montserrat＋Noto Sans TC。

設計稿在 `design/theme-proposals.html`。文字一律深色或深底白字，顏色只做背景、邊框與圖示；`prefers-reduced-motion` 時動畫關閉。

## 保健品小知識與建議方案

- 內建約 38 種常見保健品的小知識（`web/src/lib/knowledge/builtin.ts`）：常見服用時機與原因、一般攝取範圍、小知識、注意事項、建議分開／可以一起的組合。以正規化名稱比對（別名、英文、劑量字串都能對上）。
- 內建沒有的，使用者可按「請 AI 整理」：Gemini 結構化輸出（`AI_PROVIDER=gemini`；預設 `mock` 回示範內容），zod 驗證後存進共用快取 `sm.knowledge`，之後任何人查同名都直接用。每人每小時、全站每日有次數上限。
- 新增／編輯保健品時輸入名稱即顯示小知識與「套用為 ○○」；詳細頁可套用建議時段；「方案」頁排出一天的時段總覽、建議補上的時段、搭配提醒（要分開／可一起）與各項小知識。
- 原則：系統只顯示建議，使用者按「套用」才會寫進計畫；全部標示「一般資訊，非醫療建議」。

## 與規格的差異

- **服用時段改為陣列** `scheduleSlots: ScheduleSlot[]`，長度等於 `dailyFrequency`，每一次都可以各自設時段或「尚未確認」。規格 4.2 原本是單一 `scheduleSlot`，但同一產品一天多個時段時單一欄位無法表達；每次服用各成一個計畫項目，`planItemKey = supplementId|planDate|slot|序號` 作為防重複扣庫存的唯一鍵。
- **庫存不足仍要記錄**時，庫存照實扣除、允許為負並標示「庫存不足」，讓庫存數量與異動紀錄保持一致。
- **編輯時改動庫存數字**不直接覆蓋，而是記一筆 `adjustment` 異動。
- **後端**：規格建議 Firebase，本專案改用 Neon Postgres＋Better Auth；資料隔離改用 Postgres RLS 取代 Firestore Security Rules，勾選／取消／補貨放在資料庫交易內。

## 安全原則

- 未確認的服用時段顯示「尚未確認」，系統不推定。
- 不提供醫療診斷、治療或停藥建議。
- 不儲存不必要的健康敏感資料；日誌不記錄使用者輸入的內容。
