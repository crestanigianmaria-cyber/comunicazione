-- Warehouse/depot label and shared per-product alternative units.
alter table public.orders
  add column if not exists warehouse_location text not null default 'MAGAZZINO';

alter table public.orders
  drop constraint if exists orders_warehouse_location_check;

alter table public.orders
  add constraint orders_warehouse_location_check
  check (warehouse_location in ('MAGAZZINO', 'DEPOSITO'));

create table if not exists public.product_unit_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  unit text not null check (char_length(trim(unit)) between 1 and 20),
  created_at timestamptz not null default now(),
  unique (product_id, unit)
);

alter table public.product_unit_options enable row level security;

drop policy if exists "Product unit options readable" on public.product_unit_options;
create policy "Product unit options readable"
  on public.product_unit_options for select to public using (true);

drop policy if exists "Product unit options insertable" on public.product_unit_options;
create policy "Product unit options insertable"
  on public.product_unit_options for insert to public with check (true);

drop policy if exists "Product unit options updatable" on public.product_unit_options;
create policy "Product unit options updatable"
  on public.product_unit_options for update to public using (true) with check (true);

grant select, insert, update on public.product_unit_options to anon, authenticated;
