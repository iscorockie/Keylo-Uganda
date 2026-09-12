/**
 * External provider interfaces — mocked in v1 so the happy path works end-to-end.
 * Swap in real gnuGrid / MTN / Airtel clients behind these same interfaces later.
 */

export type GnuGridResult = {
  score: number;
  reference: string;
  available: boolean;
};

export function gnuGridMobileScore(nin: string): GnuGridResult {
  if (process.env.MOCK_GNUSCORE !== "true") {
    throw new Error("GNUSCORE provider not configured");
  }
  // Deterministic mock so scores are stable per NIN for demoing.
  const seed = [...nin].reduce((a, c) => a + c.charCodeAt(0), 0);
  const score = 400 + (seed * 137) % 450; // 400–850
  return { score, reference: `mock-gg-${nin.slice(-4)}-${Date.now()}`, available: true };
}

export type MomoResult = {
  status: "requested" | "failed";
  reference: string;
  message: string;
};

export function requestToPay(channel: "mtn" | "airtel", phone: string, amount: number): MomoResult {
  if (process.env.MOCK_MOMO !== "true") {
    throw new Error("MOMO provider not configured");
  }
  return {
    status: "requested",
    reference: `mock-rtp-${channel}-${Date.now()}`,
    message: `Request-to-Pay sent to ${phone} for UGX ${amount.toLocaleString()}`,
  };
}
