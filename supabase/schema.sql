-- 우리집 물건 지도 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.

-- 1) 가족 명단: 여기에 있는 이메일만 데이터를 보고 고칠 수 있습니다.
create table if not exists public.household_members (
  email text primary key
);

-- 2) 물건
create table if not exists public.items (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 200),
  category   text,
  qty        numeric default 1,
  room       text,
  spot       text,
  expiry     date,
  memo       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text default (auth.jwt() ->> 'email')
);
create index if not exists items_expiry_idx on public.items (expiry) where expiry is not null;

-- 3) 설정 (한 줄짜리)
create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),
  alert_days int not null default 3 check (alert_days between 0 and 60)
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- updated_at / updated_by 자동 갱신
create or replace function public.touch_item() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', new.updated_by);
  return new;
end $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_item();

-- 현재 로그인한 사람이 가족 명단에 있는지
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- 행 수준 보안(RLS)
alter table public.household_members enable row level security;
alter table public.items             enable row level security;
alter table public.settings          enable row level security;

drop policy if exists "members read members" on public.household_members;
create policy "members read members" on public.household_members
  for select to authenticated using (public.is_member());

drop policy if exists "members all items" on public.items;
create policy "members all items" on public.items
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "members read settings" on public.settings;
create policy "members read settings" on public.settings
  for select to authenticated using (public.is_member());
drop policy if exists "members update settings" on public.settings;
create policy "members update settings" on public.settings
  for update to authenticated using (public.is_member()) with check (public.is_member());

-- 실시간 반영 (다른 가족이 고치면 바로 보이게)
do $$
begin
  begin alter publication supabase_realtime add table public.items;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.settings; exception when duplicate_object then null; end;
end $$;

-- 4) 가족 이메일 등록 — 아래 주소를 실제 이메일로 바꿔서 실행하세요. (이 줄은 깃에 실제 주소로 커밋하지 마세요)
-- insert into public.household_members (email) values
--   ('me@example.com'),
--   ('family@example.com')
-- on conflict do nothing;
