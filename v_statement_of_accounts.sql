create view public.v_statement_of_accounts as
select
  l.assignment_id,
  a.assignment_date,
  l.entry_date,
  l.entry_time,
  p.full_name as custodian_name,
  l.event_type,
  l.source_table,
  l.source_id,
  s.site_code,
  s.bank_name,
  s.address,
  l.amount,
  l.direction,
  l.running_balance,
  l.remarks
from
  soa_ledger l
  join assignments a on a.id = l.assignment_id
  join profiles p on p.id = l.custodian_id
  left join sites s on s.id = l.site_id
order by
  l.entry_date,
  l.entry_time;