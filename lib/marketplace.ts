import { AgentManifest, isManifest } from "./manifest-schema";

// Placeholder manifests used until each sub-agent's real /api/agent/manifest
// is reachable. Once the sub-agents are running, marketplace seed code below
// fetches and overwrites these.
const PLACEHOLDER_MANIFESTS: AgentManifest[] = [
  {
    agent_id: "magichour-video-agent",
    agent_type: "specialist",
    capability: "product_video_generation",
    capability_tags: ["video", "magichour", "text-to-video", "render", "product"],
    description: "Generates a complete product video using the Magic Hour Text-to-Video API.",
    required_inputs: {
      product_name: { type: "string", description: "Product name" },
      product_description: { type: "string", description: "What the product does" },
      target_audience: { type: "string", description: "Who this is for" },
      visual_context: { type: "string", description: "Aesthetic / brand cues" },
    },
    optional_inputs: {
      style: { type: "string", description: "cinematic | playful | minimal" },
      duration_seconds: { type: "number", description: "Target duration" },
      voiceover_tone: { type: "string", description: "e.g. warm, energetic" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      video_url: { type: "string", description: "URL to the rendered video" },
      project_id: { type: "string", description: "Magic Hour video project id (debug)" },
      status: { type: "string", description: "Final Magic Hour project status (debug)" },
    },
    pricing: { base_sats: 1 },
    typical_completion_seconds: 35,
    endpoint: "http://localhost:3005/api/agent/magichour",
  },
  {
    agent_id: "json2video-agent",
    agent_type: "specialist",
    capability: "product_video_generation_json2video",
    capability_tags: [
      "product_video_generation",
      "video",
      "json2video",
      "render",
      "product",
    ],
    description: "Generates a complete product video directly using the JSON2Video API.",
    required_inputs: {
      product_name: { type: "string", description: "Product name" },
      product_description: { type: "string", description: "What the product does" },
      target_audience: { type: "string", description: "Who this is for" },
      visual_context: { type: "string", description: "Aesthetic / brand cues" },
    },
    optional_inputs: {
      style: { type: "string", description: "cinematic | playful | minimal" },
      duration_seconds: { type: "number", description: "Target duration" },
      voiceover_tone: { type: "string", description: "e.g. warm, energetic" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      video_url: { type: "string", description: "URL to the rendered video" },
      project: { type: "string", description: "JSON2Video project id (debug)" },
    },
    pricing: { base_sats: 13 },
    typical_completion_seconds: 45,
    endpoint: "http://localhost:3004/api/agent/json2video",
  },
  {
    agent_id: "script-agent",
    agent_type: "specialist",
    capability: "video_script_writing",
    capability_tags: ["script", "copywriting", "narrative"],
    description: "Writes video scripts from a product brief.",
    required_inputs: {
      product_name: { type: "string", description: "Product name" },
      product_description: { type: "string", description: "What the product does" },
    },
    optional_inputs: {
      target_audience: { type: "string", description: "Who the video is for" },
      duration_seconds: { type: "number", description: "Target duration" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      script: { type: "string", description: "Final spoken script" },
      scenes: { type: "array", description: "Scene-by-scene breakdown" },
    },
    pricing: { base_sats: 15 },
    typical_completion_seconds: 6,
    endpoint: "http://localhost:3001/api/agent/script",
  },
  {
    agent_id: "voice-agent",
    agent_type: "specialist",
    capability: "voiceover_generation",
    capability_tags: ["voice", "tts", "audio"],
    description: "Generates a voiceover audio track from a script.",
    required_inputs: {
      script: { type: "string", description: "Script to read aloud" },
    },
    optional_inputs: {
      voiceover_tone: { type: "string", description: "e.g. warm, energetic" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      audio_url: { type: "string", description: "URL to the generated audio" },
    },
    pricing: { base_sats: 8 },
    typical_completion_seconds: 5,
    endpoint: "http://localhost:3002/api/agent/voice",
  },
  {
    agent_id: "visual-agent",
    agent_type: "specialist",
    capability: "video_visual_generation",
    capability_tags: ["visual", "video", "render"],
    description: "Renders the visual track of a product video.",
    required_inputs: {
      scenes: { type: "array", description: "Scene breakdown to render" },
    },
    optional_inputs: {
      style: { type: "string", description: "cinematic | playful | minimal" },
      visual_context: { type: "string", description: "Aesthetic guidance / brand cues" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      video_url: { type: "string", description: "URL to the rendered video" },
    },
    pricing: { base_sats: 45 },
    typical_completion_seconds: 12,
    endpoint: "http://localhost:3003/api/agent/visual",
  },
];

const g = globalThis as typeof globalThis & {
  __maestro_marketplace?: Map<string, AgentManifest>;
  __maestro_marketplace_seeded?: boolean;
};

function store(): Map<string, AgentManifest> {
  if (!g.__maestro_marketplace) {
    g.__maestro_marketplace = new Map(
      PLACEHOLDER_MANIFESTS.map((m) => [m.agent_id, m])
    );
  }
  return g.__maestro_marketplace;
}

export function getAgents(): AgentManifest[] {
  return Array.from(store().values());
}

export function getAgent(agent_id: string): AgentManifest | undefined {
  return store().get(agent_id);
}

export function getAgentsByCapability(capability: string): AgentManifest[] {
  return getAgents().filter(
    (a) => a.capability === capability || a.capability_tags.includes(capability)
  );
}

export function addAgent(manifest: AgentManifest): AgentManifest {
  if (!isManifest(manifest)) {
    throw new Error("addAgent: invalid AgentManifest payload");
  }
  store().set(manifest.agent_id, manifest);
  return manifest;
}

// Tries to refresh each placeholder manifest from its endpoint's
// /api/agent/manifest route. Failures are silent - placeholders stay in
// place so the demo keeps working.
export async function seedFromEndpoints(): Promise<void> {
  if (g.__maestro_marketplace_seeded) return;
  g.__maestro_marketplace_seeded = true;

  const agents = getAgents();
  await Promise.all(
    agents.map(async (a) => {
      if (!a.endpoint) return;
      try {
        const url = new URL(a.endpoint);
        // /api/agent/<id> -> /api/agent/manifest on the same origin
        const manifestUrl = `${url.protocol}//${url.host}/api/agent/manifest`;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(manifestUrl, { signal: controller.signal });
        clearTimeout(t);
        if (!res.ok) return;
        const fetched = (await res.json()) as AgentManifest;
        if (isManifest(fetched)) {
          fetched.endpoint = a.endpoint;
          store().set(fetched.agent_id, fetched);
        }
      } catch {
        // ignore - placeholder remains
      }
    })
  );
}

export function logStartupSummary(): void {
  const agents = getAgents();
  const caps = agents.map((a) => a.capability);
  console.log(
    `Maestro started. Marketplace has ${agents.length} agents with capabilities: [${caps.join(", ")}]`
  );
}
