import { NextRequest } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";
import { addAgent, getAgents } from "@/lib/marketplace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors({ agents: getAgents() });
}

export async function POST(req: NextRequest) {
  let body: {
    id?: string;
    endpoint?: string;
    fee_sats?: number;
    specialty?: string;
    name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return withCors({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.id || !body.endpoint) {
    return withCors(
      { error: "id and endpoint are required" },
      { status: 400 }
    );
  }

  const agent = addAgent({
    id: body.id,
    endpoint: body.endpoint,
    fee_sats: body.fee_sats,
    specialty: body.specialty,
    name: body.name,
  });

  return withCors({ ok: true, agent });
}
