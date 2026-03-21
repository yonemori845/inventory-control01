-- 在庫管理システム 初版スキーマ（doc/機能設計書.md §6 相当）
-- Supabase SQL Editor または supabase db push で適用

-- ---------------------------------------------------------------------------
-- profiles（auth.users と 1:1）
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'アプリユーザープロフィール。id は auth.users.id と同一。';

-- ---------------------------------------------------------------------------
-- categories（任意）
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.categories (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- product_groups（親商品）
-- ---------------------------------------------------------------------------
create table public.product_groups (
  id uuid primary key default gen_random_uuid(),
  group_code text not null unique,
  name text not null,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create index product_groups_category_id_idx on public.product_groups (category_id);

-- ---------------------------------------------------------------------------
-- product_skus
-- ---------------------------------------------------------------------------
create table public.product_skus (
  id uuid primary key default gen_random_uuid(),
  product_group_id uuid not null references public.product_groups (id) on delete restrict,
  sku_code text not null unique,
  jan_code text not null unique,
  name_variant text,
  color text,
  size text,
  quantity int not null default 0,
  reorder_point int not null default 0,
  safety_stock int not null default 0,
  unit_price_ex_tax numeric(12, 2) not null default 0,
  image_path text,
  is_active boolean not null default true,
  constraint product_skus_quantity_non_negative check (quantity >= 0)
);

create index product_skus_product_group_id_idx on public.product_skus (product_group_id);

-- ---------------------------------------------------------------------------
-- inventory_movements
-- ---------------------------------------------------------------------------
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.product_skus (id) on delete restrict,
  quantity_delta int not null,
  reason text not null,
  reference_type text,
  reference_id uuid,
  performed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_movements_sku_id_idx on public.inventory_movements (sku_id);
create index inventory_movements_created_at_idx on public.inventory_movements (created_at desc);

-- ---------------------------------------------------------------------------
-- orders / order_lines
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  placed_at timestamptz not null default now(),
  subtotal_ex_tax numeric(14, 2) not null,
  tax_amount numeric(14, 2) not null,
  total_inc_tax numeric(14, 2) not null,
  created_by uuid references public.profiles (id) on delete set null
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  sku_id uuid not null references public.product_skus (id) on delete restrict,
  quantity int not null,
  unit_price_ex_tax numeric(12, 2) not null,
  line_subtotal_ex_tax numeric(14, 2) not null,
  constraint order_lines_quantity_positive check (quantity > 0)
);

create index order_lines_order_id_idx on public.order_lines (order_id);
create index order_lines_sku_id_idx on public.order_lines (sku_id);

-- ---------------------------------------------------------------------------
-- RLS：第1段階は「認証済みなら広め」（要件・技術仕様）。anon は不可。
-- 本番前にポリシー見直し推奨。
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.product_groups enable row level security;
alter table public.product_skus enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;

create policy "authenticated_select_profiles" on public.profiles for select to authenticated using (true);
create policy "authenticated_insert_profiles" on public.profiles for insert to authenticated with check (true);
create policy "authenticated_update_profiles" on public.profiles for update to authenticated using (true) with check (true);

create policy "authenticated_all_categories" on public.categories for all to authenticated using (true) with check (true);
create policy "authenticated_all_product_groups" on public.product_groups for all to authenticated using (true) with check (true);
create policy "authenticated_all_product_skus" on public.product_skus for all to authenticated using (true) with check (true);
create policy "authenticated_all_inventory_movements" on public.inventory_movements for all to authenticated using (true) with check (true);
create policy "authenticated_all_orders" on public.orders for all to authenticated using (true) with check (true);
create policy "authenticated_all_order_lines" on public.order_lines for all to authenticated using (true) with check (true);
