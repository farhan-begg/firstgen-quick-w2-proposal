import { randomBytes, createHash } from "crypto";

/**
 * SHA-256 hash a string with a pepper prefix.
 * Returns the hex-encoded digest.
 */
export function hashWithPepper(value: string, pepper: string): string {
  return createHash("sha256")
    .update(pepper + value)
    .digest("hex");
}

/**
 * Generate a cryptographically random token (32 bytes) as hex string.
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}
