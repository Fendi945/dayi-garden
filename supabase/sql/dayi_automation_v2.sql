-- DAYI V2: additive migration; existing orders and payment records are preserved.
begin;
create schema if not exists dayi_private;
revoke all on schema dayi_private from public, anon, authenticated;
grant usage on schema dayi_private to service_role;

alter table public.orders add column if not exists checkout_stage text not null default 'submitted';
alter table public.orders add column if not exists result_bucket text not null default 'order-results';
alter table public.orders add column if not exists error_message text;
alter table public.orders add column if not exists workflow_version text;
alter table public.orders add column if not exists model_version text;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists is_test boolean not null default false;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists photo_hash text;
alter table public.orders add column if not exists configuration_id text;
alter table public.orders add column if not exists test_case_type text;
alter table public.orders add column if not exists calibration_approved_at timestamptz;
alter table public.orders add column if not exists calibration_approved_by uuid;
create unique index if not exists dayi_order_code_unique on public.orders(order_code) where order_code is not null;

create table if not exists public.dayi_order_access (
  order_id uuid primary key references public.orders(id),
  request_id uuid not null unique,
  token_hash text not null check (length(token_hash)=64),
  created_at timestamptz not null default now()
);
create table if not exists public.dayi_jobs (
  order_id uuid primary key references public.orders(id),
  stage text not null default 'plan' check (stage in ('plan','edit','download','review','publish')),
  state text not null default 'queued' check (state in ('queued','running','succeeded','failed')),
  checkpoint jsonb not null default '{}',
  lease_id uuid,
  locked_until timestamptz,
  retry_count integer not null default 0,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text
);
create index if not exists dayi_jobs_ready on public.dayi_jobs(available_at,created_at) where state='queued';
create table if not exists public.dayi_events (
  id bigint generated always as identity primary key,
  order_id uuid references public.orders(id),
  event text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists dayi_events_order on public.dayi_events(order_id,created_at);
create table if not exists public.dayi_settings (name text primary key, value jsonb not null, updated_at timestamptz not null default now());
insert into public.dayi_settings(name,value) values ('production','{"enabled":false,"api_base":"https://dashscope.aliyuncs.com","image_model":"qwen-image-2.0-pro-2026-06-22","vision_model":"qwen3-vl-plus","minimum_score":80,"max_images":2,"reference_paths":{}}') on conflict do nothing;
create table if not exists public.dayi_rate_limits (key text primary key, window_start timestamptz not null, hits integer not null);

alter table public.dayi_order_access enable row level security;
alter table public.dayi_jobs enable row level security;
alter table public.dayi_events enable row level security;
alter table public.dayi_settings enable row level security;
alter table public.dayi_rate_limits enable row level security;
revoke all on public.dayi_order_access,public.dayi_jobs,public.dayi_events,public.dayi_settings,public.dayi_rate_limits from anon,authenticated;
grant all on public.dayi_order_access,public.dayi_jobs,public.dayi_events,public.dayi_settings,public.dayi_rate_limits to service_role;
grant usage,select on sequence public.dayi_events_id_seq to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('dayi-private-results','dayi-private-results',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;

create or replace function dayi_private.secret_value(p_name text) returns text language sql security definer set search_path='' as $$
 select decrypted_secret from vault.decrypted_secrets where name=p_name and p_name like 'dayi_%' limit 1;
$$;
revoke all on function dayi_private.secret_value(text) from public,anon,authenticated;
grant execute on function dayi_private.secret_value(text) to service_role;
create or replace function public.dayi_secret(p_name text) returns text language sql security invoker set search_path='' as $$
 select dayi_private.secret_value(p_name);
$$;
revoke all on function public.dayi_secret(text) from public,anon,authenticated;
grant execute on function public.dayi_secret(text) to service_role;

create or replace function dayi_private.save_secret(p_name text,p_value text) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if p_name not in ('dayi_image_api_key','dayi_worker_key') or length(p_value)<24 then raise exception 'invalid secret'; end if;
 select id into sid from vault.secrets where name=p_name;
 if sid is null then perform vault.create_secret(p_value,p_name,'DAYI automation');
 else perform vault.update_secret(sid,p_value,p_name); end if;
end;
$$;
revoke all on function dayi_private.save_secret(text,text) from public,anon,authenticated;
grant execute on function dayi_private.save_secret(text,text) to service_role;
create or replace function public.dayi_save_secret(p_name text,p_value text) returns void language sql security invoker set search_path='' as $$
 select dayi_private.save_secret(p_name,p_value);
$$;
revoke all on function public.dayi_save_secret(text,text) from public,anon,authenticated;
grant execute on function public.dayi_save_secret(text,text) to service_role;

do $$ begin
 if not exists(select 1 from vault.secrets where name='dayi_worker_key') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'dayi_worker_key','DAYI scheduler credential');
 end if;
end $$;

create or replace function public.dayi_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into public.dayi_rate_limits(key,window_start,hits) values(p_key,now(),1)
 on conflict(key) do update set hits=case when dayi_rate_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else dayi_rate_limits.hits+1 end,
 window_start=case when dayi_rate_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else dayi_rate_limits.window_start end returning hits into n;
 return n<=p_limit;
end;
$$;
revoke all on function public.dayi_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.dayi_rate_limit(text,integer,integer) to service_role;

create or replace function public.dayi_create_order(p_request uuid,p_hash text,p_code text,p_details jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.dayi_order_access; o public.orders;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into a from public.dayi_order_access where request_id=p_request;
 if found then
  if a.token_hash<>p_hash then raise exception 'access denied'; end if;
  update public.orders set style=p_details->>'style',style_desc=p_details->>'style',yard_size=p_details->>'yard_size',needs=array(select jsonb_array_elements_text(p_details->'needs')),notes=p_details->>'notes',updated_at=now() where id=a.order_id and checkout_stage='draft';
  select * into o from public.orders where id=a.order_id;
  return to_jsonb(o);
 end if;
 insert into public.orders(order_code,checkout_stage,product_code,amount_cny,owner_type,style,style_desc,yard_size,needs,notes,workflow_version)
 values(p_code,'draft','direction_feedback_1',39.90,'private_yard',p_details->>'style',p_details->>'style',p_details->>'yard_size',array(select jsonb_array_elements_text(p_details->'needs')),p_details->>'notes','DAYI_GARDEN_WORKFLOW_V1.0') returning * into o;
 insert into public.dayi_order_access(order_id,request_id,token_hash) values(o.id,p_request,p_hash);
 return to_jsonb(o);
end;
$$;
revoke all on function public.dayi_create_order(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.dayi_create_order(uuid,text,text,jsonb) to service_role;

create or replace function public.dayi_enqueue(p_code text,p_actor uuid,p_confirm boolean default false,p_new_image boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.orders; j public.dayi_jobs;
begin
 select * into o from public.orders where order_code=p_code for update;
 if not found then raise exception 'order not found'; end if;
 if o.process_status='completed' and o.result_a_path is not null and jsonb_array_length(o.advice_json)=3 then return jsonb_build_object('state','completed'); end if;
 if o.checkout_stage<>'submitted' or o.photo_path is null then raise exception 'order not submitted'; end if;
 if not o.is_test and (o.amount_cny<>39.90 or o.product_code<>'direction_feedback_1') then raise exception 'invalid product amount'; end if;
 if o.is_test then
  if p_actor is null then raise exception 'admin identity required'; end if;
 elsif p_confirm then
  if p_actor is null then raise exception 'admin identity required'; end if;
  update public.orders set payment_status='confirmed',paid_at=coalesce(paid_at,now()),updated_at=now() where id=o.id;
  insert into public.dayi_events(order_id,event,detail) values(o.id,'payment_confirmed',jsonb_build_object('actor',p_actor));
 elsif o.payment_status not in ('confirmed','paid','verified') then raise exception 'payment not confirmed';
 end if;
 select * into j from public.dayi_jobs where order_id=o.id;
 if found and j.state in ('running','queued') then return jsonb_build_object('state',j.state); end if;
 if found and j.state='failed' and expired.last_error='ambiguous_image_timeout' then
  if not p_new_image or p_actor is null then raise exception 'check provider request before authorizing another image'; end if;
  if coalesce((j.checkpoint->>'image_count')::integer,0)>=2 then raise exception 'image budget exhausted'; end if;
  insert into public.dayi_events(order_id,event,detail) values(o.id,'new_image_authorized',jsonb_build_object('actor',p_actor));
 end if;
 insert into public.dayi_jobs(order_id) values(o.id) on conflict(order_id) do update set state='queued',retry_count=0,available_at=now(),last_error=null,updated_at=now();
 update public.orders set process_status='queued',error_message=null,updated_at=now() where id=o.id;
 return jsonb_build_object('state','queued');
end;
$$;
revoke all on function public.dayi_enqueue(text,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.dayi_enqueue(text,uuid,boolean,boolean) to service_role;

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

create or replace function public.dayi_checkpoint(p_order uuid,p_lease uuid,p_stage text,p_checkpoint jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.dayi_jobs set checkpoint=p_checkpoint,stage=p_stage,state='queued',lease_id=null,locked_until=null,retry_count=0,updated_at=now(),available_at=now() where order_id=p_order and lease_id=p_lease and state='running';
 return found;
end;
$$;
revoke all on function public.dayi_checkpoint(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.dayi_checkpoint(uuid,uuid,text,jsonb) to service_role;

create or replace function public.dayi_publish(p_order uuid,p_lease uuid,p_path text,p_advice jsonb,p_model text,p_prompt text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_path is null or jsonb_typeof(p_advice)<>'array' or jsonb_array_length(p_advice)<>3 then raise exception 'incomplete deliverable'; end if;
 perform 1 from public.dayi_jobs where order_id=p_order and lease_id=p_lease and state='running' for update;
 if not found then return false; end if;
 update public.orders set result_a_path=p_path,result_bucket='dayi-private-results',advice_json=p_advice,process_status='completed',completed_at=now(),updated_at=now(),model_version=p_model,prompt=p_prompt,error_message=null where id=p_order;
 update public.dayi_jobs set state='succeeded',lease_id=null,locked_until=null,updated_at=now() where order_id=p_order;
 insert into public.dayi_events(order_id,event) values(p_order,'delivery_completed');
 return true;
end;
$$;
revoke all on function public.dayi_publish(uuid,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.dayi_publish(uuid,uuid,text,jsonb,text,text) to service_role;

-- Legacy queries continue to serve legacy records; they cannot expose V2 orders.
create or replace function public.get_direction_feedback_result(p_order_code text)
returns table(payment_status text,process_status text,result_a_path text,result_b_path text,advice_json jsonb)
language sql security definer set search_path='' as $$
 select o.payment_status,o.process_status,o.result_a_path,o.result_b_path,o.advice_json from public.orders o
 where o.order_code=p_order_code and not o.is_test and not exists(select 1 from public.dayi_order_access a where a.order_id=o.id) limit 1;
$$;
create or replace function public.get_order_result(p_order_code text)
returns table(payment_status text,process_status text,result_a_path text,result_b_path text)
language sql security definer set search_path='' as $$
 select o.payment_status,o.process_status,o.result_a_path,o.result_b_path from public.orders o
 where o.order_code=p_order_code and not o.is_test and not exists(select 1 from public.dayi_order_access a where a.order_id=o.id) limit 1;
$$;
create or replace function public.dayi_metrics(p_days integer default 7) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object(
 'visitors',(select count(distinct session_id) from public.analytics_events where created_at>=now()-make_interval(days=>p_days) and event_name='page_view'),
 'starts',(select count(distinct session_id) from public.analytics_events where created_at>=now()-make_interval(days=>p_days) and event_name='start_click'),
 'offers',(select count(distinct session_id) from public.analytics_events where created_at>=now()-make_interval(days=>p_days) and event_name='offer_view'),
 'submitted',count(*) filter(where checkout_stage='submitted'),
 'paid',count(*) filter(where payment_status in ('confirmed','paid','verified')),
 'completed',count(*) filter(where process_status='completed' and result_a_path is not null and jsonb_array_length(advice_json)=3),
 'revenue',coalesce(sum(amount_cny) filter(where payment_status in ('confirmed','paid','verified')),0),
 'pending',count(*) filter(where checkout_stage='submitted' and payment_status='pending_verification'),
 'failed',count(*) filter(where process_status='failed'))
 from public.orders where not is_test and created_at>=now()-make_interval(days=>p_days);
$$;
revoke all on function public.dayi_metrics(integer) from public,anon,authenticated;
grant execute on function public.dayi_metrics(integer) to service_role;
create or replace function public.dayi_prepare_edit(p_order uuid,p_lease uuid,p_checkpoint jsonb) returns boolean language plpgsql security invoker set search_path='' as $$begin
 update public.dayi_jobs set checkpoint=p_checkpoint,updated_at=now() where order_id=p_order and lease_id=p_lease and state='running' and stage='edit';return found;
end;$$;
revoke all on function public.dayi_prepare_edit(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.dayi_prepare_edit(uuid,uuid,jsonb) to service_role;
-- Legacy form compatibility, without permitting anonymous callers to forge V2 internal state.
alter policy anon_can_insert_orders on public.orders with check (
 payment_status='pending_verification' and process_status='waiting_payment_verification'
 and result_a_path is null and result_b_path is null and advice_json='[]'::jsonb
 and not is_test and checkout_stage='submitted' and result_bucket='order-results'
 and calibration_approved_at is null and calibration_approved_by is null
 and configuration_id is null and completed_at is null
);
commit;
