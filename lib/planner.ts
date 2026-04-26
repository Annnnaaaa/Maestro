import { askClaude } from "./llm";
import { AgentManifest } from "./manifest-schema";
import { findTemplate } from "./templates";

export type PlannedStep = {
  step_id: string;
  agent_id: string;
  capability: string;
  fee_sats: number;
  inputs_for_agent: Record<string, unknown>;
};

export type ExecutionPlan =
  | { feasible: false; reason: string }
  | {
      feasible: true;
      steps: PlannedStep[];
      total_cost_sats: number;
      planner_source: "template" | "claude";
      planner_notes?: string;
    };

const PLANNER_SYSTEM_PROMPT = `You are Maestro's planner. You receive a task request and a list of capabilities currently available in the marketplace. Output a JSON plan with steps[]. Each step has: capability_needed, why, expected_output_field. If the marketplace cannot support this task, return { feasible: false, reason: "..." }. Output only JSON, no prose.`;

function safeJsonParse(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const match = candidate.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

type ClaudeStep = {
  capability_needed: string;
  why?: string;
  expected_output_field?: string;
};

type ClaudePlan =
  | { feasible: false; reason: string }
  | { steps: ClaudeStep[] }
  | { feasible: true; steps: ClaudeStep[] };

function findAgentForCapability(
  capability: string,
  marketplaceAgents: AgentManifest[]
): AgentManifest | undefined {
  const exact = marketplaceAgents.find((a) => a.capability === capability);
  if (exact) return exact;
  return marketplaceAgents.find((a) => a.capability_tags.includes(capability));
}

function buildInputsForAgent(
  agent: AgentManifest,
  request: string,
  consumerInputs: Record<string, unknown>,
  priorOutputs: Record<string, unknown>
): Record<string, unknown> {
  const inputs: Record<string, unknown> = { task_description: request };

  for (const key of Object.keys(agent.required_inputs)) {
    if (consumerInputs[key] !== undefined) inputs[key] = consumerInputs[key];
    else if (priorOutputs[key] !== undefined) inputs[key] = priorOutputs[key];
  }
  for (const key of Object.keys(agent.optional_inputs)) {
    if (consumerInputs[key] !== undefined) inputs[key] = consumerInputs[key];
    else if (priorOutputs[key] !== undefined) inputs[key] = priorOutputs[key];
  }
  return inputs;
}

function assemblePlan(
  capabilities: string[],
  marketplaceAgents: AgentManifest[],
  request: string,
  consumerInputs: Record<string, unknown>,
  source: "template" | "claude",
  notes?: string
): ExecutionPlan {
  const steps: PlannedStep[] = [];
  // priorOutputs is a notional aggregator: at plan time we don't have real
  // outputs yet, but we use it to thread declared output field names so a
  // later step's inputs can reference an earlier step's output keys.
  const priorOutputs: Record<string, unknown> = {};

  for (let i = 0; i < capabilities.length; i += 1) {
    const cap = capabilities[i];
    const agent = findAgentForCapability(cap, marketplaceAgents);
    if (!agent) {
      return {
        feasible: false,
        reason: `no agent in marketplace can provide capability "${cap}"`,
      };
    }

    steps.push({
      step_id: `s${i + 1}_${agent.agent_id}`,
      agent_id: agent.agent_id,
      capability: cap,
      fee_sats: agent.pricing.base_sats,
      inputs_for_agent: buildInputsForAgent(agent, request, consumerInputs, priorOutputs),
    });

    for (const outKey of Object.keys(agent.outputs)) {
      priorOutputs[outKey] = `<from:${agent.agent_id}>`;
    }
  }

  const total_cost_sats = steps.reduce((sum, s) => sum + s.fee_sats, 0);
  return {
    feasible: true,
    steps,
    total_cost_sats,
    planner_source: source,
    planner_notes: notes,
  };
}

export async function planTask(
  request: string,
  marketplaceAgents: AgentManifest[],
  consumerInputs: Record<string, unknown> = {}
): Promise<ExecutionPlan> {
  // 1) Fast path: known templates.
  const template = findTemplate(request);
  if (template) {
    return assemblePlan(
      template.capabilities,
      marketplaceAgents,
      request,
      consumerInputs,
      "template",
      `matched template "${template.key}"`
    );
  }

  // 2) Ask Claude to plan freely from the marketplace.
  const capabilitySummary = marketplaceAgents.map((a) => ({
    agent_id: a.agent_id,
    capability: a.capability,
    description: a.description,
    capability_tags: a.capability_tags,
  }));

  const userPrompt = `Task request:\n${request}\n\nAvailable marketplace capabilities:\n${JSON.stringify(capabilitySummary, null, 2)}`;

  let raw: string;
  try {
    raw = await askClaude(PLANNER_SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    return {
      feasible: false,
      reason: `planner LLM call failed: ${(err as Error).message}`,
    };
  }

  const parsed = safeJsonParse(raw) as ClaudePlan | null;
  if (!parsed) {
    return { feasible: false, reason: "planner returned unparseable output" };
  }

  if ("feasible" in parsed && parsed.feasible === false) {
    return { feasible: false, reason: parsed.reason };
  }

  const steps = "steps" in parsed ? parsed.steps : [];
  if (!steps.length) {
    return { feasible: false, reason: "planner returned no steps" };
  }

  return assemblePlan(
    steps.map((s) => s.capability_needed),
    marketplaceAgents,
    request,
    consumerInputs,
    "claude"
  );
}
