import { askClaude } from "./llm";
import { Agent, getAgent, getAgents } from "./marketplace";
import { payInvoice } from "./lightning";

export interface VideoSpec {
  product_name: string;
  product_description: string;
  style: "cinematic" | "playful" | "minimal";
  duration_seconds: number;
  voiceover_tone: string;
  target_audience: string;
}

export interface PlannedAgent {
  id: string;
  name: string;
  fee_sats: number;
}

export interface Job {
  id: string;
  spec: VideoSpec;
  plan: PlannedAgent[];
  totalCost: number;
  margin: number;
  createdAt: number;
  status: "planned" | "running" | "complete" | "error";
  results: Record<string, unknown>;
  error?: string;
}

export interface ProgressEvent {
  step: "hiring" | "working" | "complete" | "error";
  agent?: string;
  paymentSent?: number;
  output?: unknown;
  message?: string;
  finalOutput?: unknown;
}

const MAESTRO_MARGIN_PCT = 0.15;

const MAESTRO_SYSTEM_PROMPT = `You are Maestro, an orchestrator agent for a marketplace of specialist agents. Given a consumer request for a product video, output a JSON spec with fields: product_name, product_description, style (one of: cinematic/playful/minimal), duration_seconds, voiceover_tone, target_audience. If any field is missing or ambiguous from the input, return {needs_clarification: true, questions: [...]} with at most 2 questions. Otherwise return {needs_clarification: false, spec: {...}}.`;

const g = globalThis as unknown as { __maestro_jobs?: Map<string, Job> };
if (!g.__maestro_jobs) g.__maestro_jobs = new Map();
const jobs = g.__maestro_jobs;

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function saveJob(job: Job): void {
  jobs.set(job.id, job);
}

function safeJsonParse(raw: string): unknown {
  // Models sometimes wrap JSON in ```json fences. Strip them.
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Try to find the first {...} block
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

export interface MaestroAnalysis {
  needsClarification: boolean;
  questions?: string[];
  spec?: VideoSpec;
}

export async function analyzeRequest(
  consumerRequest: string,
  providedSpecs?: Record<string, unknown>
): Promise<MaestroAnalysis> {
  const userPrompt = providedSpecs
    ? `Consumer request: ${consumerRequest}\n\nProvided specs (use these as ground truth, do not re-ask): ${JSON.stringify(providedSpecs)}`
    : `Consumer request: ${consumerRequest}`;

  const raw = await askClaude(MAESTRO_SYSTEM_PROMPT, userPrompt);
  const parsed = safeJsonParse(raw) as
    | { needs_clarification: true; questions: string[] }
    | { needs_clarification: false; spec: VideoSpec }
    | null;

  if (!parsed) {
    return {
      needsClarification: true,
      questions: [
        "Could you describe the product in more detail (name, what it does, who it's for)?",
      ],
    };
  }

  if ((parsed as { needs_clarification: boolean }).needs_clarification) {
    const qs = (parsed as { questions?: string[] }).questions ?? [];
    return { needsClarification: true, questions: qs.slice(0, 3) };
  }

  return {
    needsClarification: false,
    spec: (parsed as { spec: VideoSpec }).spec,
  };
}

export function decomposeTask(_spec: VideoSpec): PlannedAgent[] {
  // For the hackathon scope, the pipeline is fixed: script -> voice -> visual.
  const order = ["script-agent", "voice-agent", "visual-agent"];
  const plan: PlannedAgent[] = [];
  for (const id of order) {
    const a = getAgent(id);
    if (!a) continue;
    plan.push({ id: a.id, name: a.name ?? a.id, fee_sats: a.fee_sats });
  }
  // Fall back to all agents if the canonical three are missing.
  if (plan.length === 0) {
    for (const a of getAgents()) {
      plan.push({ id: a.id, name: a.name ?? a.id, fee_sats: a.fee_sats });
    }
  }
  return plan;
}

export function priceJob(plan: PlannedAgent[]): { subtotal: number; margin: number; total: number } {
  const subtotal = plan.reduce((sum, p) => sum + p.fee_sats, 0);
  const margin = Math.ceil(subtotal * MAESTRO_MARGIN_PCT);
  return { subtotal, margin, total: subtotal + margin };
}

export function newJobId(): string {
  return "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function callAgentEndpoint(agent: Agent, spec: VideoSpec, priorOutputs: Record<string, unknown>): Promise<unknown> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(agent.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec, priorOutputs }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`agent ${agent.id} returned ${res.status}`);
    return await res.json();
  } catch (err) {
    // Hackathon stub: if the sub-agent isn't running, return a placeholder
    // so the pipeline can still be demoed end-to-end.
    return {
      stub: true,
      agent: agent.id,
      specialty: agent.specialty,
      note: `sub-agent unreachable, returning stub output (${(err as Error).message})`,
    };
  }
}

export async function* executeJob(jobId: string): AsyncGenerator<ProgressEvent> {
  const job = jobs.get(jobId);
  if (!job) {
    yield { step: "error", message: `unknown job ${jobId}` };
    return;
  }

  job.status = "running";
  saveJob(job);

  for (const planned of job.plan) {
    const agent = getAgent(planned.id);
    if (!agent) {
      yield { step: "error", agent: planned.id, message: "agent not found in registry" };
      job.status = "error";
      job.error = `agent ${planned.id} not found`;
      saveJob(job);
      return;
    }

    yield { step: "hiring", agent: agent.id };

    const payment = await payInvoice(agent.id, agent.fee_sats);
    yield { step: "working", agent: agent.id, paymentSent: payment.amount_sats };

    const output = await callAgentEndpoint(agent, job.spec, job.results);
    job.results[agent.id] = output;
    saveJob(job);

    yield { step: "working", agent: agent.id, output };
  }

  job.status = "complete";
  saveJob(job);

  yield { step: "complete", finalOutput: job.results };
}
