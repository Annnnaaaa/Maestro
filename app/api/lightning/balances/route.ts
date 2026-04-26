import { corsPreflight, withCors } from "@/lib/cors";
import { getLedgerSnapshot, getRealBalance } from "@/lib/lightning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  const ledger = getLedgerSnapshot();
  return withCors({
    ...ledger,
    ledger,
    realBalance: await getRealBalance(),
  });
}
