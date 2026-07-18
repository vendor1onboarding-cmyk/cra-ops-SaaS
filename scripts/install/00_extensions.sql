-- ============================================================================
-- CRA OPS install kit
-- Extensions and schema bootstrap
-- ============================================================================

-- The public schema and required extension objects come from the source dump.

-- Required by the application for gen_random_uuid() defaults.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- SCHEMA: public
-- Schema bootstrap
-- ---------------------------------------------------------------------------
--

CREATE SCHEMA "public";


--

-- ---------------------------------------------------------------------------
-- COMMENT: SCHEMA "public"
-- Schema comment
-- ---------------------------------------------------------------------------
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--

