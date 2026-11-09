-- 主題代號改名：c → a（繪本粗線）、e → b（旅行雜誌濃彩）。可重複執行。
alter table sm.profiles drop constraint if exists profiles_theme_check;
update sm.profiles set theme = 'a' where theme = 'c';
update sm.profiles set theme = 'b' where theme = 'e';
alter table sm.profiles alter column theme set default 'a';
alter table sm.profiles add constraint profiles_theme_check check (theme in ('a', 'b'));
