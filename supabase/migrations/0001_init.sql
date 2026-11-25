-- =====================================================================
-- Inventory Skill Labs - complete database setup (single file; re-running keeps your data)
--
-- Access model (no Supabase Auth, no service-role key):
--   The Next.js server verifies the admin passcode, then sends it to Supabase in the
--   `x-admin-key` request header. Every table policy below only allows a request whose
--   header hashes to the value stored in private.inv_config. The public anon key on its
--   own can read and write nothing.
--
-- To CHANGE the passcode later, run (with your new code):
--   update private.inv_config
--      set value = encode(sha256(convert_to('NEW-PASSCODE', 'utf8')), 'hex')
--    where key = 'admin_passcode_hash';
--   ...and set the same ADMIN_PASSCODE in .env.local.
-- =====================================================================

-- ---------- enum (created first so legacy cleanup below can reference it) ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type public.user_status as enum ('inactive', 'active', 'pending', 'returned');
  end if;
end
$$;

-- ---------- 0) remove leftovers from the earlier email/Supabase-Auth version ----------
-- (only objects created by this app; they never held data)
drop trigger  if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.delete_admin(uuid);
drop function if exists public.is_admin();
drop function if exists public.create_tracked_user(text, text, text, text, public.user_status, jsonb);
drop function if exists public.update_tracked_user(uuid, text, text, text, text, public.user_status, jsonb);
-- the old tables are dropped ONLY when the old schema is detected (public.admins exists), so
-- re-running this file later never deletes your data.
do $$
begin
  if to_regclass('public.admins') is not null then
    drop table if exists public.user_components, public.tracked_users, public.products, public.admins cascade;
  end if;
end
$$;

-- ---------- 1) passcode check ----------
create schema if not exists private;                       -- not exposed through the API
revoke all on schema private from public, anon, authenticated;

create table if not exists private.inv_config (
  key   text primary key,
  value text not null
);
revoke all on private.inv_config from public, anon, authenticated;

-- sha256 of the admin passcode (the plain passcode lives only in .env.local)
insert into private.inv_config (key, value)
values ('admin_passcode_hash', '1b3d912e2bc5caa0cc54dca0da1b33e65b7f7b38bf73dc30b7899f96ae034c94')
on conflict (key) do update set value = excluded.value;

create or replace function public.inv_has_admin_key()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
      from private.inv_config c
     where c.key = 'admin_passcode_hash'
       and c.value = encode(
             sha256(convert_to(
               coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-admin-key', ''),
               'utf8')),
             'hex')
  );
$$;

revoke all on function public.inv_has_admin_key() from public;
grant execute on function public.inv_has_admin_key() to anon, authenticated;

-- ---------- 2) tables ----------
create or replace function public.inv_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  product_name        text not null,
  category            text not null,
  description         text,
  quantity            integer not null check (quantity >= 0),
  price               numeric(12, 2) check (price is null or price >= 0),
  purchase_date       date,
  warranty_check      text,
  minimum_stock_level integer check (minimum_stock_level is null or minimum_stock_level >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category);
create index if not exists products_name_idx     on public.products (lower(product_name));
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.inv_set_updated_at();

create table if not exists public.tracked_users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  mobile     text not null,
  usn        text not null,
  status     public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tracked_users_email_key  on public.tracked_users (lower(email));
-- mobile and USN may repeat across users (see 0004_allow_duplicate_mobile_usn.sql); email stays unique
drop index if exists public.tracked_users_mobile_key;
create index if not exists tracked_users_mobile_idx on public.tracked_users (mobile);
drop index if exists public.tracked_users_usn_key;
create index if not exists tracked_users_usn_idx    on public.tracked_users (usn);
create index        if not exists tracked_users_status_idx on public.tracked_users (status);
drop trigger if exists tracked_users_set_updated_at on public.tracked_users;
create trigger tracked_users_set_updated_at
  before update on public.tracked_users
  for each row execute function public.inv_set_updated_at();

create table if not exists public.user_components (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.tracked_users (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  product_name text not null,                       -- snapshot, as in the original model
  quantity     integer not null check (quantity > 0),
  issue_at     timestamptz not null default now(),
  return_date  timestamptz not null default (now() + interval '1 day'),
  created_at   timestamptz not null default now()
);
create index if not exists user_components_user_id_idx    on public.user_components (user_id);
create index if not exists user_components_product_id_idx on public.user_components (product_id);

-- ---------- 3) row level security: only requests carrying the admin passcode ----------
alter table public.products        enable row level security;
alter table public.tracked_users   enable row level security;
alter table public.user_components enable row level security;

drop policy if exists "products: admin only" on public.products;
create policy "products: admin only"        on public.products
  for all to anon, authenticated using (public.inv_has_admin_key()) with check (public.inv_has_admin_key());
drop policy if exists "tracked_users: admin only" on public.tracked_users;
create policy "tracked_users: admin only"   on public.tracked_users
  for all to anon, authenticated using (public.inv_has_admin_key()) with check (public.inv_has_admin_key());
drop policy if exists "user_components: admin only" on public.user_components;
create policy "user_components: admin only" on public.user_components
  for all to anon, authenticated using (public.inv_has_admin_key()) with check (public.inv_has_admin_key());

grant select, insert, update, delete on public.products, public.tracked_users, public.user_components
  to anon, authenticated;

-- ---------- 4) atomic business logic ----------
-- create_tracked_user: creates the user + components and deducts stock in ONE transaction.
-- Errors are raised as 'CODE:detail' and mapped to HTTP responses by the service layer.
create or replace function public.create_tracked_user(
  p_name       text,
  p_email      text,
  p_mobile     text,
  p_usn        text,
  p_status     public.user_status,
  p_components jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_comp    jsonb;
  v_product public.products%rowtype;
  v_qty     integer;
begin
  if not public.inv_has_admin_key() then
    raise exception 'UNAUTHORIZED:admin access required';
  end if;
  if p_components is null or jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) = 0 then
    raise exception 'INVALID:components required';
  end if;

  insert into public.tracked_users (name, email, mobile, usn, status)
  values (p_name, p_email, p_mobile, p_usn, p_status)
  returning id into v_user_id;

  for v_comp in select * from jsonb_array_elements(p_components)
  loop
    v_qty := (v_comp ->> 'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'INVALID:quantity must be greater than 0';
    end if;

    -- resolve the product (by id, else by name) and lock the row so stock cannot race
    if nullif(v_comp ->> 'product_id', '') is not null then
      select * into v_product from public.products
       where id = (v_comp ->> 'product_id')::uuid for update;
    else
      select * into v_product from public.products
       where product_name = (v_comp ->> 'product_name') order by created_at limit 1 for update;
    end if;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', coalesce(v_comp ->> 'product_name', v_comp ->> 'product_id');
    end if;
    if v_product.quantity < v_qty then
      raise exception 'INSUFFICIENT_STOCK:%', v_product.product_name;
    end if;

    update public.products set quantity = quantity - v_qty where id = v_product.id;

    insert into public.user_components (user_id, product_id, product_name, quantity, issue_at, return_date)
    values (
      v_user_id,
      v_product.id,
      v_product.product_name,
      v_qty,
      coalesce(nullif(v_comp ->> 'issue_at', '')::timestamptz, now()),
      coalesce(nullif(v_comp ->> 'return_date', '')::timestamptz, now() + interval '1 day')
    );
  end loop;

  return v_user_id;
end;
$$;

-- update_tracked_user: updates fields and (optionally) replaces the component rows atomically.
-- NULL arguments mean "leave unchanged". Like the original app, editing does not touch stock.
create or replace function public.update_tracked_user(
  p_id         uuid,
  p_name       text,
  p_email      text,
  p_mobile     text,
  p_usn        text,
  p_status     public.user_status,
  p_components jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_comp jsonb;
  v_qty  integer;
begin
  update public.tracked_users set
    name   = coalesce(p_name, name),
    email  = coalesce(p_email, email),
    mobile = coalesce(p_mobile, mobile),
    usn    = coalesce(p_usn, usn),
    status = coalesce(p_status, status)
  where id = p_id;

  if not found then
    raise exception 'NOT_FOUND:user';
  end if;

  if p_components is not null then
    delete from public.user_components where user_id = p_id;

    for v_comp in select * from jsonb_array_elements(p_components)
    loop
      v_qty := (v_comp ->> 'quantity')::integer;
      if v_qty is null or v_qty <= 0 then
        raise exception 'INVALID:quantity must be greater than 0';
      end if;
      insert into public.user_components (user_id, product_id, product_name, quantity, issue_at, return_date)
      values (
        p_id,
        nullif(v_comp ->> 'product_id', '')::uuid,
        v_comp ->> 'product_name',
        v_qty,
        coalesce(nullif(v_comp ->> 'issue_at', '')::timestamptz, now()),
        coalesce(nullif(v_comp ->> 'return_date', '')::timestamptz, now() + interval '1 day')
      );
    end loop;
  end if;
end;
$$;

revoke all on function public.create_tracked_user(text, text, text, text, public.user_status, jsonb) from public;
revoke all on function public.update_tracked_user(uuid, text, text, text, text, public.user_status, jsonb) from public;
grant execute on function public.create_tracked_user(text, text, text, text, public.user_status, jsonb) to anon, authenticated;
grant execute on function public.update_tracked_user(uuid, text, text, text, text, public.user_status, jsonb) to anon, authenticated;
