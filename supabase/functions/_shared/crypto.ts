/**
 * Shared crypto helpers for Supabase Edge Functions.
 * Used by generate_case_from_pipedrive, validate_case_access, and regenerate_link.
 */

/**
 * SHA-256 hash a string with a pepper prefix.
 * Returns the hex-encoded digest.
 */
export async function hashWithPepper(
  value: string,
  pepper: string
): Promise<string> {
  const data = new TextEncoder().encode(pepper + value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a cryptographically random token (32 bytes) as hex string.
 */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a 6-digit numeric passcode as a string (zero-padded).
 */
export function generatePasscode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const num =
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(num % 1000000).padStart(6, "0");
}
