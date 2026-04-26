import { NextRequest } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";
import { verifyPayment } from "@/lib/lightning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  let body: { payment_hash?: string };

  try {
    body = await req.json();
  } catch {
    return withCors({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.payment_hash) {
    return withCors({ error: "payment_hash is required" }, { status: 400 });
  }

  return withCors(await verifyPayment(body.payment_hash));
}
