-- 保健品小知識的共用快取（AI 產生的卡片）。內建資料在程式碼裡，不存這張表。
-- 所有登入使用者都可讀；只有伺服器（表的擁有者）會寫入。可重複執行。

create table if not exists sm.knowledge (
  slug        text primary key,                      -- 正規化後的名稱（lib/knowledge/normalize.ts）
  name        text not null,
  aliases     text[] not null default '{}',          -- 正規化後的別名（只供顯示；查詢只用 slug，避免模型輸出成為查詢鍵）
  entry       jsonb not null,                        -- KnowledgeContent（zod 驗證過）
  source      text not null check (source in ('ai', 'mock')),
  model       text,
  prompt_version text not null,
  created_by  uuid references sm.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists knowledge_aliases_idx on sm.knowledge using gin (aliases);
drop trigger if exists knowledge_updated_at on sm.knowledge;
create trigger knowledge_updated_at before update on sm.knowledge for each row execute function sm.set_updated_at();

revoke all on sm.knowledge from anon, authenticated;
grant select on sm.knowledge to authenticated;
alter table sm.knowledge enable row level security;
drop policy if exists knowledge_read on sm.knowledge;
create policy knowledge_read on sm.knowledge for select to authenticated using (true);
