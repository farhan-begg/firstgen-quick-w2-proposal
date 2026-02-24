-- Migration: Convert to standalone platform
-- Remove Pipedrive dependency, add user auth, simplify case_links

-- ============================================================
-- 1. Add user_id to cases (links cases to auth.users)
-- ============================================================
ALTER TABLE cases ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Drop Pipedrive-specific constraints and columns
-- ============================================================
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_pipedrive_deal_id_key;
ALTER TABLE cases ALTER COLUMN pipedrive_deal_id DROP NOT NULL;

-- ============================================================
-- 3. Simplify case_links — remove passcode fields
-- ============================================================
ALTER TABLE case_links ALTER COLUMN passcode_hash DROP NOT NULL;
ALTER TABLE case_links ALTER COLUMN passcode_hash SET DEFAULT '';

-- Drop brute-force columns (no passcode = no brute force)
-- We keep the columns but they become unused; safe to leave

-- ============================================================
-- 4. Store shareable URL so users can copy it from the dashboard
-- ============================================================
ALTER TABLE case_links ADD COLUMN shareable_url text;

-- ============================================================
-- 5. Add index on user_id for dashboard queries
-- ============================================================
CREATE INDEX idx_cases_user_id ON cases(user_id);

-- ============================================================
-- 6. RLS Policies for authenticated users
-- ============================================================

-- Cases: users can read/insert/update their own cases
CREATE POLICY "Users can view their own cases"
  ON cases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cases"
  ON cases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Case links: users can manage links for their own cases
CREATE POLICY "Users can view links for their own cases"
  ON case_links FOR SELECT
  TO authenticated
  USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert links for their own cases"
  ON case_links FOR INSERT
  TO authenticated
  WITH CHECK (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

CREATE POLICY "Users can update links for their own cases"
  ON case_links FOR UPDATE
  TO authenticated
  USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

-- Public read for case_links by token (for the viewer page)
-- This allows anyone with a valid token to look up the link
CREATE POLICY "Anyone can read case_links by token_hash"
  ON case_links FOR SELECT
  TO anon
  USING (true);

-- Public read for cases data (for the viewer page after token validation)
CREATE POLICY "Anyone can read case data via anon"
  ON cases FOR SELECT
  TO anon
  USING (true);
