// Unified manifest schema. Every agent in the system - including Maestro -
// describes itself with this exact shape. The marketplace stores manifests
// directly; the planner reads `capability` / `capability_tags` to match
// steps to agents.

export type InputSpec = {
  type: string;
  description: string;
  default?: unknown;
  schema?: unknown;
};

export type OutputSpec = {
  type: string;
  description: string;
};

export type AgentManifest = {
  agent_id: string;
  agent_type: "specialist" | "orchestrator";
  capability: string; // e.g. "video_script_writing"
  capability_tags: string[];
  description: string;
  required_inputs: Record<string, InputSpec>;
  optional_inputs: Record<string, InputSpec>;
  context_gathering: { supported: boolean; sources: string[] };
  outputs: Record<string, OutputSpec>;
  pricing: { base_sats: number; breakdown?: Record<string, number> };
  typical_completion_seconds: number;
  // Orchestrator-only:
  hires_agents_with_capabilities?: string[];
  marketplace_url?: string;
  // Optional pointer used by the marketplace to call the agent. Not part of
  // the published manifest but stored alongside it for convenience.
  endpoint?: string;
};

export function isManifest(value: unknown): value is AgentManifest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.agent_id === "string" &&
    (v.agent_type === "specialist" || v.agent_type === "orchestrator") &&
    typeof v.capability === "string" &&
    Array.isArray(v.capability_tags) &&
    typeof v.description === "string" &&
    typeof v.required_inputs === "object" &&
    typeof v.optional_inputs === "object" &&
    typeof v.context_gathering === "object" &&
    typeof v.outputs === "object" &&
    typeof v.pricing === "object" &&
    typeof v.typical_completion_seconds === "number"
  );
}

