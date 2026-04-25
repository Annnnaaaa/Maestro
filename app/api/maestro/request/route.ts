import { NextRequest } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";
import {
  analyzeRequest,
  decomposeTask,
  newJobId,
  priceJob,
  saveJob,
} from "@/lib/maestro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  let body: { consumerRequest?: string; providedSpecs?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return withCors({ error: "invalid JSON body" }, { status: 400 });
  }

  const consumerRequest = (body.consumerRequest ?? "").trim();
  if (!consumerRequest) {
    return withCors({ error: "consumerRequest is required" }, { status: 400 });
  }

  let analysis;
  try {
    analysis = await analyzeRequest(consumerRequest, body.providedSpecs);
  } catch (err) {
    return withCors(
      { error: "maestro analysis failed", detail: (err as Error).message },
      { status: 500 }
    );
  }

  if (analysis.needsClarification) {
    return withCors({
      needsClarification: true,
      questions: analysis.questions ?? [],
    });
  }

  const spec = analysis.spec!;
  const plan = decomposeTask(spec);
  const { subtotal, margin, total } = priceJob(plan);
  const jobId = newJobId();

  saveJob({
    id: jobId,
    spec,
    plan,
    totalCost: total,
    margin,
    createdAt: Date.now(),
    status: "planned",
    results: {},
  });

  return withCors({
    needsClarification: false,
    jobId,
    spec,
    plannedAgents: plan.map((p) => ({ name: p.name, fee_sats: p.fee_sats })),
    subtotal,
    margin,
    totalCost: total,
  });
}
