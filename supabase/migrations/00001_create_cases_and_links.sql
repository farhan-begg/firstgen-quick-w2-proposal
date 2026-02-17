-- Migration: Create cases and case_links tables
-- Description: Core tables for the proposal generation system

-- ============================================================
-- Table: cases
-- One record per Pipedrive deal that has generated a proposal
-- ============================================================
CREATE TABLE cases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_deal_id text UNIQUE NOT NULL,
  company_name     text,
  industry         text,
  status           text DEFAULT 'pending',

  -- Calculated values (w2_count * fixed multipliers)
  calc_total       numeric,
  calc_er          numeric,
  calc_ee          numeric,

  -- Raw inputs & rates used for the calculation
  calc_inputs      jsonb,
  -- Human-readable explanation of how we got the numbers
  calc_explanation text,

  -- Idempotency guard: ignore duplicate webhooks within 60s
  last_generated_at timestamptz,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: case_links
-- Magic link tokens + passcode hashes for secure access
-- ============================================================
CREATE TABLE case_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

  -- SHA-256 hashes (never store raw tokens/passcodes)
  token_hash     text NOT NULL,
  passcode_hash  text NOT NULL,

  -- Link lifecycle
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,

  -- Brute-force protection
  attempt_count  int NOT NULL DEFAULT 0,
  locked_until   timestamptz,

  -- Audit / analytics
  view_count     int NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
-- UNIQUE index on token_hash to prevent ambiguous lookups
CREATE UNIQUE INDEX idx_case_links_token_hash ON case_links(token_hash);
-- Index on case_id for efficient FK lookups and revocation queries
CREATE INDEX idx_case_links_case_id ON case_links(case_id);

-- ============================================================
-- Row Level Security
-- Enabled on both tables with NO public policies.
-- Edge Functions use the service_role key to bypass RLS.
-- ============================================================
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_links ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Trigger: auto-update updated_at on cases
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
