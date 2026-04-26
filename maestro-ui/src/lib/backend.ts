import type { Agent } from "./types";

type AgentManifest = {
  agent_id: string;
  agent_type: "specialist" | "orchestrator";
  capability: string;
  capability_tags: string[];
  description: string;
  pricing: { base_sats: number };
};

export type MaestroJobResponse =
  | { status: "no_capability_match"; reason: string }
  | {
      status: "missing_inputs";
      missing_inputs: string[];
      for_agent: string;
      plan: unknown;
      pricing?: unknown;
    }
  | {
      status: "ready";
      jobId: string;
      plan: unknown;
      pricing: { subtotal: number; margin: number; total: number };
      invoice: { invoice: string; payment_hash: string };
    };

export type ProgressEvent =
  | { step: "planning"; plan?: unknown }
  | { step: "hiring"; agent?: string; capability?: string }
  | { step: "working"; agent?: string; capability?: string; paymentSent?: number; output?: unknown }
  | { step: "complete"; finalOutput?: unknown }
  | { step: "error"; message?: string; agent?: string };

export function backendBase(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_BACKEND_URL ?? "http://localhost:3000";
}

function avatarFor(agentId: string, capability: string): string {
  const id = agentId.toLowerCase();
  const cap = capability.toLowerCase();
  if (id.includes("maestro")) return "🪄";
  if (id.includes("json2video") || cap.includes("json2video")) return "🎞️";
  if (cap.includes("script")) return "📝";
  if (cap.includes("voice")) return "🎙️";
  if (cap.includes("visual") || cap.includes("video")) return "🎬";
  return "🤖";
}

export function toUiAgent(m: AgentManifest): Agent {
  return {
    id: m.agent_id,
    name: m.agent_id,
    agent_type: m.agent_type === "orchestrator" ? "ORCHESTRATOR" : "SPECIALIST",
    capability: m.capability,
    capability_tags: m.capability_tags,
    specialty: m.description,
    fee: m.pricing?.base_sats ?? 0,
    balance: 0,
    status: "idle",
    avatar: avatarFor(m.agent_id, m.capability),
    color: m.agent_type === "orchestrator" ? "lightning" : "electric",
    pubkey: "03…",
  };
}

export async function fetchMarketplace(): Promise<Agent[]> {
  const res = await fetch(`${backendBase()}/api/marketplace`, { method: "GET" });
  if (!res.ok) throw new Error(`marketplace: ${res.status}`);
  const data = (await res.json()) as { agents?: AgentManifest[] };
  return (data.agents ?? []).map(toUiAgent);
}

export async function fetchMaestro(): Promise<Agent> {
  const res = await fetch(`${backendBase()}/api/agent/manifest`, { method: "GET" });
  if (!res.ok) throw new Error(`maestro manifest: ${res.status}`);
  const data = (await res.json()) as AgentManifest;
  return toUiAgent(data);
}

export async function submitJob(
  request: string,
  inputs: Record<string, unknown>,
): Promise<MaestroJobResponse> {
  const res = await fetch(`${backendBase()}/api/maestro/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, inputs }),
  });
  return (await res.json()) as MaestroJobResponse;
}

export async function markJobPaid(jobId: string): Promise<unknown> {
  const res = await fetch(
    `${backendBase()}/api/maestro/job/${encodeURIComponent(jobId)}/mark-paid`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`mark-paid: ${res.status}`);
  return await res.json();
}

export async function streamExecute(
  jobId: string,
  onEvent: (e: ProgressEvent) => void,
): Promise<void> {
  const res = await fetch(`${backendBase()}/api/maestro/job/${encodeURIComponent(jobId)}/execute`, {
    method: "POST",
  });
  if (!res.ok || !res.body) throw new Error(`execute: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const raw = line.slice("data: ".length);
      try {
        onEvent(JSON.parse(raw));
      } catch {
        // ignore malformed event
      }
    }
  }
}
