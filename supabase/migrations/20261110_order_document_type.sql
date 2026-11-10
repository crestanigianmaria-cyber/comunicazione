-- Adds the document category selected by the warehouse when creating an order.
-- Existing orders are classified as DDT for backwards compatibility.
alter table public.orders
  add column if not exists document_type text not null default 'DDT';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_document_type_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_document_type_check
      check (document_type in ('SCONTRINO', 'DDT', 'FATTURA', 'NOTA_PRELIEVO'));
  end if;
end
$$;
