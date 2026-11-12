-- Allow descriptive-only rows inside an order without linking to a catalog product.
alter table public.order_items
  alter column product_id drop not null;

alter table public.order_items
  add column if not exists line_type text not null default 'PRODUCT',
  add column if not exists manual_description text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_line_type_check'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_line_type_check
      check (line_type in ('PRODUCT', 'DESCRIPTION'));
  end if;
end
$$;

