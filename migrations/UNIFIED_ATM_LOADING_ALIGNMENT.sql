-- ============================================
-- UNIFIED ATM LOADING ALIGNMENT
-- Internal Pickup + GPS Metadata + SOA Balance Fix
-- ============================================
-- Version: 1.1
-- Date: February 9, 2026
-- Author: GitHub Copilot
-- Backward Compatible: YES
-- ============================================

-- ============================================
-- STEP 1: EXTEND CASH_PICKUPS
-- ============================================

ALTER TABLE cash_pickups
ADD COLUMN IF NOT EXISTS pickup_source TEXT DEFAULT 'BANK',
ADD COLUMN IF NOT EXISTS source_site_id BIGINT NULL,
ADD COLUMN IF NOT EXISTS gps_metadata JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gps_photo_url TEXT NULL;

-- Backfill pickup_source for legacy rows
UPDATE cash_pickups
SET pickup_source = 'BANK'
WHERE pickup_source IS NULL;

-- Add constraint for pickup_source (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cash_pickups_pickup_source_check'
  ) THEN
    ALTER TABLE cash_pickups
    ADD CONSTRAINT cash_pickups_pickup_source_check
    CHECK (pickup_source IN ('BANK', 'ATM_INTERNAL'));
  END IF;
END $$;

-- Add FK for source_site_id (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cash_pickups_source_site_id_fkey'
  ) THEN
    ALTER TABLE cash_pickups
    ADD CONSTRAINT cash_pickups_source_site_id_fkey
    FOREIGN KEY (source_site_id) REFERENCES sites(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cash_pickups_pickup_source
ON cash_pickups(pickup_source);

CREATE INDEX IF NOT EXISTS idx_cash_pickups_source_site_id
ON cash_pickups(source_site_id);

-- ============================================
-- STEP 2A: EXTEND BANK_ACCOUNTS (GPS)
-- ============================================

ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS latitude NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS longitude NUMERIC DEFAULT NULL;

-- ============================================
-- STEP 2B: EXTEND ATM_EXCESS_CASH (GPS)
-- ============================================

ALTER TABLE atm_excess_cash
ADD COLUMN IF NOT EXISTS gps_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gps_lat NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gps_lng NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gps_distance_meters NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gps_photo_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gps_verified_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================
-- STEP 3: UPDATE SOA VIEWS (BANK + INTERNAL)
-- ============================================

DROP VIEW IF EXISTS v_soa_detailed;

CREATE OR REPLACE VIEW v_soa_detailed AS
SELECT
  a.id as soa_id,
  a.id as assignment_id,
  a.custodian_id,
  a.assignment_date,

  -- Bank pickups (legacy rows default to BANK)
  COALESCE(
    (SELECT SUM(
      cp.denom_2000 * 2000 +
      cp.denom_500 * 500 +
      cp.denom_200 * 200 +
      cp.denom_100 * 100 +
      cp.denom_50 * 50 +
      cp.denom_20 * 20 +
      cp.denom_10 * 10
    ) FROM cash_pickups cp
     WHERE cp.assignment_id = a.id
       AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  ) as bank_withdrawals,

  -- Internal pickups (explicit ATM_INTERNAL rows)
  COALESCE(
    (SELECT SUM(
      cp.denom_2000 * 2000 +
      cp.denom_500 * 500 +
      cp.denom_200 * 200 +
      cp.denom_100 * 100 +
      cp.denom_50 * 50 +
      cp.denom_20 * 20 +
      cp.denom_10 * 10
    ) FROM cash_pickups cp
     WHERE cp.assignment_id = a.id
       AND cp.pickup_source = 'ATM_INTERNAL'
    ),
    0
  )
  +
  COALESCE(
    (SELECT SUM(
      (cp.internal_source_metadata->>'total_internal_amount')::numeric
    ) FROM cash_pickups cp
     WHERE cp.assignment_id = a.id
       AND cp.internal_source_metadata IS NOT NULL
       AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  ) as internal_withdrawals,

  -- Opening balance (bank + internal)
  (
    COALESCE(
      (SELECT SUM(
        cp.denom_2000 * 2000 +
        cp.denom_500 * 500 +
        cp.denom_200 * 200 +
        cp.denom_100 * 100 +
        cp.denom_50 * 50 +
        cp.denom_20 * 20 +
        cp.denom_10 * 10
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
      ),
      0
    )
    +
    COALESCE(
      (SELECT SUM(
        (cp.internal_source_metadata->>'total_internal_amount')::numeric
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND cp.internal_source_metadata IS NOT NULL
         AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
      ),
      0
    )
    +
    COALESCE(
      (SELECT SUM(
        cp.denom_2000 * 2000 +
        cp.denom_500 * 500 +
        cp.denom_200 * 200 +
        cp.denom_100 * 100 +
        cp.denom_50 * 50 +
        cp.denom_20 * 20 +
        cp.denom_10 * 10
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND cp.pickup_source = 'ATM_INTERNAL'
      ),
      0
    )
  ) as opening_balance,

  -- Total withdrawals (bank + internal)
  (
    COALESCE(
      (SELECT SUM(
        cp.denom_2000 * 2000 +
        cp.denom_500 * 500 +
        cp.denom_200 * 200 +
        cp.denom_100 * 100 +
        cp.denom_50 * 50 +
        cp.denom_20 * 20 +
        cp.denom_10 * 10
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
      ),
      0
    )
    +
    COALESCE(
      (SELECT SUM(
        (cp.internal_source_metadata->>'total_internal_amount')::numeric
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND cp.internal_source_metadata IS NOT NULL
         AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
      ),
      0
    )
    +
    COALESCE(
      (SELECT SUM(
        cp.denom_2000 * 2000 +
        cp.denom_500 * 500 +
        cp.denom_200 * 200 +
        cp.denom_100 * 100 +
        cp.denom_50 * 50 +
        cp.denom_20 * 20 +
        cp.denom_10 * 10
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND cp.pickup_source = 'ATM_INTERNAL'
      ),
      0
    )
  ) as total_withdrawals,

  -- Bank + internal loads from helper view
  COALESCE(
    (SELECT SUM(v.bank_total_amount)
     FROM v_atm_load_sources v WHERE v.assignment_id = a.id),
    0
  ) as bank_loads,

  COALESCE(
    (SELECT SUM(v.internal_total_amount)
     FROM v_atm_load_sources v WHERE v.assignment_id = a.id),
    0
  ) as internal_loads,

  COALESCE(
    (SELECT SUM(v.bank_total_amount + v.internal_total_amount)
     FROM v_atm_load_sources v WHERE v.assignment_id = a.id),
    0
  ) as total_loads,

  -- Manual cash adjustments are deprecated (no SOA impact)
  0 as net_adjustments,

  (SELECT COUNT(*)
   FROM soa_adjustments sa
   WHERE sa.assignment_id = a.id
   AND sa.adjustment_type = 'EXCHANGE'
  ) as exchange_count,

  (SELECT COUNT(*)
   FROM soa_adjustments sa
   WHERE sa.assignment_id = a.id
   AND sa.adjustment_type = 'INTER_SITE_TRANSFER'
  ) as transfer_count,

  COALESCE(
    (SELECT SUM(
      ec.denom_2000 * 2000 +
      ec.denom_500 * 500 +
      ec.denom_200 * 200 +
      ec.denom_100 * 100
    )
     FROM atm_excess_cash ec
     WHERE ec.assignment_id = a.id
    ),
    0
  ) as excess_reported,

  COALESCE(
    (SELECT SUM(tl.km_covered)
     FROM travel_logs tl
     WHERE tl.assignment_id = a.id
    ),
    0
  ) as travel_km,

  COALESCE(
    (SELECT SUM(tl.allowance_amount)
     FROM travel_logs tl
     WHERE tl.assignment_id = a.id
    ),
    0
  ) as travel_allowance,

  a.status,
  a.created_at

FROM assignments a;

DROP VIEW IF EXISTS v_soa_effective;

CREATE OR REPLACE VIEW v_soa_effective AS
SELECT
  a.id as soa_id,
  a.id as assignment_id,
  a.custodian_id,
  a.assignment_date,

  -- Bank pickup total
  COALESCE(
    (SELECT SUM(
      cp.denom_2000 * 2000 +
      cp.denom_500 * 500 +
      cp.denom_200 * 200 +
      cp.denom_100 * 100 +
      cp.denom_50 * 50 +
      cp.denom_20 * 20 +
      cp.denom_10 * 10
    ) FROM cash_pickups cp
     WHERE cp.assignment_id = a.id
       AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
    ),
    0
  ) as bank_picked,

  -- Internal pickup total (ATM_INTERNAL + legacy metadata)
  (
    COALESCE(
      (SELECT SUM(
        cp.denom_2000 * 2000 +
        cp.denom_500 * 500 +
        cp.denom_200 * 200 +
        cp.denom_100 * 100 +
        cp.denom_50 * 50 +
        cp.denom_20 * 20 +
        cp.denom_10 * 10
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND cp.pickup_source = 'ATM_INTERNAL'
      ),
      0
    )
    +
    COALESCE(
      (SELECT SUM(
        (cp.internal_source_metadata->>'total_internal_amount')::numeric
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND cp.internal_source_metadata IS NOT NULL
         AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
      ),
      0
    )
  ) as internal_picked,

  -- Bank + internal loaded
  COALESCE(
    (SELECT SUM(v.bank_total_amount)
     FROM v_atm_load_sources v WHERE v.assignment_id = a.id),
    0
  ) as bank_loaded,

  COALESCE(
    (SELECT SUM(v.internal_total_amount)
     FROM v_atm_load_sources v WHERE v.assignment_id = a.id),
    0
  ) as internal_loaded,

  -- Total picked/loaded for backward compatibility
  (
    COALESCE(
      (SELECT SUM(
        cp.denom_2000 * 2000 +
        cp.denom_500 * 500 +
        cp.denom_200 * 200 +
        cp.denom_100 * 100 +
        cp.denom_50 * 50 +
        cp.denom_20 * 20 +
        cp.denom_10 * 10
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
      ),
      0
    )
    +
    COALESCE(
      (SELECT SUM(
        (cp.internal_source_metadata->>'total_internal_amount')::numeric
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND cp.internal_source_metadata IS NOT NULL
         AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
      ),
      0
    )
    +
    COALESCE(
      (SELECT SUM(
        cp.denom_2000 * 2000 +
        cp.denom_500 * 500 +
        cp.denom_200 * 200 +
        cp.denom_100 * 100 +
        cp.denom_50 * 50 +
        cp.denom_20 * 20 +
        cp.denom_10 * 10
      ) FROM cash_pickups cp
       WHERE cp.assignment_id = a.id
         AND cp.pickup_source = 'ATM_INTERNAL'
      ),
      0
    )
  ) as cash_picked,

  (
    COALESCE(
      (SELECT SUM(v.bank_total_amount)
       FROM v_atm_load_sources v WHERE v.assignment_id = a.id),
      0
    )
    +
    COALESCE(
      (SELECT SUM(v.internal_total_amount)
       FROM v_atm_load_sources v WHERE v.assignment_id = a.id),
      0
    )
  ) as cash_loaded,

  0 as cash_adjusted,

  COALESCE(
    (SELECT SUM(
      ec.denom_2000 * 2000 +
      ec.denom_500 * 500 +
      ec.denom_200 * 200 +
      ec.denom_100 * 100
    ) FROM atm_excess_cash ec WHERE ec.assignment_id = a.id),
    0
  ) as excess_reported,

  COALESCE(
    (SELECT SUM(tl.km_covered) FROM travel_logs tl WHERE tl.assignment_id = a.id),
    0
  ) as travel_km,

  COALESCE(
    (SELECT SUM(tl.allowance_amount) FROM travel_logs tl WHERE tl.assignment_id = a.id),
    0
  ) as travel_allowance,

  (
    (
      COALESCE(
        (SELECT SUM(
          cp.denom_2000 * 2000 +
          cp.denom_500 * 500 +
          cp.denom_200 * 200 +
          cp.denom_100 * 100 +
          cp.denom_50 * 50 +
          cp.denom_20 * 20 +
          cp.denom_10 * 10
        ) FROM cash_pickups cp
         WHERE cp.assignment_id = a.id
           AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
        ),
        0
      )
      +
      COALESCE(
        (SELECT SUM(
          (cp.internal_source_metadata->>'total_internal_amount')::numeric
        ) FROM cash_pickups cp
         WHERE cp.assignment_id = a.id
           AND cp.internal_source_metadata IS NOT NULL
           AND COALESCE(cp.pickup_source, 'BANK') = 'BANK'
        ),
        0
      )
      +
      COALESCE(
        (SELECT SUM(
          cp.denom_2000 * 2000 +
          cp.denom_500 * 500 +
          cp.denom_200 * 200 +
          cp.denom_100 * 100 +
          cp.denom_50 * 50 +
          cp.denom_20 * 20 +
          cp.denom_10 * 10
        ) FROM cash_pickups cp
         WHERE cp.assignment_id = a.id
           AND cp.pickup_source = 'ATM_INTERNAL'
        ),
        0
      )
    )
    -
    (
      COALESCE(
        (SELECT SUM(v.bank_total_amount)
         FROM v_atm_load_sources v WHERE v.assignment_id = a.id),
        0
      )
      +
      COALESCE(
        (SELECT SUM(v.internal_total_amount)
         FROM v_atm_load_sources v WHERE v.assignment_id = a.id),
        0
      )
    )
  ) as final_net_cash_position,

  a.created_at as posted_at
FROM assignments a;

GRANT SELECT ON v_soa_effective TO authenticated;
GRANT SELECT ON v_soa_detailed TO authenticated;
