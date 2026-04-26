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
import { gatherMissingInputsFromMcp } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  try {
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
  let consumerInputs = body.inputs ?? body.providedSpecs ?? {};

  const { plan, pricing } = await planAndPriceJob(taskRequest, consumerInputs);

  if (!plan.feasible) {
    return withCors({ status: "no_capability_match", reason: plan.reason });
  }

  let missing = validateInputsForFirstStep(plan, consumerInputs);
  if (missing) {
    // Optional MCP enrichment: let an MCP server fill missing fields (e.g. by
    // inspecting a repo, docs, prior conversation, etc.).
    const mcp = await gatherMissingInputsFromMcp({
      request: taskRequest,
      missing_inputs: missing.missing_inputs,
      consumer_inputs: consumerInputs,
    });

    if (mcp?.filled_inputs && typeof mcp.filled_inputs === "object") {
      consumerInputs = { ...consumerInputs, ...mcp.filled_inputs };
      const replanned = await planAndPriceJob(taskRequest, consumerInputs);
      if (!replanned.plan.feasible) {
        return withCors({ status: "no_capability_match", reason: replanned.plan.reason });
      }
      missing = validateInputsForFirstStep(replanned.plan, consumerInputs);
      if (missing) {
        return withCors({
          status: "missing_inputs",
          missing_inputs: missing.missing_inputs,
          for_agent: missing.for_agent,
          plan: replanned.plan,
          pricing: replanned.pricing,
          mcp_notes: mcp.notes ?? undefined,
          mcp_filled_inputs: mcp.filled_inputs,
        });
      }

      // MCP succeeded; proceed with the enriched inputs.
      const jobId = newJobId();
      const invoice = await createInvoice(
        replanned.pricing!.total,
        `maestro job ${jobId}: ${taskRequest.slice(0, 80)}`
      );

      const job: Job = {
        id: jobId,
        request: taskRequest,
        consumerInputs,
        plan: replanned.plan,
        subtotalSats: replanned.pricing!.subtotal,
        marginSats: replanned.pricing!.margin,
        totalSats: replanned.pricing!.total,
        invoice,
        createdAt: Date.now(),
        status: "awaiting_payment",
        results: {},
      };
      saveJob(job);

      return withCors({
        status: "ready",
        jobId,
        plan: replanned.plan,
        pricing: replanned.pricing,
        invoice,
        mcp_notes: mcp.notes ?? undefined,
        mcp_filled_inputs: mcp.filled_inputs,
      });
    }

    // MCP not configured / did not fill enough: ask user for what's missing.
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
  } catch (e) {
    return withCors(
      { error: "job_failed", message: (e as Error).message },
      { status: 500 }
    );
  }
}
