begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function dayi_private.signal_worker() returns void language plpgsql security definer set search_path='' as $$
declare worker_key text; enabled boolean;
begin
 select coalesce((value->>'enabled')::boolean,false) into enabled from public.dayi_settings where name='production';
 if not exists(select 1 from public.dayi_jobs j join public.orders o on o.id=j.order_id where (j.state='queued' and j.available_at<=now() or j.state='running' and j.locked_until<now()) and (enabled or o.is_test)) then return; end if;
 select dayi_private.secret_value('dayi_worker_key') into worker_key;
 if worker_key is null then return; end if;
 perform net.http_post(url:='https://fhvhnibznphatfnbvvnb.supabase.co/functions/v1/direction-feedback-api',headers:=jsonb_build_object('Content-Type','application/json','x-dayi-worker',worker_key),body:='{"action":"worker"}'::jsonb,timeout_milliseconds:=140000);
end;
$$;
revoke all on function dayi_private.signal_worker() from public,anon,authenticated;
grant execute on function dayi_private.signal_worker() to service_role;
create or replace function public.dayi_signal() returns void language sql security invoker set search_path='' as $$select dayi_private.signal_worker();$$;
revoke all on function public.dayi_signal() from public,anon,authenticated;
grant execute on function public.dayi_signal() to service_role;
do $$begin
 if not exists(select 1 from cron.job where jobname='dayi-workflow-recovery') then perform cron.schedule('dayi-workflow-recovery','* * * * *','select dayi_private.signal_worker()');end if;
 if not exists(select 1 from cron.job where jobname='dayi-rate-limit-cleanup') then perform cron.schedule('dayi-rate-limit-cleanup','17 3 * * *','delete from public.dayi_rate_limits where window_start < now()-interval ''2 days''');end if;
end$$;
commit;
