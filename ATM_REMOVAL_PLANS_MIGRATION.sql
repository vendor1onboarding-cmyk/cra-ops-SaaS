-- ============================================================
-- Migration: ATM Removal Plans Table
-- Purpose: Persist denomination-wise ATM removal planning data
-- This does NOT affect cash-in-hand, SOA, or ATM load logic.
-- It is planning audit data only.
-- ============================================================

create table if not exists public.atm_removal_plans (
  id           uuid        not null default gen_random_uuid() primary key,
  assignment_id integer    not null references public.assignments(id) on delete cascade,
  denom_2000   integer     not null default 0,
  denom_500    integer     not null default 0,
  denom_200    integer     not null default 0,
  denom_100    integer     not null default 0,
  denom_50     integer     not null default 0,
  denom_20     integer     not null default 0,
  denom_10     integer     not null default 0,
  remarks      text        not null default '',
  has_source_report boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (assignment_id)
);

-- RLS
alter table public.atm_removal_plans enable row level security;

-- Custodians can manage their own plans
create policy "Custodian can manage own atm_removal_plans"
  on public.atm_removal_plans for all
  using (
    assignment_id in (
      select id from public.assignments where custodian_id = auth.uid()
    )
  );

-- Admins / supervisors can view all plans
create policy "Admin/Supervisor can view atm_removal_plans"
  on public.atm_removal_plans for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );
