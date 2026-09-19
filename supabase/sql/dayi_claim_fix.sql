create or replace function public.dayi_claim(p_tests_only boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.dayi_jobs;
begin
 perform pg_advisory_xact_lock(736192019);
 -- Never silently repeat an image request whose response may have been lost.
 update public.dayi_jobs set state='failed',last_error='ambiguous_image_timeout',updated_at=now() where state='running' and locked_until<now() and stage='edit';
 update public.orders o set process_status='failed',error_message='生成连接中断，正在核查本次处理结果。' from public.dayi_jobs expired where expired.order_id=o.id and expired.state='failed' and expired.last_error='ambiguous_image_timeout' and o.process_status<>'completed';
 update public.dayi_jobs set state='queued',lease_id=null,locked_until=null,retry_count=retry_count+1 where state='running' and locked_until<now() and stage<>'edit' and retry_count<2;
 update public.dayi_jobs set state='failed',last_error='worker_interrupted' where state='running' and locked_until<now() and retry_count>=2;
 update public.orders o set process_status='failed',error_message='处理暂时中断，订单已保留，请联系大一。' from public.dayi_jobs expired where expired.order_id=o.id and expired.state='failed' and expired.last_error='worker_interrupted' and o.process_status<>'completed';
 if (select count(*) from public.dayi_jobs where state='running' and locked_until>now())>=2 then return null; end if;
 select * into j from public.dayi_jobs where state='queued' and available_at<=now() and (not p_tests_only or order_id in(select id from public.orders where is_test)) order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.dayi_jobs set state='running',lease_id=gen_random_uuid(),locked_until=now()+interval '3 minutes',updated_at=now() where order_id=j.order_id returning * into j;
 update public.orders set process_status='generating',updated_at=now() where id=j.order_id;
 return to_jsonb(j);
end;
$$;
revoke all on function public.dayi_claim(boolean) from public,anon,authenticated;
grant execute on function public.dayi_claim(boolean) to service_role;
