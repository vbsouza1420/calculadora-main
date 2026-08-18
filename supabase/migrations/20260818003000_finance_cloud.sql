create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
    sms_enabled boolean not null default false,
    sms_consent_at timestamptz,
    timezone text not null default 'America/Sao_Paulo',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.finance_data (
    user_id uuid primary key references auth.users(id) on delete cascade,
    payload jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create table if not exists public.sms_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    card_id text not null,
    event_type text not null,
    event_date date not null,
    message_sid text,
    created_at timestamptz not null default now(),
    unique (user_id, card_id, event_type, event_date)
);

alter table public.profiles enable row level security;
alter table public.finance_data enable row level security;
alter table public.sms_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "finance_select_own" on public.finance_data;
drop policy if exists "finance_insert_own" on public.finance_data;
drop policy if exists "finance_update_own" on public.finance_data;
drop policy if exists "sms_logs_select_own" on public.sms_logs;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "finance_select_own" on public.finance_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "finance_insert_own" on public.finance_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "finance_update_own" on public.finance_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "sms_logs_select_own" on public.sms_logs for select to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.finance_data to authenticated;
grant select on public.sms_logs to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
    insert into public.finance_data (user_id) values (new.id) on conflict (user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
