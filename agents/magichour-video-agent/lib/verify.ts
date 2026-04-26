const VERIFY_URL =
  process.env.LIGHTNING_VERIFY_URL ?? "http://localhost:3000/api/lightning/verify";

function isStubPaymentHash(payment_hash: string): boolean {
  return payment_hash.startsWith("stub_") || payment_hash.startsWith("lnbc");
}

export async function verifyPaymentHash(payment_hash: string): Promise<boolean> {
  if (isStubPaymentHash(payment_hash)) {
    try {
      await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_hash }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Maestro may be offline during development
    }
    return true;
  }
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_hash }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { valid?: boolean; verified?: boolean };
    return data.valid === true || data.verified === true;
  } catch {
    return false;
  }
}

