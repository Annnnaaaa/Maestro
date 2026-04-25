export interface Agent {
  id: string;
  endpoint: string;
  fee_sats: number;
  specialty: string;
  name?: string;
}

const initialAgents: Agent[] = [
  {
    id: "script-agent",
    endpoint: "http://localhost:3001/api/agent/script",
    fee_sats: 15,
    specialty: "video script writing",
  },
  {
    id: "voice-agent",
    endpoint: "http://localhost:3002/api/agent/voice",
    fee_sats: 8,
    specialty: "voiceover generation",
  },
  {
    id: "visual-agent",
    endpoint: "http://localhost:3003/api/agent/visual",
    fee_sats: 45,
    specialty: "video visuals",
  },
];

// In-memory store. Persists across requests within a single Node process.
const g = globalThis as unknown as { __maestro_agents?: Map<string, Agent> };
if (!g.__maestro_agents) {
  g.__maestro_agents = new Map(initialAgents.map((a) => [a.id, a]));
}
const agents = g.__maestro_agents;

export function getAgents(): Agent[] {
  return Array.from(agents.values());
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

export function addAgent(spec: Partial<Agent> & { id: string; endpoint: string }): Agent {
  const agent: Agent = {
    id: spec.id,
    endpoint: spec.endpoint,
    fee_sats: typeof spec.fee_sats === "number" ? spec.fee_sats : 10,
    specialty: spec.specialty ?? "general",
    name: spec.name,
  };
  agents.set(agent.id, agent);
  return agent;
}
