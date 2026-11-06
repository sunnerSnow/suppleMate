# SuppleMate｜保健品管理助手

手機優先的保健品管理網頁：每日服用表、保健品清單、庫存與補貨提醒、服用歷史。
規格見 `SuppleMate_MVP規格.md`。

## 目前進度

| 階段 | 狀態 |
|---|---|
| Step 1 初始化專案（Next.js App Router、TypeScript、Tailwind、ESLint、Vitest） | 完成 |
| Step 2 四個主要頁面（示範模式，資料存於瀏覽器 localStorage） | 完成 |
| Step 3 資料模型與 CRUD（新增／編輯／封存、表單驗證、空狀態與錯誤狀態） | 完成 |
| Step 4 服用紀錄與庫存交易（勾選／取消、防重複扣庫存、異動紀錄、低庫存計算） | 完成（純函式＋單元測試） |
| Step 5 串接 Firebase（Auth、Firestore、Security Rules） | 未開始 |
| Step 6 測試與部署 | 未開始 |

示範模式下，第一次開啟會自動載入範例資料；可在「設定」頁重設或清除。

## 執行方式

```bash
cd web
npm install
npm run dev        # http://localhost:3000，會自動轉到 /today
npm run test       # Vitest 單元測試（領域邏輯與本機資料層）
npm run lint
npm run typecheck
npm run build
```

## 專案結構

```
web/src
├─ app/
│  ├─ layout.tsx               字型、ToastProvider、StoreProvider
│  ├─ page.tsx                 / → /today
│  └─ (app)/                   帶底部導覽的頁面群
│     ├─ today/                今日服用表（依時段分組、勾選／取消、庫存不足確認）
│     ├─ supplements/          清單、new、[id] 詳細（含異動帳）、[id]/edit
│     ├─ inventory/            庫存狀態、預估剩餘天數、補貨
│     ├─ history/              服用歷史（依日期篩選、顯示快照）
│     └─ settings/             時區、重設／清除示範資料
├─ components/
│  ├─ ui/                      button、card、badge、field、dialog、toast、state、icons、page-header
│  ├─ nav/bottom-nav.tsx
│  ├─ today/plan-item-card.tsx
│  ├─ supplements/supplement-form.tsx
│  └─ inventory/restock-dialog.tsx
└─ lib/
   ├─ types.ts                 Supplement / IntakeLog / InventoryTransaction / PlanItem
   ├─ constants.ts             時段、產品形式、庫存狀態的中文標籤
   ├─ date.ts                  使用者時區的「今天」、日期加減、顯示格式
   ├─ domain/
   │  ├─ ledger.ts             勾選／取消／補貨／調整的純函式（回傳新狀態＋要寫入的紀錄）
   │  ├─ plan.ts               把保健品展開成當日計畫項目、分組、進度
   │  ├─ inventory.ts          每日消耗量、預估剩餘天數、庫存狀態
   │  └─ validation.ts         zod 表單驗證
   └─ store/
      ├─ repository.ts         資料存取介面（Step 5 換成 Firestore 實作）
      ├─ local-repository.ts   localStorage 實作
      ├─ mock-data.ts          範例資料（透過 ledger 產生，保證帳目一致）
      └─ store-provider.tsx    React context：載入狀態、資料快照、操作與鎖定
```

## 與規格的差異

- **服用時段改為陣列** `scheduleSlots: ScheduleSlot[]`，長度等於 `dailyFrequency`，每一次都可以各自設時段或「尚未確認」。
  規格 4.2 原本是單一 `scheduleSlot`，但同一產品一天多個時段時（規格 4.3 也提到）單一欄位無法表達；
  每次服用各成一個計畫項目，`planItemKey = supplementId|planDate|slot|序號` 作為防重複扣庫存的唯一鍵。
- **庫存不足仍要記錄**時，庫存照實扣除、允許為負並標示「庫存不足」，讓庫存數量與異動紀錄保持一致。
- **編輯時改動庫存數字**不直接覆蓋，而是記一筆 `adjustment` 異動。

## 安全原則

- 未確認的服用時段顯示「尚未確認」，系統不推定。
- 不提供醫療診斷、治療或停藥建議。
- 資料存取層以介面抽象，正式串接 Firestore 時勾選／取消／補貨需放在 transaction 內。
