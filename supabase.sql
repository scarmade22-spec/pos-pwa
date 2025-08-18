-- Schemas & Extensions
create extension if not exists "uuid-ossp";

-- Tenants
create table if not exists public.tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profiles: 1 user -> 1 tenant
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  full_name text,
  created_at timestamptz not null default now()
);

-- Products
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  barcode text,
  created_at timestamptz not null default now()
);

-- Sales
create table if not exists public.sales (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cashier_id uuid not null references auth.users(id),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now()
);

-- Sale items
create table if not exists public.sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty integer not null check (qty > 0),
  price_cents integer not null check (price_cents >= 0)
);

-- Enable RLS
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- Helper: current tenant for user
create or replace function public.current_tenant_id()
returns uuid language sql security definer set search_path = public as $$
  select p.tenant_id
  from public.profiles p
  where p.user_id = auth.uid();
$$;

-- RLS Policies
-- Tenants: user can see only their own tenant
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select using ( id = public.current_tenant_id() );

-- Profiles: user can read only own profile; admins could extend later
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using ( user_id = auth.uid() );

-- Products: CRUD within tenant
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using ( tenant_id = public.current_tenant_id() );
drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert with check ( tenant_id = public.current_tenant_id() );
drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update using ( tenant_id = public.current_tenant_id() )
  with check ( tenant_id = public.current_tenant_id() );
drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete using ( tenant_id = public.current_tenant_id() );

-- Sales: CRUD within tenant (delete usually not allowed in prod)
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
  for select using ( tenant_id = public.current_tenant_id() );
drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales
  for insert with check ( tenant_id = public.current_tenant_id() );

-- Sale items: read items of sales in same tenant
drop policy if exists sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items
  for select using (
    exists (select 1 from public.sales s where s.id = sale_id and s.tenant_id = public.current_tenant_id())
  );
drop policy if exists sale_items_insert on public.sale_items;
create policy sale_items_insert on public.sale_items
  for insert with check (
    exists (select 1 from public.sales s where s.id = sale_id and s.tenant_id = public.current_tenant_id())
  );

-- RPC: create_sale_with_items(items json)
-- items = [{ "product_id": uuid, "qty": int }, ...]
create or replace function public.create_sale_with_items(items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid := uuid_generate_v4();
  v_tenant uuid := public.current_tenant_id();
  v_total int := 0;
  v_user uuid := auth.uid();
  rec jsonb;
  v_product_id uuid;
  v_qty int;
  v_price int;
begin
  if v_tenant is null then
    raise exception 'Profile not linked to a tenant';
  end if;

  -- lock & validate stock
  perform 1; -- placeholder

  -- Create sale header
  insert into public.sales(id, tenant_id, cashier_id, total_cents)
  values (v_sale_id, v_tenant, v_user, 0);

  for rec in select * from jsonb_array_elements(items)
  loop
    v_product_id := (rec->>'product_id')::uuid;
    v_qty := (rec->>'qty')::int;
    select price_cents into v_price from public.products
    where id = v_product_id and tenant_id = v_tenant
    for update;

    if v_price is null then
      raise exception 'Product not found or not in tenant';
    end if;

    -- decrement stock
    update public.products
    set stock = stock - v_qty
    where id = v_product_id and tenant_id = v_tenant and stock >= v_qty;
    if not found then
      raise exception 'Insufficient stock for product %', v_product_id;
    end if;

    insert into public.sale_items(sale_id, product_id, qty, price_cents)
    values (v_sale_id, v_product_id, v_qty, v_price);
    v_total := v_total + v_price * v_qty;
  end loop;

  update public.sales set total_cents = v_total where id = v_sale_id;
  return v_sale_id;
exception when others then
  -- rollback all
  raise;
end;
$$;

-- Expose RPC
grant execute on function public.create_sale_with_items(jsonb) to anon, authenticated;

-- Helpful seed: create a default tenant and link current user on first call (optional manual step)
-- insert into public.tenants(name) values ('Default');
-- insert into public.profiles(user_id, tenant_id, full_name) values ('<AUTH_USER_ID>', (select id from tenants limit 1), 'Owner');
