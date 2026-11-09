-- profiles.theme: user-selected UI theme (c = storybook / e = magazine). Idempotent.
alter table sm.profiles add column if not exists theme text not null default 'c';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_theme_check') then
    alter table sm.profiles add constraint profiles_theme_check check (theme in ('c', 'e'));
  end if;
end
$$;
