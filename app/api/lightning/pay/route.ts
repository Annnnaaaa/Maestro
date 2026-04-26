import { NextRequest } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";
import { payAgent } from "@/lib/lightning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  let body: {
    fromAgentId?: string;
    toAgentId?: string;
    amountSats?: number;
    memo?: string;
  };

  try {
    body = await req.json();
  } catch {
    return withCors({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.fromAgentId || !body.toAgentId || typeof body.amountSats !== "number") {
    return withCors(
      { error: "fromAgentId, toAgentId, and amountSats are required" },
      { status: 400 }
    );
  }

  const result = await payAgent(
    body.fromAgentId,
    body.toAgentId,
    body.amountSats,
    body.memo ?? `${body.fromAgentId} -> ${body.toAgentId}`
  );

  return withCors(result, { status: result.success ? 200 : 400 });
}
