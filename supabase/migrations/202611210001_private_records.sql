-- Apply through `supabase db push`. No data is seeded.
create table public.life_records (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id uuid not null,
  record jsonb not null check (jsonb_typeof(record) = 'object' and record->>'id' = id::text),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id,id),
  check (octet_length(record::text) <= 200000)
);
alter table public.life_records enable row level security;
alter table public.life_records force row level security;
create policy records_select on public.life_records for select to authenticated using ((select auth.uid())=user_id);
create policy records_insert on public.life_records for insert to authenticated with check ((select auth.uid())=user_id);
create policy records_update on public.life_records for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy records_delete on public.life_records for delete to authenticated using ((select auth.uid())=user_id);
grant select on public.life_records to authenticated;
-- All browser writes use compare-and-swap. Direct mutation is revoked.
revoke insert,update,delete on public.life_records from authenticated,anon;

create function public.put_life_record(p_id uuid,p_record jsonb,p_expected bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_version bigint;
begin
 if v_user is null then raise exception 'authentication required'; end if;
 if p_record->>'id' is distinct from p_id::text or octet_length(p_record::text)>200000 or p_record->>'kind' not in ('task','course','assignment','assessment','event','note','project','study','mistake','reading','writing','focus','practice','evidence','routine','checkin','transaction','goal','career','opportunity','review','challenge','checkpoint','daylog','aiSession','exportLog','schoolSource','importLog','flashcard','lessonProgress','lessonAttempt','musicSource') or jsonb_typeof(p_record->'data') is distinct from 'object' or p_record->>'revision' is null then raise exception 'invalid record'; end if;
 if p_expected=0 then
   insert into public.life_records(user_id,id,record,version) values(v_user,p_id,p_record,1) on conflict do nothing returning version into v_version;
 else
   update public.life_records set record=p_record,version=version+1,updated_at=now() where user_id=v_user and id=p_id and version=p_expected returning version into v_version;
 end if;
 if v_version is null then raise exception 'sync conflict'; end if;
 return v_version;
end; $$;
revoke all on function public.put_life_record(uuid,jsonb,bigint) from public,anon;
grant execute on function public.put_life_record(uuid,jsonb,bigint) to authenticated;

create table public.ai_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null default current_date,
 requests integer not null default 0 check(requests>=0),
 last_request timestamptz,
 primary key(user_id,day)
);
alter table public.ai_usage enable row level security;
alter table public.ai_usage force row level security;
create policy usage_select on public.ai_usage for select to authenticated using ((select auth.uid())=user_id);
grant select on public.ai_usage to authenticated;
revoke insert,update,delete on public.ai_usage from authenticated,anon;

-- Invoked only by the edge function's service role, never the browser.
create function public.reserve_ai_request(p_user uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.ai_usage(user_id,day,requests,last_request) values(p_user,current_date,1,clock_timestamp())
 on conflict(user_id,day) do update set requests=public.ai_usage.requests+1,last_request=clock_timestamp()
 where public.ai_usage.requests<20 and (public.ai_usage.last_request is null or public.ai_usage.last_request < clock_timestamp()-interval '10 seconds')
 returning requests into n;
 if n is null then raise exception 'rate limited'; end if;
 return n;
end; $$;
revoke all on function public.reserve_ai_request(uuid) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid) to service_role;

create function public.delete_my_account() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 delete from auth.users where id=auth.uid();
end; $$;
revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;
