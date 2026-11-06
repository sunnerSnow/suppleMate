# SuppleMate｜保健品管理助手 MVP 規格

> 第一階段：先完成保健品「管理層」，包含每日服用表、保健品清單、庫存管理與服用紀錄。  
> 本文件可作為 Claude、Cursor 或其他 AI coding agent 的實作規格。

## 1. 產品目標

建立一個手機優先、響應式的保健品管理網頁，讓使用者可以：

1. 登錄目前持有的保健品。
2. 建立每日服用計畫，依時段查看。
3. 勾選實際服用紀錄。
4. 依服用紀錄自動更新庫存。
5. 查看剩餘數量、預估可用天數及補貨提醒。

### 第一階段範圍

**包含**
- 保健品 CRUD（新增、查看、編輯、封存／刪除）
- 每日服用計畫
- 服用完成勾選與取消
- 庫存扣除與回補
- 庫存不足提醒
- 服用歷史紀錄
- 基本登入與個人資料隔離（若採 Firebase）

**暫不包含**
- AI 成分重複分析
- 醫療／用藥交互作用判斷
- 照片 OCR／瓶身辨識
- 自動購買或電商串接
- 推播通知（可列為後續版本）
- 對保健品提供診斷或治療建議

> 安全原則：服用時段與用量由使用者依產品標示或專業人員建議輸入。未確認的服用安排應顯示「尚未確認」，不可由系統自行猜測。

---

## 2. 主要導覽與頁面

底部導覽列共 4 個頁籤：

| 頁面 | 路徑建議 | 目的 |
|---|---|---|
| 今日 | `/today` | 查看當日服用計畫及完成進度 |
| 保健品 | `/supplements` | 管理保健品資料 |
| 庫存 | `/inventory` | 查看庫存、預估剩餘天數與補貨狀態 |
| 紀錄 | `/history` | 查看每日服用歷史 |

另有：
- 新增／編輯保健品頁或 Modal
- 保健品詳細資料頁
- 設定頁（時區、每日提醒門檻等，可簡化）

## 3. 頁面功能與 UI

### 3.1 今日服用表 `/today`

以日期為主，將項目依下列時段分組：

1. 早餐前
2. 早餐後
3. 午餐前
4. 午餐後
5. 晚餐前
6. 晚餐後
7. 睡前
8. 尚未確認

每個項目顯示：
- 保健品名稱
- 每次用量（例如 1 顆、2 粒、5 mL）
- 服用時段
- 備註（選填）
- 完成勾選狀態

頁面頂部顯示：
- 日期與前／後一天切換
- 今日完成數／應完成數
- 完成進度（例如 2 / 5）

互動：
- 勾選「已服用」：建立該日期的服用紀錄，並依實際用量扣除庫存。
- 取消勾選：撤銷該筆紀錄，回補庫存。
- 同一計畫同一天不得重複扣庫存。
- 若庫存不足，顯示提醒；不可讓庫存無聲地變成負數。可允許使用者明確確認「仍要記錄」，但須標示庫存不足。
- 已封存或停用的保健品不出現在今日計畫。

空狀態：
「還沒有保健品，先新增一項，建立你的每日服用表。」
按鈕：「新增保健品」

### 3.2 保健品清單 `/supplements`

顯示卡片或列表：
- 名稱、品牌
- 每日用量摘要
- 目前庫存
- 狀態（使用中／已封存）
- 編輯操作

支援：
- 搜尋名稱／品牌
- 新增保健品
- 編輯資料
- 封存保健品（建議優先封存，不直接刪除歷史資料）

### 3.3 新增／編輯保健品表單

欄位：

| 欄位 | 必填 | 範例／規則 |
|---|---|---|
| 名稱 | 是 | 魚油 |
| 品牌 | 否 | 品牌名稱 |
| 產品形式 | 否 | 膠囊、錠劑、粉末、液體、其他 |
| 每份數量 | 否 | 1 顆、2 粒、5 mL |
| 每次服用量 | 是 | 數值 + 單位 |
| 每日次數 | 是 | 1、2、3… |
| 服用時段 | 是 | 上述時段之一，或「尚未確認」 |
| 初始／目前庫存 | 是 | 非負數 |
| 低庫存門檻 | 是 | 非負數，預設可由使用者調整 |
| 有效期限 | 否 | 日期 |
| 備註 | 否 | 依產品標示等 |

驗證：
- 數量必須為有效數字且不可小於 0。
- 每日次數必須為正整數。
- 單位需保存，避免將「顆」與「mL」直接相加。
- 編輯服用量不應回頭改寫既有服用紀錄。
- 若變更每日計畫，從生效日期起套用；歷史紀錄保留當時快照。

### 3.4 庫存 `/inventory`

每個項目顯示：
- 保健品名稱
- 目前剩餘量／單位
- 預估剩餘天數
- 低庫存門檻
- 狀態：庫存充足／即將補貨／庫存不足
- 「補貨」操作

預估剩餘天數：
`目前庫存 ÷ 每日預計消耗量`

每日預計消耗量：
`每次服用量 × 每日次數`

規則：
- 若每日計畫尚未確認或每日消耗量為 0，顯示「尚無法估算」。
- 剩餘天數向下取整，避免高估。
- 低庫存狀態以使用者設定的門檻為準。
- 可另提供「預估 X 天內用完」提示。

補貨流程：
1. 點擊「補貨」。
2. 輸入新增數量。
3. 選填購買日期、有效期限、備註。
4. 確認後增加庫存並新增庫存異動紀錄。

### 3.5 服用歷史 `/history`

顯示：
- 日期
- 保健品名稱
- 當次用量
- 服用時段
- 完成時間
- 狀態（已服用／已撤銷）

支援依日期篩選。歷史紀錄保存當時的名稱、用量與單位快照，避免產品後續改名或改量造成歷史失真。

---

## 4. 資料模型（Firestore 建議）

可採用以下集合。所有個人資料都必須依 `userId` 隔離。

### 4.1 `users/{userId}`

```ts
type UserProfile = {
  displayName?: string;
  timezone: string; // 預設 Asia/Taipei
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

### 4.2 `users/{userId}/supplements/{supplementId}`

```ts
type Supplement = {
  id: string;
  name: string;
  brand?: string;
  productForm?: "capsule" | "tablet" | "powder" | "liquid" | "other";

  dosePerIntake: number;
  doseUnit: string; // 顆、粒、錠、mL、包等
  dailyFrequency: number;

  scheduleSlot:
    | "before_breakfast"
    | "after_breakfast"
    | "before_lunch"
    | "after_lunch"
    | "before_dinner"
    | "after_dinner"
    | "bedtime"
    | "unconfirmed";

  stockQuantity: number;
  lowStockThreshold: number;
  expirationDate?: string; // YYYY-MM-DD

  notes?: string;
  status: "active" | "archived";

  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

### 4.3 `users/{userId}/intakeLogs/{logId}`

```ts
type IntakeLog = {
  id: string;
  supplementId: string;
  planDate: string; // 使用者時區 YYYY-MM-DD
  planSlot: string;

  supplementNameSnapshot: string;
  doseSnapshot: number;
  unitSnapshot: string;

  status: "taken" | "reversed";
  takenAt?: Timestamp;
  reversedAt?: Timestamp;

  createdAt: Timestamp;
};
```

建議以 `supplementId + planDate + planSlot` 或獨立 `planItemId` 建立唯一性控制，避免同一計畫項目重複扣庫存。若同一產品一天有多個時段，需以計畫項目 ID 區分。

### 4.4 `users/{userId}/inventoryTransactions/{transactionId}`

```ts
type InventoryTransaction = {
  id: string;
  supplementId: string;
  type: "initial" | "intake" | "reversal" | "restock" | "adjustment";
  quantityDelta: number; // 入庫為正，扣庫存為負
  relatedIntakeLogId?: string;
  note?: string;
  createdAt: Timestamp;
};
```

庫存異動紀錄用於追蹤每次增加、扣除、回補與人工調整。庫存數量與異動紀錄必須保持一致。

---

## 5. 庫存與服用紀錄規則

### 勾選服用
1. 檢查該計畫項目當日是否已有有效服用紀錄。
2. 檢查庫存是否足夠。
3. 在 Firestore transaction 中建立服用紀錄、扣除庫存、建立異動紀錄。
4. 更新 UI。

### 取消服用
1. 確認該筆紀錄目前狀態為 `taken`。
2. 在 transaction 中將紀錄改為 `reversed`。
3. 回補原本扣除的數量。
4. 建立 `reversal` 異動紀錄。
5. 防止重複撤銷造成多次回補。

### 庫存調整
使用者可以手動修正庫存。不要直接覆蓋而不留紀錄；建立 `adjustment` 異動並保存原因。

### 日期與時區
- 以使用者時區（預設 `Asia/Taipei`）計算每日計畫日期。
- 不要直接用 UTC 日期判斷台灣使用者的「今天」。
- 服用紀錄同時保存計畫日期與實際時間。

---

## 6. 安全與資料權限

若使用 Firebase：
- 啟用 Firebase Authentication。
- 使用者只能讀寫自己的 `users/{userId}` 子集合。
- Firestore Security Rules 必須驗證 `request.auth.uid == userId`。
- 不可只依賴前端隱藏按鈕來保護資料。
- API Key 不可放入公開或未受控的伺服器端程式碼。
- 不儲存不必要的健康敏感資料。
- MVP 不提供醫療診斷、治療或停藥建議。

---

## 7. UI/UX 方向

視覺方向：
- 清爽、溫和、可信賴的健康管理工具。
- 奶油白或淺灰底色，搭配柔和綠色作為完成狀態。
- 卡片留白充足，手機上容易點擊。
- 重要資訊優先：名稱、用量、時段、剩餘量。
- 避免過度醫療化或充滿警告色。

建議元件：
- Bottom navigation
- Daily progress
- Time-slot section
- Supplement card
- Stock status badge
- Add/edit form
- Restock dialog
- Empty state
- Toast／錯誤提示

---

## 8. 開發步驟

### Step 1：初始化專案
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui（可選）
- ESLint

### Step 2：完成靜態 UI
先用 mock data 完成：
- 今日服用表
- 保健品列表
- 庫存列表
- 歷史紀錄
- 新增／編輯表單

### Step 3：建立資料模型與 CRUD
- 建立 Supplement 型別
- 完成新增、編輯、封存
- 表單驗證
- 空狀態與錯誤狀態

### Step 4：完成服用紀錄與庫存交易
- 勾選服用
- 取消服用
- 防止重複扣庫存
- 庫存異動紀錄
- 低庫存計算

### Step 5：串接 Firebase
- Firebase Authentication
- Cloud Firestore
- Security Rules
- 依使用者隔離資料

### Step 6：測試與部署
- 測試不同時段與多次服用
- 測試重複點擊與取消
- 測試庫存不足
- 測試跨日與時區
- 部署至 Vercel 或 Firebase Hosting

---

## 9. 驗收條件（Acceptance Criteria）

- [ ] 使用者可新增、編輯、封存保健品。
- [ ] 每項保健品可設定用量、每日次數、時段與庫存。
- [ ] 今日頁依時段顯示服用清單。
- [ ] 勾選服用後只扣庫存一次。
- [ ] 取消服用後只回補一次。
- [ ] 重新整理頁面後資料仍存在。
- [ ] 庫存頁可顯示剩餘量與預估剩餘天數。
- [ ] 低庫存項目會被清楚標示。
- [ ] 補貨後庫存正確增加。
- [ ] 歷史紀錄保留當時名稱、用量與單位。
- [ ] 不同使用者無法存取彼此資料。
- [ ] 未確認的服用時段不會被系統擅自推定。
- [ ] 手機與桌面版均可正常使用。

---

## 10. 給 AI Coding Agent 的實作 Prompt

請依照本文件開發 SuppleMate 保健品管理助手 MVP。

實作要求：

1. 使用 Next.js App Router、TypeScript、Tailwind CSS。
2. 先完成完整可操作的前端 UI，再串接 Firebase。
3. UI 使用繁體中文，並以手機優先設計。
4. 建立清楚的資料型別、元件與資料存取層，不要把所有邏輯塞進單一頁面。
5. 所有庫存扣除、回補與服用紀錄必須避免重複執行；正式串接 Firestore 時使用 transaction。
6. 不要自行推定保健品的服用建議；使用者未確認時顯示「尚未確認」。
7. 加入 loading、empty、error、success 等狀態。
8. 先列出專案檔案結構與實作計畫，再逐步實作。
9. 每完成一個階段，說明修改檔案、執行方式與測試方式。
10. 請勿在 MVP 中加入未規劃的 AI 醫療建議或自動停用保健品功能。

請先完成 Step 1 與 Step 2：初始化專案並建立使用 mock data 的四個主要頁面，確保 UI 可操作，再繼續串接資料庫。
