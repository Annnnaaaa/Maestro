// Stub Lightning Network integration. Will be replaced by the real
// implementation built in parallel by another team member.

export interface PaymentResult {
  success: boolean;
  payment_hash: string;
  settled_at: number;
  agent_id: string;
  amount_sats: number;
}

export async function payInvoice(
  agentId: string,
  amountSats: number
): Promise<PaymentResult> {
  const result: PaymentResult = {
    success: true,
    payment_hash: "stub_" + Date.now(),
    settled_at: Date.now(),
    agent_id: agentId,
    amount_sats: amountSats,
  };
  console.log(
    `[lightning:stub] paid ${amountSats} sats to ${agentId} -> ${result.payment_hash}`
  );
  return result;
}
