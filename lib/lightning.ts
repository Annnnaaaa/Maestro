import "websocket-polyfill";
import * as nwc from "@getalby/sdk/nwc";

type Ledger = Record<string, number>;

export interface AgentPaymentResult {
  success: boolean;
  payment_hash: string;
  settled_at: number;
  error?: string;
}

export interface ConsumerInvoiceResult {
  invoice: string;
  payment_hash: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
}

export interface LegacyPaymentResult extends AgentPaymentResult {
  agent_id: string;
  amount_sats: number;
}

const INITIAL_LEDGER: Readonly<Ledger> = {
  maestro: 1000,
  "script-agent": 0,
  "voice-agent": 0,
  "visual-agent": 0,
  consumer: 500,
};

const g = globalThis as typeof globalThis & {
  __maestro_lightning_ledger?: Ledger;
  __maestro_lightning_prefer_stub?: boolean;
};

let client: nwc.NWCClient | null = null;

function getLedger(): Ledger {
  if (!g.__maestro_lightning_ledger) {
    g.__maestro_lightning_ledger = { ...INITIAL_LEDGER };
  }
  return g.__maestro_lightning_ledger;
}

function isStubMode(): boolean {
  return process.env.USE_STUB_LIGHTNING === "true" || g.__maestro_lightning_prefer_stub === true;
}

function setPreferStub(reason: unknown): void {
  g.__maestro_lightning_prefer_stub = true;
  console.error("[lightning] switching to stub mode for this session", reason);
}

function randomDelayMs(): number {
  return 200 + Math.floor(Math.random() * 601);
}

function randomHex(length: number): string {
  const alphabet = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function stubPaymentHash(): string {
  return `stub_${randomHex(24)}`;
}

function stubInvoice(amountSats: number, memo: string): string {
  const encodedMemo = Buffer.from(memo).toString("base64url");
  return `lnbc${amountSats}n1p${randomHex(20)}${encodedMemo}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getClient(): nwc.NWCClient {
  if (!process.env.NWC_CONNECTION_STRING) {
    throw new Error("NWC_CONNECTION_STRING is not set");
  }

  if (!client) {
    client = new nwc.NWCClient({
      nostrWalletConnectUrl: process.env.NWC_CONNECTION_STRING,
    });
  }

  return client;
}

async function withLightningFallback<T>(action: string, run: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (isStubMode()) {
    return fallback();
  }

  try {
    return await run();
  } catch (error) {
    console.error(`[lightning] ${action} failed`, error);
    setPreferStub(error);
    return fallback();
  }
}

async function stubGetRealBalance(): Promise<number> {
  await sleep(randomDelayMs());
  return Object.values(getLedger()).reduce((sum, value) => sum + value, 0);
}

async function stubCreateInvoice(amountSats: number, memo: string): Promise<ConsumerInvoiceResult> {
  await sleep(randomDelayMs());
  return {
    invoice: stubInvoice(amountSats, memo),
    payment_hash: stubPaymentHash(),
  };
}

async function stubVerifyPayment(_paymentHash: string): Promise<VerifyPaymentResult> {
  await sleep(randomDelayMs());
  return { verified: true };
}

async function stubRoundTripPayment(
  fromAgentId: string,
  toAgentId: string,
  amountSats: number,
  error?: string
): Promise<AgentPaymentResult> {
  const startedAt = Date.now();
  await sleep(randomDelayMs());
  const payment_hash = stubPaymentHash();
  const settled_at = Date.now();
  console.log(
    `⚡ ${amountSats} sats: ${fromAgentId} -> ${toAgentId} [${payment_hash}] (${settled_at - startedAt}ms) [stub]`
  );
  return {
    success: true,
    payment_hash,
    settled_at,
    ...(error ? { error } : {}),
  };
}

function adjustLedger(fromAgentId: string, toAgentId: string, amountSats: number): void {
  const ledger = getLedger();
  ledger[fromAgentId] = (ledger[fromAgentId] ?? 0) - amountSats;
  ledger[toAgentId] = (ledger[toAgentId] ?? 0) + amountSats;
}

export function initLedger(): Ledger {
  g.__maestro_lightning_ledger = { ...INITIAL_LEDGER };
  return getLedgerSnapshot();
}

export function getVirtualBalance(agentId: string): number {
  return getLedger()[agentId] ?? 0;
}

export async function getRealBalance(): Promise<number> {
  return withLightningFallback(
    "getBalance",
    async () => {
      const balance = await getClient().getBalance();
      return Math.floor(balance.balance / 1000);
    },
    stubGetRealBalance
  );
}

export async function payAgent(
  fromAgentId: string,
  toAgentId: string,
  amountSats: number,
  memo: string
): Promise<AgentPaymentResult> {
  if (!Number.isFinite(amountSats) || amountSats <= 0) {
    return {
      success: false,
      payment_hash: "",
      settled_at: Date.now(),
      error: "amountSats must be a positive number",
    };
  }

  const fromBalance = getVirtualBalance(fromAgentId);
  if (fromBalance < amountSats) {
    return {
      success: false,
      payment_hash: "",
      settled_at: Date.now(),
      error: `insufficient virtual balance for ${fromAgentId}`,
    };
  }

  if (isStubMode()) {
    adjustLedger(fromAgentId, toAgentId, amountSats);
    return stubRoundTripPayment(fromAgentId, toAgentId, amountSats);
  }

  const startedAt = Date.now();

  try {
    const lightningClient = getClient();
    const invoice = await lightningClient.makeInvoice({
      amount: amountSats * 1000,
      description: memo,
    });
    await lightningClient.payInvoice({ invoice: invoice.invoice });

    adjustLedger(fromAgentId, toAgentId, amountSats);

    const settled_at = Date.now();
    const payment_hash = invoice.payment_hash;
    console.log(
      `⚡ ${amountSats} sats: ${fromAgentId} -> ${toAgentId} [${payment_hash}] (${settled_at - startedAt}ms)`
    );

    return {
      success: true,
      payment_hash,
      settled_at,
    };
  } catch (error) {
    console.error("[lightning] payAgent failed, continuing with stub ledger settlement", error);
    setPreferStub(error);
    adjustLedger(fromAgentId, toAgentId, amountSats);
    return stubRoundTripPayment(
      fromAgentId,
      toAgentId,
      amountSats,
      error instanceof Error ? error.message : "lightning payment failed"
    );
  }
}

export async function createInvoice(amountSats: number, memo: string): Promise<ConsumerInvoiceResult> {
  return withLightningFallback(
    "makeInvoice",
    async () => {
      const invoice = await getClient().makeInvoice({
        amount: amountSats * 1000,
        description: memo,
      });
      return {
        invoice: invoice.invoice,
        payment_hash: invoice.payment_hash,
      };
    },
    async () => stubCreateInvoice(amountSats, memo)
  );
}

export async function verifyPayment(payment_hash: string): Promise<VerifyPaymentResult> {
  return withLightningFallback(
    "lookupInvoice",
    async () => {
      const invoice = await getClient().lookupInvoice({ payment_hash });
      return { verified: invoice.state === "settled" || invoice.settled_at > 0 };
    },
    async () => stubVerifyPayment(payment_hash)
  );
}

export function getLedgerSnapshot(): Ledger {
  return { ...getLedger() };
}

export async function payInvoice(agentId: string, amountSats: number): Promise<LegacyPaymentResult> {
  const result = await payAgent("maestro", agentId, amountSats, `agent fee: ${agentId}`);
  return {
    ...result,
    agent_id: agentId,
    amount_sats: amountSats,
  };
}

initLedger();
