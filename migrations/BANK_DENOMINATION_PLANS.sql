-- Bank-wise denomination planning (per assignment)
create table if not exists bank_denomination_plans (
  id bigserial primary key,
  assignment_id bigint not null references assignments(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  denom_2000 integer not null default 0,
  denom_500 integer not null default 0,
  denom_200 integer not null default 0,
  denom_100 integer not null default 0,
  denom_50 integer not null default 0,
  denom_20 integer not null default 0,
  denom_10 integer not null default 0,
  remarks text,
  has_source_report boolean default true,
  created_at timestamptz not null default now()
);

create unique index if not exists bank_denomination_plans_unique
  on bank_denomination_plans (assignment_id, bank_account_id);
