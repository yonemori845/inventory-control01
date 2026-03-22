-- 注文確定（単一トランザクション）機能設計 §6.4 / 技術仕様 §4.3.1
-- 税: 行ごと 税抜小計 = round(税抜単価 * 数量, 0) → 行税額 = round(税抜小計 * 税率, 0) → ヘッダは合算（src/lib/pricing.ts と同一ルール）

create or replace function public.place_order(
  p_lines jsonb,
  p_tax_rate numeric default 0.10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(14, 2) := 0;
  v_tax numeric(14, 2) := 0;
  v_total numeric(14, 2) := 0;
  r record;
  v_line_sub numeric(14, 2);
  v_line_tax numeric(14, 2);
  v_short jsonb := '[]'::jsonb;
  v_prefix text;
  v_seq int;
  v_day_start timestamptz;
  v_day_end timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception '明細が空です';
  end if;

  if p_tax_rate is null or p_tax_rate < 0 then
    raise exception '税率が不正です';
  end if;

  create temp table _place_agg (
    sku_id uuid not null primary key,
    qty int not null
  ) on commit drop;

  insert into _place_agg (sku_id, qty)
  select
    trim(elem ->> 'sku_id')::uuid,
    sum((elem ->> 'quantity')::int)::int
  from jsonb_array_elements(p_lines) as elem
  group by 1;

  if exists (select 1 from _place_agg where qty is null or qty <= 0) then
    raise exception '数量は 1 以上にしてください';
  end if;

  if exists (
    select 1 from _place_agg a
    left join public.product_skus s on s.id = a.sku_id
    where s.id is null
  ) then
    raise exception '存在しない SKU が含まれています';
  end if;

  for r in
    select a.sku_id, a.qty, s.sku_code, s.quantity as stock, s.unit_price_ex_tax, s.is_active
    from _place_agg a
    join public.product_skus s on s.id = a.sku_id
    for update of s
  loop
    if not r.is_active then
      v_short := v_short || jsonb_build_array(
        jsonb_build_object(
          'sku_code', r.sku_code,
          'requested', r.qty,
          'available', 0,
          'reason', 'inactive'
        )
      );
    elsif r.stock < r.qty then
      v_short := v_short || jsonb_build_array(
        jsonb_build_object(
          'sku_code', r.sku_code,
          'requested', r.qty,
          'available', r.stock,
          'reason', 'short'
        )
      );
    end if;
  end loop;

  if jsonb_array_length(v_short) > 0 then
    raise exception 'INSUFFICIENT_STOCK:%', v_short::text;
  end if;

  for r in
    select a.sku_id, a.qty, s.unit_price_ex_tax
    from _place_agg a
    join public.product_skus s on s.id = a.sku_id
  loop
    v_line_sub := round(r.unit_price_ex_tax * r.qty, 0);
    v_line_tax := round(v_line_sub * p_tax_rate, 0);
    v_subtotal := v_subtotal + v_line_sub;
    v_tax := v_tax + v_line_tax;
  end loop;

  v_total := v_subtotal + v_tax;

  v_day_start :=
    (date_trunc('day', (now() at time zone 'Asia/Tokyo')::timestamp)
     at time zone 'Asia/Tokyo');
  v_day_end := v_day_start + interval '1 day';
  v_prefix :=
    'ORD-'
    || to_char((now() at time zone 'Asia/Tokyo')::date, 'YYYYMMDD')
    || '-';

  select coalesce(max(
    nullif(
      substring(o.order_number from length(v_prefix) + 1),
      ''
    )::int
  ), 0)
  into v_seq
  from public.orders o
  where o.order_number like v_prefix || '%'
    and o.placed_at >= v_day_start
    and o.placed_at < v_day_end;

  v_order_number := v_prefix || lpad((v_seq + 1)::text, 4, '0');

  insert into public.orders (
    order_number,
    placed_at,
    subtotal_ex_tax,
    tax_amount,
    total_inc_tax,
    created_by
  )
  values (
    v_order_number,
    now(),
    v_subtotal,
    v_tax,
    v_total,
    v_uid
  )
  returning id into v_order_id;

  for r in
    select a.sku_id, a.qty, s.unit_price_ex_tax, s.sku_code
    from _place_agg a
    join public.product_skus s on s.id = a.sku_id
  loop
    v_line_sub := round(r.unit_price_ex_tax * r.qty, 0);

    insert into public.order_lines (
      order_id,
      sku_id,
      quantity,
      unit_price_ex_tax,
      line_subtotal_ex_tax
    )
    values (
      v_order_id,
      r.sku_id,
      r.qty,
      r.unit_price_ex_tax,
      v_line_sub
    );

    update public.product_skus
    set quantity = quantity - r.qty
    where id = r.sku_id;

    insert into public.inventory_movements (
      sku_id,
      quantity_delta,
      reason,
      reference_type,
      reference_id,
      performed_by
    )
    values (
      r.sku_id,
      -r.qty,
      'order_sale',
      'order',
      v_order_id,
      v_uid
    );
  end loop;

  return v_order_id;
end;
$$;

comment on function public.place_order(jsonb, numeric) is
  '注文確定: 在庫検証・orders/order_lines・在庫減・inventory_movements を 1 トランザクションで実行。税は pricing.ts と同じ丸め。';

grant execute on function public.place_order(jsonb, numeric) to authenticated;
