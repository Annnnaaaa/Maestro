import { askLLM } from "./llm";
import { AgentManifest } from "./manifest-schema";
import { getAgentsByCapability, pickBestAgent } from "./marketplace";
import { findTemplate } from "./templates";

export type SelectionRationale = {
  candidate_count: number;
  min_sats: number;
  max_sats: number;
  message: string;
};

export type PlannedStep = {
  step_id: string;
  agent_id: string;
  capability: string;
  fee_sats: number;
  inputs_for_agent: Record<string, unknown>;
  selection_rationale?: SelectionRationale;
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

const AGENT_SELECTOR_SYSTEM_PROMPT = `You are Maestro's agent selector.
Given a task request, a capability needed, and multiple candidate agents with pricing and descriptions, select the best agent(s) to run.

Rules:
- Output ONLY JSON.
- Return { "selected_agent_ids": string[], "reason": string }.
- Prefer 1 agent. Choose multiple only if it materially improves quality, robustness, or speed (e.g. parallel alternatives, fallback provider).
- Never select more than 3 agents.
- Consider required_inputs compatibility with the available consumer inputs.
`;

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

type SelectorResult = { selected_agent_ids: string[]; reason?: string };

async function pickAgentsWithLLM(args: {
  capability: string;
  request: string;
  consumerInputs: Record<string, unknown>;
  candidates: AgentManifest[];
}): Promise<{ chosen: AgentManifest[]; reason: string }> {
  const { capability, request, consumerInputs, candidates } = args;
  if (candidates.length <= 1) return { chosen: candidates, reason: "only candidate" };

  // If no LLM key is present, fall back to existing cheapest-choice logic.
  if (!process.env.ANTHROPIC_API_KEY) {
    const cheapest = await pickBestAgent(capability);
    return {
      chosen: cheapest ? [cheapest] : [candidates[0]!],
      reason: "LLM not configured; picked cheapest candidate",
    };
  }

  const candidateSummary = candidates.map((a) => ({
    agent_id: a.agent_id,
    capability: a.capability,
    capability_tags: a.capability_tags,
    description: a.description,
    required_inputs: Object.keys(a.required_inputs),
    outputs: Object.keys(a.outputs),
    pricing_sats: a.pricing.base_sats,
    typical_completion_seconds: a.typical_completion_seconds,
  }));

  const availableInputKeys = Object.keys(consumerInputs ?? {});
  const userPrompt = `Task request:\n${request}\n\nCapability needed:\n${capability}\n\nAvailable consumer input keys:\n${JSON.stringify(
    availableInputKeys
  )}\n\nCandidate agents:\n${JSON.stringify(candidateSummary, null, 2)}`;

  try {
    const raw = await askLLM(AGENT_SELECTOR_SYSTEM_PROMPT, userPrompt);
    const parsed = safeJsonParse(raw) as SelectorResult | null;
    const ids = parsed?.selected_agent_ids ?? [];
    const unique = Array.from(new Set(ids)).slice(0, 3);
    const chosen = unique
      .map((id) => candidates.find((c) => c.agent_id === id))
      .filter(Boolean) as AgentManifest[];

    if (chosen.length > 0) {
      return { chosen, reason: parsed?.reason?.toString() ?? "selected by LLM" };
    }
  } catch {
    // ignore and fall back
  }

  const cheapest = await pickBestAgent(capability);
  return {
    chosen: cheapest ? [cheapest] : [candidates[0]!],
    reason: "LLM selection failed; picked cheapest candidate",
  };
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

function rationaleFor(
  cap: string,
  candidates: AgentManifest[],
  chosen: AgentManifest
): SelectionRationale {
  const prices = candidates.map((c) => c.pricing.base_sats);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const why =
    candidates.length === 1
      ? `only candidate for ${cap}`
      : `cheapest match for ${cap} (${candidates.length} candidates, range ${min}-${max} sats)`;
  return {
    candidate_count: candidates.length,
    min_sats: min,
    max_sats: max,
    message: `Selected ${chosen.agent_id}: ${why}.`,
  };
}

async function assemblePlan(
  capabilities: string[],
  request: string,
  consumerInputs: Record<string, unknown>,
  source: "template" | "claude",
  notes?: string
): Promise<ExecutionPlan> {
  const steps: PlannedStep[] = [];
  // priorOutputs is a notional aggregator: at plan time we don't have real
  // outputs yet, but we use it to thread declared output field names so a
  // later step's inputs can reference an earlier step's output keys.
  const priorOutputs: Record<string, unknown> = {};

  for (let i = 0; i < capabilities.length; i += 1) {
    const cap = capabilities[i];
    const candidates = await getAgentsByCapability(cap);
    if (candidates.length === 0) {
      return {
        feasible: false,
        reason: `No agent available for capability: ${cap}`,
      };
    }

    const { chosen, reason } = await pickAgentsWithLLM({
      capability: cap,
      request,
      consumerInputs,
      candidates,
    });
    if (!chosen.length) {
      return { feasible: false, reason: `No agent could be selected for capability: ${cap}` };
    }

    for (const agent of chosen) {
      steps.push({
        step_id: `s${steps.length + 1}_${agent.agent_id}`,
        agent_id: agent.agent_id,
        capability: cap,
        fee_sats: agent.pricing.base_sats,
        inputs_for_agent: buildInputsForAgent(agent, request, consumerInputs, priorOutputs),
        selection_rationale: {
          ...rationaleFor(cap, candidates, agent),
          message: `Selected ${agent.agent_id}: ${reason} (${candidates.length} candidates).`,
        },
      });

      for (const outKey of Object.keys(agent.outputs)) {
        if (priorOutputs[outKey] === undefined) {
          priorOutputs[outKey] = `<from:${agent.agent_id}>`;
        } else {
          priorOutputs[`${outKey}_${agent.agent_id}`] = `<from:${agent.agent_id}>`;
        }
      }
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
    raw = await askLLM(PLANNER_SYSTEM_PROMPT, userPrompt);
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
    request,
    consumerInputs,
    "claude"
  );
}
