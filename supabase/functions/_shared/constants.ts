/**
 * Shared constants for calculation multipliers.
 * Stored here so edge functions + tests use the same values.
 */

/** Per-W2 multiplier for Total Tax Reduction */
export const RATE_TOTAL = 3357;

/** Per-W2 multiplier for Employer Net Savings */
export const RATE_ER = 1187;

/** Per-W2 multiplier for Employee Reduction */
export const RATE_EE = 2170;

/** Link expiry in days */
export const LINK_EXPIRY_DAYS = 30;

/** Lock duration in minutes after too many failed attempts */
export const LOCK_DURATION_MINUTES = 30;

/** Max passcode attempts before locking */
export const MAX_ATTEMPTS = 10;

/** Idempotency window in seconds */
export const IDEMPOTENCY_WINDOW_SECONDS = 60;
