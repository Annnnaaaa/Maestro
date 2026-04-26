import { AgentManifest } from "./manifest-schema";
import { getAgent, getAgents } from "./marketplace";
import { ExecutionPlan, PlannedStep, planTask } from "./planner";
import { payAgent } from "./lightning";
import { createInvoice } from "./lightning";

export const MAESTRO_AGENT_ID = "maestro";
export const MAESTRO_MARGIN_PCT = 0.15;

export interface Job {
  id: string;
  request: string;
  consumerInputs: Record<string, unknown>;
  plan: Extract<ExecutionPlan, { feasible: true }>;
  subtotalSats: number;
  marginSats: number;
  totalSats: number;
  invoice?: { invoice: string; payment_hash: string };
  createdAt: number;
  status: "planned" | "running" | "complete" | "error";
  results: Record<string, unknown>;
  error?: string;
}

export interface ProgressEvent {
  step: "planning" | "hiring" | "working" | "complete" | "error";
  agent?: string;
  capability?: string;
  paymentSent?: number;
  output?: unknown;
  message?: string;
  finalOutput?: unknown;
  plan?: ExecutionPlan;
}

const g = globalThis as typeof globalThis & {
  __maestro_jobs?: Map<string, Job>;
};
if (!g.__maestro_jobs) g.__maestro_jobs = new Map();
const jobs = g.__maestro_jobs;

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function saveJob(job: Job): void {
  jobs.set(job.id, job);
}

export function newJobId(): string {
  return "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function priceJob(plan: Extract<ExecutionPlan, { feasible: true }>): {
  subtotal: number;
  margin: number;
  total: number;
} {
  const subtotal = plan.total_cost_sats;
  const margin = Math.ceil(subtotal * MAESTRO_MARGIN_PCT);
  return { subtotal, margin, total: subtotal + margin };
}

export type MissingInputs = {
  missing_inputs: string[];
  for_agent: string;
};

export function validateInputsForFirstStep(
  plan: Extract<ExecutionPlan, { feasible: true }>,
  consumerInputs: Record<string, unknown>
): MissingInputs | null {
  const firstStep = plan.steps[0];
  if (!firstStep) return null;
  const agent = getAgent(firstStep.agent_id);
  if (!agent) return null;
  const missing = Object.keys(agent.required_inputs).filter(
    (key) => consumerInputs[key] === undefined
  );
  if (missing.length === 0) return null;
  return { missing_inputs: missing, for_agent: agent.agent_id };
}

export async function planAndPriceJob(
  request: string,
  consumerInputs: Record<string, unknown>
): Promise<{
  plan: ExecutionPlan;
  pricing?: { subtotal: number; margin: number; total: number };
}> {
  const plan = await planTask(request, getAgents(), consumerInputs);
  if (!plan.feasible) return { plan };
  return { plan, pricing: priceJob(plan) };
}

async function callAgentEndpoint(
  agent: AgentManifest,
  inputs: Record<string, unknown>,
  payment_hash?: string
): Promise<unknown> {
  if (!agent.endpoint) {
    return { stub: true, reason: "no endpoint configured", agent: agent.agent_id };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(agent.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Most specialist agents require a payment_hash. For hackathon velocity,
      // Maestro sends a flattened payload plus a nested `inputs` copy for
      // forwards/backwards compatibility across agents.
      body: JSON.stringify({
        ...(payment_hash ? { payment_hash } : {}),
        ...inputs,
        inputs,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `agent ${agent.agent_id} returned ${res.status}${text ? `: ${text}` : ""}`
      );
    }
    return await res.json();
  } catch (err) {
    return {
      stub: true,
      agent: agent.agent_id,
      capability: agent.capability,
      note: `sub-agent unreachable, returning stub output (${(err as Error).message})`,
    };
  }
}

function mergeOutputsIntoInputs(
  step: PlannedStep,
  priorOutputs: Record<string, unknown>
): Record<string, unknown> {
  // Replace any "<from:agent_id>" placeholders the planner left behind with
  // actual prior outputs, when available. Anything else in inputs_for_agent
  // is passed through as-is.
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(step.inputs_for_agent)) {
    if (typeof value === "string" && value.startsWith("<from:")) {
      if (priorOutputs[key] !== undefined) {
        merged[key] = priorOutputs[key];
      }
    } else {
      merged[key] = value;
    }
  }
  // Always pass anything from priorOutputs that the agent might want.
  for (const [key, value] of Object.entries(priorOutputs)) {
    if (merged[key] === undefined) merged[key] = value;
  }
  return merged;
}

export async function* executeJob(jobId: string): AsyncGenerator<ProgressEvent> {
  const job = jobs.get(jobId);
  if (!job) {
    yield { step: "error", message: `unknown job ${jobId}` };
    return;
  }

  // Emit the plan first so the dashboard can show "Maestro is choosing
  // which agents to hire" before any payment fires.
  yield { step: "planning", plan: job.plan };

  job.status = "running";
  saveJob(job);

  const accumulatedOutputs: Record<string, unknown> = {};

  for (const step of job.plan.steps) {
    const agent = getAgent(step.agent_id);
    if (!agent) {
      yield {
        step: "error",
        agent: step.agent_id,
        message: "agent not found in marketplace at execution time",
      };
      job.status = "error";
      job.error = `agent ${step.agent_id} not found`;
      saveJob(job);
      return;
    }

    yield { step: "hiring", agent: agent.agent_id, capability: agent.capability };

    const payment = await payAgent(
      MAESTRO_AGENT_ID,
      agent.agent_id,
      step.fee_sats,
      `${agent.capability} (job ${job.id})`
    );

    yield {
      step: "working",
      agent: agent.agent_id,
      capability: agent.capability,
      paymentSent: step.fee_sats,
      output: payment.success ? undefined : { paymentError: payment.error },
    };

    const inputs = mergeOutputsIntoInputs(step, accumulatedOutputs);
    const paymentHashForAgent =
      (payment.payment_hash && payment.payment_hash.trim().length > 0
        ? payment.payment_hash
        : job.invoice?.payment_hash) ?? undefined;
    const output = await callAgentEndpoint(
      agent,
      inputs,
      paymentHashForAgent
    );

    if (output && typeof output === "object") {
      // Hoist the agent's declared output fields into the shared bag so
      // downstream steps can consume them by key.
      for (const outKey of Object.keys(agent.outputs)) {
        const v = (output as Record<string, unknown>)[outKey];
        if (v !== undefined) accumulatedOutputs[outKey] = v;
      }
    }

    job.results[agent.agent_id] = output;
    saveJob(job);

    yield {
      step: "working",
      agent: agent.agent_id,
      capability: agent.capability,
      output,
    };
  }

  job.status = "complete";
  saveJob(job);

  yield { step: "complete", finalOutput: job.results };
}

// Maestro's own manifest. Surfaced at GET /api/agent/manifest.
export function maestroManifest(): AgentManifest {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";
  return {
    agent_id: "maestro-v1",
    agent_type: "orchestrator",
    capability: "video_orchestration",
    capability_tags: ["orchestrator", "marketplace", "video"],
    description:
      "Maestro is a general orchestrator. It plans which marketplace agents to hire for a given task and runs the pipeline. For product videos, it prefers direct JSON2Video generation when available.",
    required_inputs: {
      product_name: { type: "string", description: "Product name" },
      product_description: {
        type: "string",
        description: "Short description of what the product does",
      },
      visual_context: {
        type: "string",
        description: "Aesthetic / brand cues to guide visuals",
      },
      target_audience: {
        type: "string",
        description: "Who this is for",
      },
    },
    optional_inputs: {
      style: { type: "string", description: "cinematic | playful | minimal" },
      duration_seconds: { type: "number", description: "Target duration" },
      voiceover_tone: { type: "string", description: "e.g. warm, energetic" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      results: {
        type: "object",
        description: "Map of agent_id -> that agent's output",
      },
    },
    pricing: {
      base_sats: 0,
      breakdown: { margin_pct: MAESTRO_MARGIN_PCT * 100 },
    },
    typical_completion_seconds: 30,
    hires_agents_with_capabilities: [
      "product_video_generation_json2video",
    ],
    marketplace_url: `${dashboardUrl.replace(/\/$/, "")}/api/marketplace`,
  };
}

// Re-exported for the API layer; declared here to keep route imports tidy.
export { createInvoice };
