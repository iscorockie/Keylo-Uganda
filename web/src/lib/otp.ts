import bcrypt from "bcryptjs";

/**
 * Mock OTP provider. In production this would call an SMS gateway.
 * We hash the OTP before storing so the plain code is never persisted.
 */

export async function issueOtp(): Promise<{ code: string; hash: string; reference: string }> {
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  const hash = await bcrypt.hash(code, 6);
  const reference = `mock-otp-${Date.now()}`;
  return { code, hash, reference };
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
