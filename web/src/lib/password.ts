import bcrypt from "bcryptjs";

/**
 * Centralized password hashing + verification.
 *
 * - Algorithm: bcrypt (via bcryptjs), the same everywhere so hashes are portable.
 * - Cost factor: configurable via BCRYPT_ROUNDS; defaults to 12 (OWASP-recommended
 *   floor for 2024+). 10 is the library default and is now considered too low.
 * - Plaintext is NEVER persisted — only the bcrypt digest goes to the DB.
 */

const ROUNDS = Math.max(
  10,
  Number.parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10) || 12,
);

/** Hash a plaintext password for storage. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/** Constant-time compare of a plaintext against a stored hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A precomputed hash used to keep response timing uniform when the user does not
 * exist, preventing username enumeration via a timing side-channel.
 */
export const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7Vh0G5jQ4z1p4y9vX0mK3q7bG5t6a";

/** Run a compare that always costs the same whether or not the user exists. */
export async function verifyAgainst(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  return verifyPassword(plain, hash ?? DUMMY_HASH);
}

/**
 * Minimum password policy (applies to real user accounts, not demo seeds).
 * Demo seeds may use shorter values for convenience.
 */
export function passwordIssues(plain: string): string[] {
  const issues: string[] = [];
  if (plain.length < 8) issues.push("at least 8 characters");
  if (!/[a-z]/.test(plain)) issues.push("a lowercase letter");
  if (!/[A-Z]/.test(plain)) issues.push("an uppercase letter");
  if (!/[0-9]/.test(plain)) issues.push("a number");
  return issues;
}
