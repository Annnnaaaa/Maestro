import { kv } from "@vercel/kv";
import { saveAgent, setBalance, getAllAgents } from "./storage";
import { isManifest, AgentManifest } from "./manifest-schema";
import { maestroManifest } from "./maestro";

const SUB_AGENT_BASE_URLS = [
  process.env.SCRIPT_AGENT_URL ?? "http://localhost:3001",
  process.env.VOICE_AGENT_URL ?? "http://localhost:3002",
  process.env.VISUAL_AGENT_URL ?? "http://localhost:3003",
];

const INITIAL_LEDGER: Record<string, number> = {
  maestro: 1000,
  consumer: 500,
};

let inFlight: Promise<void> | null = null;

async function fetchManifest(baseUrl: string): Promise<AgentManifest | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${baseUrl}/api/agent/manifest`, {
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = await res.json();
    if (!isManifest(json)) return null;
    return json as AgentManifest;
  } catch {
    return null;
  }
}

async function doSeed(): Promise<void> {
  // Idempotent: if the agents index already exists, only top up the ledger
  // for agents that joined after the last seed (don't overwrite balances).
  const indexExists = await kv.exists("agents:_index");

  if (!indexExists) {
    // Seed Maestro's own manifest first, so a future plan can find it.
    await saveAgent(maestroManifest());

    for (const baseUrl of SUB_AGENT_BASE_URLS) {
      const manifest = await fetchManifest(baseUrl);
      if (!manifest) continue;
      manifest.endpoint = manifest.endpoint ?? baseUrl;
      await saveAgent(manifest);
    }

    for (const [agentId, sats] of Object.entries(INITIAL_LEDGER)) {
      await setBalance(agentId, sats);
    }

    const agents = await getAllAgents();
    const caps = agents.map((a) => a.capability);
    console.log(
      `Maestro started. Marketplace has ${agents.length} agents with capabilities: [${caps.join(", ")}]`
    );
  }
}

export async function seedMarketplace(): Promise<void> {
  if (!inFlight) inFlight = doSeed();
  return inFlight;
}
