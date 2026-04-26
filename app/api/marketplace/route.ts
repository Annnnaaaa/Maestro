import { NextRequest } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";
import { addAgent, getAgents } from "@/lib/marketplace";
import { isManifest } from "@/lib/manifest-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors({ agents: getAgents() });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withCors({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isManifest(body)) {
    return withCors(
      {
        error:
          "body must be a full AgentManifest (see /lib/manifest-schema.ts)",
      },
      { status: 400 }
    );
  }

  try {
    const agent = addAgent(body);
    return withCors({ ok: true, agent });
  } catch (err) {
    return withCors(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
