-- SuppleMate 資料表（sm schema）：個人設定、保健品、服用紀錄、庫存異動、限流。
-- 本機 PGlite 與正式 Postgres（Neon）都執行本檔；可重複執行（if not exists、drop policy if exists）。
--
-- 規則（與 src/lib/domain/ledger.ts 對應）：
-- * 所有個人資料以 user_id 隔離；RLS 以 auth.uid() = user_id 為第二道防線，服務層每個查詢仍自己帶 user_id。
-- * 同一計畫項目（plan_item_key）同一位使用者只能有一筆 status = 'taken' 的服用紀錄（部分唯一索引），
--   伺服器交易內的檢查之外，資料庫也擋重複扣庫存。
-- * 數量用 numeric(12,3)，單位另存，避免「顆」與「mL」相加。

create schema if not exists sm;

create or replace function sm.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles：對應 auth.users 的個人設定（時區預設 Asia/Taipei）
-- ---------------------------------------------------------------------------
create table if not exists sm.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  timezone     text not null default 'Asia/Taipei' check (char_length(timezone) between 1 and 64),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists profiles_updated_at on sm.profiles;
create trigger profiles_updated_at before update on sm.profiles for each row execute function sm.set_updated_at();

-- ---------------------------------------------------------------------------
-- supplements：保健品與目前庫存
-- ---------------------------------------------------------------------------
create table if not exists sm.supplements (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references sm.profiles (id) on delete cascade,
  name                text not null check (char_length(btrim(name)) between 1 and 60),
  brand               text check (brand is null or char_length(brand) <= 60),
  product_form        text check (product_form is null or product_form in ('capsule', 'tablet', 'powder', 'liquid', 'other')),
  serving_size        text check (serving_size is null or char_length(serving_size) <= 30),
  dose_per_intake     numeric(12,3) not null check (dose_per_intake >= 0),
  dose_unit           text not null check (char_length(dose_unit) between 1 and 10),
  daily_frequency     int not null check (daily_frequency between 1 and 6),
  schedule_slots      text[] not null check (
                        cardinality(schedule_slots) = daily_frequency
                        and schedule_slots <@ array['before_breakfast','after_breakfast','before_lunch','after_lunch','before_dinner','after_dinner','bedtime','unconfirmed']::text[]
                      ),
  stock_quantity      numeric(12,3) not null,
  low_stock_threshold numeric(12,3) not null check (low_stock_threshold >= 0),
  expiration_date     date,
  notes               text check (notes is null or char_length(notes) <= 500),
  status              text not null default 'active' check (status in ('active', 'archived')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists supplements_user_idx on sm.supplements (user_id, status);
drop trigger if exists supplements_updated_at on sm.supplements;
create trigger supplements_updated_at before update on sm.supplements for each row execute function sm.set_updated_at();

-- ---------------------------------------------------------------------------
-- intake_logs：服用紀錄（保存當時的名稱、用量、單位快照）
-- ---------------------------------------------------------------------------
create table if not exists sm.intake_logs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references sm.profiles (id) on delete cascade,
  supplement_id            uuid not null references sm.supplements (id) on delete cascade,
  plan_date                date not null,
  plan_slot                text not null check (plan_slot in ('before_breakfast','after_breakfast','before_lunch','after_lunch','before_dinner','after_dinner','bedtime','unconfirmed')),
  plan_item_key            text not null check (char_length(plan_item_key) <= 120),
  supplement_name_snapshot text not null,
  dose_snapshot            numeric(12,3) not null,
  unit_snapshot            text not null,
  status                   text not null check (status in ('taken', 'reversed')),
  taken_at                 timestamptz,
  reversed_at              timestamptz,
  created_at               timestamptz not null default now()
);
create index if not exists intake_logs_user_date_idx on sm.intake_logs (user_id, plan_date desc);
-- 同一計畫項目同一天只能有一筆有效（taken）紀錄
create unique index if not exists intake_logs_taken_once_uq on sm.intake_logs (user_id, plan_item_key) where status = 'taken';

-- ---------------------------------------------------------------------------
-- inventory_transactions：庫存異動（入庫為正、扣庫存為負）；加總應等於 supplements.stock_quantity
-- ---------------------------------------------------------------------------
create table if not exists sm.inventory_transactions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references sm.profiles (id) on delete cascade,
  supplement_id         uuid not null references sm.supplements (id) on delete cascade,
  type                  text not null check (type in ('initial', 'intake', 'reversal', 'restock', 'adjustment')),
  quantity_delta        numeric(12,3) not null,
  related_intake_log_id uuid references sm.intake_logs (id) on delete set null,
  note                  text check (note is null or char_length(note) <= 300),
  created_at            timestamptz not null default now()
);
create index if not exists inventory_transactions_user_supp_idx on sm.inventory_transactions (user_id, supplement_id, created_at desc);

-- ---------------------------------------------------------------------------
-- rate_limits：登入／註冊嘗試的固定視窗計數；只有伺服器讀寫
-- ---------------------------------------------------------------------------
create table if not exists sm.rate_limits (
  key          text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);
create index if not exists rate_limits_window_idx on sm.rate_limits (window_start);

-- ---------------------------------------------------------------------------
-- 權限與 RLS
-- ---------------------------------------------------------------------------
grant usage on schema sm to authenticated;
revoke all on all tables in schema sm from authenticated, anon;

grant select, insert, update on sm.profiles to authenticated;
grant select, insert, update, delete on sm.supplements to authenticated;
grant select, insert, update, delete on sm.intake_logs to authenticated;
grant select, insert, update, delete on sm.inventory_transactions to authenticated;

alter table sm.profiles               enable row level security;
alter table sm.supplements            enable row level security;
alter table sm.intake_logs            enable row level security;
alter table sm.inventory_transactions enable row level security;
alter table sm.rate_limits            enable row level security;

drop policy if exists profiles_own on sm.profiles;
create policy profiles_own on sm.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists supplements_own on sm.supplements;
create policy supplements_own on sm.supplements for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists intake_logs_own on sm.intake_logs;
create policy intake_logs_own on sm.intake_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists inventory_transactions_own on sm.inventory_transactions;
create policy inventory_transactions_own on sm.inventory_transactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
