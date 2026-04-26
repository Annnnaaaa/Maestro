import { kv } from "@vercel/kv";
import type { AgentManifest } from "./manifest-schema";
import type { ExecutionPlan } from "./planner";

export type Job = {
  job_id: string;
  caller_type: "agent" | "human";
  caller_id?: string;
  request: string;
  inputs: Record<string, unknown>;
  plan?: ExecutionPlan;
  status: "intake" | "awaiting_payment" | "executing" | "complete" | "failed";
  steps_completed: Array<{
    step_id: string;
    agent_id: string;
    output: unknown;
    payment_hash: string;
    completed_at: number;
  }>;
  invoice?: string;
  payment_hash_received?: string;
  final_output?: { video_url?: string; [key: string]: unknown };
  total_paid_sats: number;
  created_at: number;
  updated_at: number;
};

export type ActivityEvent = {
  id: string;
  type: "payment" | "hire" | "job_started" | "job_completed" | "agent_added";
  from_agent_id?: string;
  to_agent_id?: string;
  amount_sats?: number;
  payment_hash?: string;
  job_id?: string;
  message: string;
  timestamp: number;
};

const k = {
  agent: (id: string) => `agents:${id}`,
  agentsIndex: "agents:_index",
  job: (id: string) => `jobs:${id}`,
  jobsRecent: "jobs:_recent",
  ledger: "ledger:_all",
  activity: (id: string) => `activity:${id}`,
  activityRecent: "activity:_recent",
};

const RECENT_JOBS_CAP = 50;
const RECENT_ACTIVITY_CAP = 100;

// ----- Agents -----

export async function saveAgent(manifest: AgentManifest): Promise<void> {
  await kv.set(k.agent(manifest.agent_id), manifest);
  await kv.lrem(k.agentsIndex, 0, manifest.agent_id);
  await kv.lpush(k.agentsIndex, manifest.agent_id);
}

export async function getAgent(agentId: string): Promise<AgentManifest | null> {
  return (await kv.get<AgentManifest>(k.agent(agentId))) ?? null;
}

export async function getAllAgents(): Promise<AgentManifest[]> {
  const ids = (await kv.lrange<string>(k.agentsIndex, 0, -1)) ?? [];
  if (!ids.length) return [];
  const rows = await kv.mget<(AgentManifest | null)[]>(...ids.map(k.agent));
  return rows.filter((r): r is AgentManifest => !!r);
}

export async function getAgentsByCapability(capability: string): Promise<AgentManifest[]> {
  const all = await getAllAgents();
  return all.filter(
    (a) => a.capability === capability || a.capability_tags.includes(capability)
  );
}

export async function deleteAgent(agentId: string): Promise<void> {
  await kv.del(k.agent(agentId));
  await kv.lrem(k.agentsIndex, 0, agentId);
}

// ----- Jobs -----

export async function saveJob(job: Job): Promise<void> {
  job.updated_at = Date.now();
  await kv.set(k.job(job.job_id), job);
  await kv.lrem(k.jobsRecent, 0, job.job_id);
  await kv.lpush(k.jobsRecent, job.job_id);
  await kv.ltrim(k.jobsRecent, 0, RECENT_JOBS_CAP - 1);
}

export async function getJob(jobId: string): Promise<Job | null> {
  return (await kv.get<Job>(k.job(jobId))) ?? null;
}

export async function getRecentJobs(limit = 20): Promise<Job[]> {
  const ids = (await kv.lrange<string>(k.jobsRecent, 0, limit - 1)) ?? [];
  if (!ids.length) return [];
  const rows = await kv.mget<(Job | null)[]>(...ids.map(k.job));
  return rows.filter((r): r is Job => !!r);
}

export async function updateJob(jobId: string, patch: Partial<Job>): Promise<Job> {
  const existing = await getJob(jobId);
  if (!existing) throw new Error(`updateJob: job ${jobId} not found`);
  const merged: Job = { ...existing, ...patch, updated_at: Date.now() };
  await saveJob(merged);
  return merged;
}

// ----- Ledger (single-key map; trivial races acceptable for hackathon) -----

type Balances = Record<string, number>;

export async function getAllBalances(): Promise<Balances> {
  return (await kv.get<Balances>(k.ledger)) ?? {};
}

export async function getBalance(agentId: string): Promise<number> {
  const all = await getAllBalances();
  return all[agentId] ?? 0;
}

export async function setBalance(agentId: string, sats: number): Promise<void> {
  const all = await getAllBalances();
  all[agentId] = sats;
  await kv.set(k.ledger, all);
}

export async function adjustBalance(agentId: string, delta: number): Promise<number> {
  const all = await getAllBalances();
  all[agentId] = (all[agentId] ?? 0) + delta;
  await kv.set(k.ledger, all);
  return all[agentId];
}

// ----- Activity log -----

export function newActivityId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function logActivity(event: ActivityEvent): Promise<void> {
  await kv.set(k.activity(event.id), event);
  await kv.lpush(k.activityRecent, event.id);
  await kv.ltrim(k.activityRecent, 0, RECENT_ACTIVITY_CAP - 1);
}

export async function getRecentActivity(limit = 50): Promise<ActivityEvent[]> {
  const ids = (await kv.lrange<string>(k.activityRecent, 0, limit - 1)) ?? [];
  if (!ids.length) return [];
  const rows = await kv.mget<(ActivityEvent | null)[]>(...ids.map(k.activity));
  return rows
    .filter((r): r is ActivityEvent => !!r)
    .sort((a, b) => b.timestamp - a.timestamp);
}
