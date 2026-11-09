-- 健檢：個人資料多三個選填欄位（保健目標、年齡區間、性別），以及 AI 健檢報告的快取。可重複執行。
-- 年齡與性別只用來讓「建議增加」更貼近一般人口的常見需求，不存病史或其他健康敏感資料。

alter table sm.profiles add column if not exists health_goals text[] not null default '{}';
alter table sm.profiles add column if not exists age_range text;
alter table sm.profiles add column if not exists sex text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_age_range_check') then
    alter table sm.profiles add constraint profiles_age_range_check
      check (age_range is null or age_range in ('under_18', '18_29', '30_44', '45_64', '65_plus'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_sex_check') then
    alter table sm.profiles add constraint profiles_sex_check
      check (sex is null or sex in ('female', 'male', 'other'));
  end if;
end
$$;

-- AI 健檢報告：每位使用者一份（重跑就覆蓋）。input_hash 是產生當時的保健品清單＋個人資料的雜湊，
-- 不一致就視為過期，畫面會標示「資料已變更」；一致時直接回快取，不再扣 AI 額度。
create table if not exists sm.checkups (
  user_id        uuid primary key references sm.profiles (id) on delete cascade,
  input_hash     text not null,
  report         jsonb not null,                       -- CheckupReport（zod 驗證過）
  source         text not null check (source in ('ai', 'mock')),
  model          text,
  prompt_version text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
drop trigger if exists checkups_updated_at on sm.checkups;
create trigger checkups_updated_at before update on sm.checkups for each row execute function sm.set_updated_at();

revoke all on sm.checkups from anon, authenticated;
grant select, insert, update, delete on sm.checkups to authenticated;
alter table sm.checkups enable row level security;
drop policy if exists checkups_own on sm.checkups;
create policy checkups_own on sm.checkups for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
