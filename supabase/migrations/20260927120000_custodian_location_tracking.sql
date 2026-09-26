-- Stores the latest foreground location heartbeat for each custodian.
create table if not exists public.custodian_locations (
  custodian_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision,
  assignment_id bigint references public.assignments(id) on delete set null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custodian_locations_latitude_check check (latitude between -90 and 90),
  constraint custodian_locations_longitude_check check (longitude between -180 and 180)
);

create index if not exists custodian_locations_recorded_at_idx
  on public.custodian_locations (recorded_at desc);

alter table public.custodian_locations enable row level security;

drop policy if exists custodian_locations_self_upsert on public.custodian_locations;
create policy custodian_locations_self_upsert
  on public.custodian_locations for all
  using (custodian_id = auth.uid())
  with check (custodian_id = auth.uid());

drop policy if exists custodian_locations_admin_read on public.custodian_locations;
create policy custodian_locations_admin_read
  on public.custodian_locations for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'supervisor')
    )
  );
