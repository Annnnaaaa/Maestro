import { AgentManifest } from "./manifest-schema";
import {
  Job,
  getAgent,
  getAllAgents,
  getJob,
  logActivity,
  newActivityId,
  saveJob,
  updateJob,
} from "./storage";
import { ExecutionPlan, PlannedStep, planTask } from "./planner";
import { createInvoice, payAgent } from "./lightning";

export const MAESTRO_AGENT_ID = "maestro";
export const MAESTRO_MARGIN_PCT = 0.15;

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

export async function validateInputsForFirstStep(
  plan: Extract<ExecutionPlan, { feasible: true }>,
  consumerInputs: Record<string, unknown>
): Promise<MissingInputs | null> {
  const firstStep = plan.steps[0];
  if (!firstStep) return null;
  const agent = await getAgent(firstStep.agent_id);
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
  const agents = await getAllAgents();
  const plan = await planTask(request, agents, consumerInputs);
  if (!plan.feasible) return { plan };
  return { plan, pricing: priceJob(plan) };
}

async function callAgentEndpoint(
  agent: AgentManifest,
  inputs: Record<string, unknown>
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
      body: JSON.stringify({ inputs }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`agent ${agent.agent_id} returned ${res.status}`);
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
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(step.inputs_for_agent)) {
    if (typeof value === "string" && value.startsWith("<from:")) {
      if (priorOutputs[key] !== undefined) merged[key] = priorOutputs[key];
    } else {
      merged[key] = value;
    }
  }
  for (const [key, value] of Object.entries(priorOutputs)) {
    if (merged[key] === undefined) merged[key] = value;
  }
  return merged;
}

export { getJob };

export async function* executeJob(jobId: string): AsyncGenerator<ProgressEvent> {
  let job = await getJob(jobId);
  if (!job) {
    yield { step: "error", message: `unknown job ${jobId}` };
    return;
  }
  if (!job.plan || !job.plan.feasible) {
    yield { step: "error", message: `job ${jobId} has no feasible plan` };
    return;
  }

  yield { step: "planning", plan: job.plan };

  job = await updateJob(jobId, { status: "executing" });
  await logActivity({
    id: newActivityId(),
    type: "job_started",
    job_id: jobId,
    message: `job ${jobId} started`,
    timestamp: Date.now(),
  });

  const accumulatedOutputs: Record<string, unknown> = {};
  const stepsCompleted = [...job.steps_completed];
  let totalPaid = job.total_paid_sats;

  for (const step of job.plan.steps) {
    const agent = await getAgent(step.agent_id);
    if (!agent) {
      const msg = `agent ${step.agent_id} not found in marketplace at execution time`;
      yield { step: "error", agent: step.agent_id, message: msg };
      await updateJob(jobId, { status: "failed" });
      return;
    }

    yield { step: "hiring", agent: agent.agent_id, capability: agent.capability };
    await logActivity({
      id: newActivityId(),
      type: "hire",
      to_agent_id: agent.agent_id,
      job_id: jobId,
      message: `hiring ${agent.agent_id} for ${agent.capability}`,
      timestamp: Date.now(),
    });

    const payment = await payAgent(
      MAESTRO_AGENT_ID,
      agent.agent_id,
      step.fee_sats,
      `${agent.capability} (job ${jobId})`
    );
    if (payment.success) totalPaid += step.fee_sats;

    yield {
      step: "working",
      agent: agent.agent_id,
      capability: agent.capability,
      paymentSent: step.fee_sats,
      output: payment.success ? undefined : { paymentError: payment.error },
    };

    const inputs = mergeOutputsIntoInputs(step, accumulatedOutputs);
    const output = await callAgentEndpoint(agent, inputs);

    if (output && typeof output === "object") {
      for (const outKey of Object.keys(agent.outputs)) {
        const v = (output as Record<string, unknown>)[outKey];
        if (v !== undefined) accumulatedOutputs[outKey] = v;
      }
    }

    stepsCompleted.push({
      step_id: step.step_id,
      agent_id: agent.agent_id,
      output,
      payment_hash: payment.payment_hash,
      completed_at: Date.now(),
    });

    await updateJob(jobId, {
      steps_completed: stepsCompleted,
      total_paid_sats: totalPaid,
    });

    yield {
      step: "working",
      agent: agent.agent_id,
      capability: agent.capability,
      output,
    };
  }

  const final_output = {
    ...accumulatedOutputs,
    by_agent: stepsCompleted.reduce<Record<string, unknown>>((acc, s) => {
      acc[s.agent_id] = s.output;
      return acc;
    }, {}),
  };

  await updateJob(jobId, { status: "complete", final_output });
  await logActivity({
    id: newActivityId(),
    type: "job_completed",
    job_id: jobId,
    message: `job ${jobId} completed`,
    timestamp: Date.now(),
  });

  yield { step: "complete", finalOutput: final_output };
}

// Helper used by /api/maestro/job to construct the initial job record.
export function buildIntakeJob(args: {
  request: string;
  inputs: Record<string, unknown>;
  callerType: "agent" | "human";
  callerId?: string;
}): Job {
  const now = Date.now();
  return {
    job_id: newJobId(),
    caller_type: args.callerType,
    caller_id: args.callerId,
    request: args.request,
    inputs: args.inputs,
    status: "intake",
    steps_completed: [],
    total_paid_sats: 0,
    created_at: now,
    updated_at: now,
  };
}

export function maestroManifest(): AgentManifest {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";
  return {
    agent_id: "maestro-v1",
    agent_type: "orchestrator",
    capability: "video_orchestration",
    capability_tags: ["orchestrator", "marketplace", "video"],
    description:
      "Maestro is a general orchestrator. It plans which marketplace agents to hire for a given task and runs the pipeline. Today the marketplace contains video specialists, so video jobs work end-to-end.",
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
      target_audience: { type: "string", description: "Who this is for" },
    },
    optional_inputs: {
      style: { type: "string", description: "cinematic | playful | minimal" },
      duration_seconds: { type: "number", description: "Target duration" },
      voiceover_tone: { type: "string", description: "e.g. warm, energetic" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      results: { type: "object", description: "Map of agent_id -> that agent's output" },
    },
    pricing: {
      base_sats: 0,
      breakdown: { margin_pct: MAESTRO_MARGIN_PCT * 100 },
    },
    typical_completion_seconds: 30,
    hires_agents_with_capabilities: [
      "video_script_writing",
      "voiceover_generation",
      "video_visual_generation",
    ],
    marketplace_url: `${dashboardUrl.replace(/\/$/, "")}/api/marketplace`,
  };
}

export { createInvoice, saveJob };
