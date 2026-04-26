import { NextRequest } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";
import {
  Job,
  createInvoice,
  newJobId,
  planAndPriceJob,
  saveJob,
  validateInputsForFirstStep,
} from "@/lib/maestro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  let body: {
    request?: string;
    consumerRequest?: string; // accepted as alias for backward compat
    inputs?: Record<string, unknown>;
    providedSpecs?: Record<string, unknown>; // alias
  };
  try {
    body = await req.json();
  } catch {
    return withCors({ error: "invalid JSON body" }, { status: 400 });
  }

  const taskRequest = (body.request ?? body.consumerRequest ?? "").trim();
  if (!taskRequest) {
    return withCors({ error: "request is required" }, { status: 400 });
  }
  const consumerInputs = body.inputs ?? body.providedSpecs ?? {};

  const { plan, pricing } = await planAndPriceJob(taskRequest, consumerInputs);

  if (!plan.feasible) {
    return withCors({ status: "no_capability_match", reason: plan.reason });
  }

  const missing = validateInputsForFirstStep(plan, consumerInputs);
  if (missing) {
    return withCors({
      status: "missing_inputs",
      missing_inputs: missing.missing_inputs,
      for_agent: missing.for_agent,
      plan,
      pricing,
    });
  }

  const jobId = newJobId();
  const invoice = await createInvoice(
    pricing!.total,
    `maestro job ${jobId}: ${taskRequest.slice(0, 80)}`
  );

  const job: Job = {
    id: jobId,
    request: taskRequest,
    consumerInputs,
    plan,
    subtotalSats: pricing!.subtotal,
    marginSats: pricing!.margin,
    totalSats: pricing!.total,
    invoice,
    createdAt: Date.now(),
    status: "awaiting_payment",
    results: {},
  };
  saveJob(job);

  return withCors({
    status: "ready",
    jobId,
    plan,
    pricing,
    invoice,
  });
}
