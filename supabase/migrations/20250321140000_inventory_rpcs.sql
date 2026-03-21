-- 在庫ドメイン用 RPC（単一トランザクション・認証必須）
-- 機能設計 §4.4 manual_adjust / §4.5 barcode_inbound / §4.3 csv_import

-- ---------------------------------------------------------------------------
-- 手動在庫更新
-- ---------------------------------------------------------------------------
create or replace function public.adjust_sku_quantity(p_sku_id uuid, p_new_quantity int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old int;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_new_quantity < 0 then
    raise exception 'quantity must be >= 0';
  end if;

  select quantity into v_old
  from public.product_skus
  where id = p_sku_id
  for update;

  if not found then
    raise exception 'sku not found';
  end if;

  if v_old = p_new_quantity then
    return;
  end if;

  update public.product_skus
  set quantity = p_new_quantity
  where id = p_sku_id;

  insert into public.inventory_movements (sku_id, quantity_delta, reason, performed_by)
  values (p_sku_id, p_new_quantity - v_old, 'manual_adjust', v_uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- JAN 入庫
-- ---------------------------------------------------------------------------
create or replace function public.barcode_inbound(p_jan text, p_qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_jan is null or trim(p_jan) = '' then
    raise exception 'jan is required';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'quantity must be > 0';
  end if;

  select id into v_id
  from public.product_skus
  where jan_code = trim(p_jan) and is_active = true
  for update;

  if not found then
    raise exception 'no active sku for jan %', trim(p_jan);
  end if;

  update public.product_skus
  set quantity = quantity + p_qty
  where id = v_id;

  insert into public.inventory_movements (sku_id, quantity_delta, reason, performed_by)
  values (v_id, p_qty, 'barcode_inbound', v_uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- CSV 一括取込（全件成功 or 全ロールバック）
-- p_rows: [{ group_code, group_name, sku_code, jan_code, name_variant?, color?, size?,
--            quantity, reorder_point, safety_stock, unit_price_ex_tax, is_active?, group_description?, sort_order? }]
-- ---------------------------------------------------------------------------
create or replace function public.import_product_csv_rows(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  i int;
  line_no int := 0;
  v_group_id uuid;
  v_sku_id uuid;
  v_old_qty int;
  v_new_qty int;
  v_delta int;
  v_uid uuid := auth.uid();
  v_sku text;
  v_jan text;
  v_price numeric(12, 2);
  v_rp int;
  v_ss int;
  v_active boolean;
  v_gname text;
  v_gdesc text;
  v_sort int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a json array';
  end if;

  if exists (
    select 1
    from (
      select trim(j.elem ->> 'sku_code') as sc, count(*) as n
      from jsonb_array_elements(p_rows) as j(elem)
      group by 1
    ) s
    where sc is null or sc = '' or n > 1
  ) then
    raise exception 'invalid or duplicate sku_code in file';
  end if;

  if exists (
    select 1
    from (
      select trim(j.elem ->> 'jan_code') as jc, count(*) as n
      from jsonb_array_elements(p_rows) as j(elem)
      where trim(coalesce(j.elem ->> 'jan_code', '')) <> ''
      group by 1
    ) s
    where n > 1
  ) then
    raise exception 'duplicate jan_code in file';
  end if;

  for i in 0 .. coalesce(jsonb_array_length(p_rows), 0) - 1 loop
    line_no := line_no + 1;
    r := p_rows -> i;
    v_sku := trim(r ->> 'sku_code');
    v_jan := trim(r ->> 'jan_code');
    v_gname := trim(r ->> 'group_name');

    if v_sku = '' or v_jan = '' then
      raise exception 'line %: sku_code and jan_code are required', line_no;
    end if;
    if trim(coalesce(r ->> 'group_code', '')) = '' or v_gname = '' then
      raise exception 'line %: group_code and group_name are required', line_no;
    end if;

    begin
      v_new_qty := (r ->> 'quantity')::int;
    exception
      when others then
        raise exception 'line %: invalid quantity', line_no;
    end;
    if v_new_qty is null or v_new_qty < 0 then
      raise exception 'line %: quantity must be an integer >= 0', line_no;
    end if;

    begin
      v_rp := coalesce(nullif(trim(r ->> 'reorder_point'), '')::int, 0);
      v_ss := coalesce(nullif(trim(r ->> 'safety_stock'), '')::int, 0);
    exception
      when others then
        raise exception 'line %: invalid reorder_point or safety_stock', line_no;
    end;

    begin
      v_price := coalesce(nullif(trim(r ->> 'unit_price_ex_tax'), '')::numeric, 0)::numeric(12, 2);
    exception
      when others then
        raise exception 'line %: invalid unit_price_ex_tax', line_no;
    end;

    v_active := case
      when lower(trim(coalesce(r ->> 'is_active', 'true'))) in ('false', '0', 'no') then false
      else true
    end;

    v_gdesc := nullif(trim(coalesce(r ->> 'group_description', '')), '');
    begin
      v_sort := coalesce(nullif(trim(r ->> 'sort_order'), '')::int, 0);
    exception
      when others then
        raise exception 'line %: invalid sort_order', line_no;
    end;

    insert into public.product_groups (group_code, name, description, sort_order, is_active)
    values (trim(r ->> 'group_code'), v_gname, v_gdesc, v_sort, true)
    on conflict (group_code) do update
    set
      name = excluded.name,
      description = coalesce(excluded.description, public.product_groups.description),
      sort_order = excluded.sort_order
    returning id into v_group_id;

    select id, quantity into v_sku_id, v_old_qty
    from public.product_skus
    where sku_code = v_sku
    for update;

    if found then
      if exists (
        select 1 from public.product_skus
        where jan_code = v_jan and id <> v_sku_id
      ) then
        raise exception 'line %: jan_code already used by another sku', line_no;
      end if;

      update public.product_skus
      set
        product_group_id = v_group_id,
        jan_code = v_jan,
        name_variant = nullif(trim(coalesce(r ->> 'name_variant', '')), ''),
        color = nullif(trim(coalesce(r ->> 'color', '')), ''),
        size = nullif(trim(coalesce(r ->> 'size', '')), ''),
        quantity = v_new_qty,
        reorder_point = v_rp,
        safety_stock = v_ss,
        unit_price_ex_tax = v_price,
        is_active = v_active
      where id = v_sku_id;

      v_delta := v_new_qty - v_old_qty;
      if v_delta <> 0 then
        insert into public.inventory_movements (sku_id, quantity_delta, reason, performed_by)
        values (v_sku_id, v_delta, 'csv_import', v_uid);
      end if;
    else
      if exists (select 1 from public.product_skus where jan_code = v_jan) then
        raise exception 'line %: jan_code already exists', line_no;
      end if;

      insert into public.product_skus (
        product_group_id,
        sku_code,
        jan_code,
        name_variant,
        color,
        size,
        quantity,
        reorder_point,
        safety_stock,
        unit_price_ex_tax,
        is_active
      )
      values (
        v_group_id,
        v_sku,
        v_jan,
        nullif(trim(coalesce(r ->> 'name_variant', '')), ''),
        nullif(trim(coalesce(r ->> 'color', '')), ''),
        nullif(trim(coalesce(r ->> 'size', '')), ''),
        v_new_qty,
        v_rp,
        v_ss,
        v_price,
        v_active
      )
      returning id into v_sku_id;

      if v_new_qty <> 0 then
        insert into public.inventory_movements (sku_id, quantity_delta, reason, performed_by)
        values (v_sku_id, v_new_qty, 'csv_import', v_uid);
      end if;
    end if;
  end loop;
end;
$$;

grant execute on function public.adjust_sku_quantity(uuid, int) to authenticated;
grant execute on function public.barcode_inbound(text, int) to authenticated;
grant execute on function public.import_product_csv_rows(jsonb) to authenticated;
