-- ZEMA TECHNOLOGIES - Supabase schema
-- A executer dans Supabase SQL Editor.

create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  phone text not null,
  request_type text not null,
  message text not null,
  page text,
  status text not null default 'Nouveau',
  created_at timestamptz not null default now()
);

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  label text,
  page text,
  device text,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
alter table public.site_events enable row level security;

drop policy if exists "Public can insert contact messages" on public.contact_messages;
create policy "Public can insert contact messages"
on public.contact_messages
for insert
to anon
with check (
  length(trim(name)) > 0
  and length(trim(email)) > 0
  and length(trim(phone)) > 0
  and length(trim(request_type)) > 0
  and length(trim(message)) > 0
);

drop policy if exists "Authenticated admin can read contact messages" on public.contact_messages;
create policy "Authenticated admin can read contact messages"
on public.contact_messages
for select
to authenticated
using (true);

drop policy if exists "Public can insert site events" on public.site_events;
create policy "Public can insert site events"
on public.site_events
for insert
to anon
with check (length(trim(event_type)) > 0);

drop policy if exists "Authenticated admin can read site events" on public.site_events;
create policy "Authenticated admin can read site events"
on public.site_events
for select
to authenticated
using (true);

create or replace function public.zema_admin_dashboard(
  p_username text,
  p_password text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_username <> 'admin' or p_password <> 'admin' then
    raise exception 'Acces refuse';
  end if;

  return json_build_object(
    'messages',
    coalesce(
      (
        select json_agg(row_to_json(message_rows))
        from (
          select
            id,
            name,
            email,
            phone,
            request_type,
            message,
            page,
            status,
            created_at
          from public.contact_messages
          order by created_at desc
          limit 100
        ) message_rows
      ),
      '[]'::json
    ),
    'events',
    coalesce(
      (
        select json_agg(row_to_json(event_rows))
        from (
          select
            id,
            event_type,
            label,
            page,
            device,
            created_at
          from public.site_events
          order by created_at desc
          limit 500
        ) event_rows
      ),
      '[]'::json
    )
  );
end;
$$;

grant execute on function public.zema_admin_dashboard(text, text) to anon;
