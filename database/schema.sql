-- E-Commerce and Order Management
-- Run this complete script once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name varchar(80) not null check (char_length(trim(name)) between 2 and 80),
  email varchar(254) not null unique,
  password_hash text not null,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name varchar(140) not null,
  description text not null default '',
  category varchar(60) not null,
  price numeric(10,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  emoji varchar(12) not null default '🛍️',
  color varchar(30) not null default '#f1f0ff',
  tag varchar(40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete restrict,
  order_number varchar(80) not null unique,
  status text not null default 'Placed' check (status in ('Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name varchar(140) not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_products_category_active on public.products(category, active);
create index if not exists idx_products_name on public.products(name);
create index if not exists idx_orders_user_created on public.orders(user_id, created_at desc);
create index if not exists idx_order_items_order on public.order_items(order_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

-- One transaction creates an order, verifies current stock under row locks,
-- decrements inventory, and inserts order items.
create or replace function public.place_customer_order(
  p_user_id uuid,
  p_order_number text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_product products%rowtype;
  v_quantity integer;
  v_lines jsonb := '[]'::jsonb;
begin
  if p_user_id is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'INVALID_ORDER';
  end if;

  -- Lock product rows in stable ID order to reduce deadlock risk.
  for v_item in
    select value from jsonb_array_elements(p_items)
    order by (value->>'product_id')
  loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 99 then raise exception 'INVALID_QUANTITY'; end if;
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid for update;
    if not found or not v_product.active then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if v_product.stock < v_quantity then raise exception 'INSUFFICIENT_STOCK'; end if;
    v_total := v_total + v_product.price * v_quantity;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'quantity', v_quantity,
      'unit_price', v_product.price
    ));
  end loop;

  insert into public.orders(user_id, order_number, total_amount)
    values (p_user_id, p_order_number, v_total)
    returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(v_lines)
  loop
    update public.products set stock = stock - (v_item->>'quantity')::integer
      where id = (v_item->>'product_id')::uuid;
    insert into public.order_items(order_id, product_id, product_name, quantity, unit_price)
      values (v_order_id, (v_item->>'product_id')::uuid, v_item->>'product_name',
              (v_item->>'quantity')::integer, (v_item->>'unit_price')::numeric);
  end loop;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', p_order_number,
    'status', 'Placed',
    'total_amount', v_total,
    'created_at', now(),
    'items', v_lines
  );
end;
$$;

-- App tables are accessed through the Express server using a server-only key.
-- RLS is enabled to block direct anon/authenticated access; never expose the server key.
alter table public.app_users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.app_users from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;

-- This function is called only by the Express backend using its server-side key.
revoke all on function public.place_customer_order(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.place_customer_order(uuid, text, jsonb) to service_role;

-- Starter products: rerunning the script does not duplicate them.
insert into public.products(name, description, category, price, stock, emoji, color, tag)
select * from (values
 ('Wireless Headphones','Comfortable everyday audio with a clean, modern look.','Electronics',1499.00,18,'🎧','#eeecff','Popular'),
 ('Smart Watch','A simple wearable for everyday activity and notifications.','Electronics',2299.00,12,'⌚','#e4f8ef','Trending'),
 ('Everyday Sneakers','Lightweight casual shoes for your daily routine.','Fashion',1799.00,20,'👟','#fff0e5','New'),
 ('Canvas Backpack','Roomy everyday backpack for college and short trips.','Accessories',999.00,25,'🎒','#eaf3ff',null),
 ('Ceramic Coffee Mug','A cheerful mug for your coffee or tea break.','Home',349.00,30,'☕','#fff3d9',null),
 ('Desk Lamp','A compact lamp for study sessions and desk setups.','Home',799.00,14,'💡','#fff0e5','Study pick'),
 ('Classic Sunglasses','A versatile accessory for sunny days.','Fashion',599.00,16,'🕶️','#e8f8f2',null),
 ('Bluetooth Speaker','Portable sound for your favourite playlists.','Electronics',1199.00,10,'🔊','#f2eaff','Popular')
) as seed(name, description, category, price, stock, emoji, color, tag)
where not exists (select 1 from public.products p where p.name = seed.name);
