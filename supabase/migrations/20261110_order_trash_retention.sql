-- Archivio ordini con cestino e conservazione di 60 giorni
-- Eseguire una sola volta nel Supabase SQL Editor.

alter table public.orders
  add column if not exists archived_at timestamptz null;

create index if not exists orders_archived_at_idx
  on public.orders (archived_at)
  where archived_at is not null;

-- Elimina prima le righe articolo e poi le intestazioni ordine scadute.
-- SECURITY DEFINER consente al job pianificato di eseguire la pulizia senza
-- concedere permessi DELETE agli utenti dell'applicazione.
create or replace function public.purge_expired_archived_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_orders integer;
begin
  delete from public.order_items oi
  using public.orders o
  where oi.order_id = o.id
    and o.archived_at is not null
    and o.archived_at < now() - interval '60 days';

  delete from public.orders
  where archived_at is not null
    and archived_at < now() - interval '60 days';

  get diagnostics deleted_orders = row_count;
  return deleted_orders;
end;
$$;

revoke all on function public.purge_expired_archived_orders() from public, anon, authenticated;

-- Pulizia automatica ogni giorno alle 03:00 (fuso orario UTC).
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname = 'purge-expired-archived-orders';

select cron.schedule(
  'purge-expired-archived-orders',
  '0 3 * * *',
  $$select public.purge_expired_archived_orders();$$
);
