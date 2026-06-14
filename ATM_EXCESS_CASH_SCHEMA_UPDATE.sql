-- Add back-date support and recon communication tracking for ATM excess cash
ALTER TABLE public.atm_excess_cash
  ADD COLUMN IF NOT EXISTS excess_date date,
  ADD COLUMN IF NOT EXISTS recon_communication_date date;

-- Backfill excess_date from assignment_date for existing records
UPDATE public.atm_excess_cash AS a
SET excess_date = ass.assignment_date
FROM public.assignments AS ass
WHERE a.excess_date IS NULL
  AND a.assignment_id = ass.id;
