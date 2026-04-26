import { AgentManifest, isManifest } from "./manifest-schema";

// Placeholder manifests used until each sub-agent's real /api/agent/manifest
// is reachable. Once the sub-agents are running, marketplace seed code below
// fetches and overwrites these.
const PLACEHOLDER_MANIFESTS: AgentManifest[] = [
  {
    agent_id: "magichour-video-agent",
    agent_type: "specialist",
    capability: "product_video_generation",
    capability_tags: ["product_video_generation", "video", "magichour", "text-to-video", "product"],
    description: "Generates a complete product video using the Magic Hour Text-to-Video API.",
    required_inputs: {
      product_name: { type: "string", description: "Product name" },
      product_description: { type: "string", description: "What the product does" },
    },
    optional_inputs: {
      target_audience: { type: "string", description: "Who this is for" },
      visual_context: { type: "string", description: "Aesthetic / brand cues" },
      style: { type: "string", description: "cinematic | playful | minimal" },
      duration_seconds: { type: "number", description: "Target duration" },
      voiceover_tone: { type: "string", description: "e.g. warm, energetic" },
      script: { type: "string", description: "Optional spoken script to guide the video" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      video_url: { type: "string", description: "URL to the rendered video" },
      project_id: { type: "string", description: "Magic Hour project id (debug)" },
      status: { type: "string", description: "Final Magic Hour status (debug)" },
    },
    pricing: { base_sats: 1 },
    typical_completion_seconds: 35,
    endpoint: "http://localhost:3005/api/agent/magichour",
  },
  {
    agent_id: "json2video-agent",
    agent_type: "specialist",
    capability: "product_video_generation_json2video",
    capability_tags: ["product_video_generation", "video", "json2video", "render", "product"],
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
    agent_id: "script-agent-v1",
    agent_type: "specialist",
    capability: "video_script_writing",
    capability_tags: ["text", "video", "marketing", "creative"],
    description: "Generates a 15-second spoken product video script (max 50 words).",
    required_inputs: {
      product_name: { type: "string", description: "Product name" },
      product_description: { type: "string", description: "Product description" },
      target_audience: { type: "string", description: "Who this is for" },
      voiceover_tone: { type: "string", description: "Tone of voiceover (e.g. warm, playful)" },
    },
    optional_inputs: {
      duration_seconds: { type: "number", description: "Target duration" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      script: { type: "string", description: "Spoken script, max 50 words" },
    },
    pricing: { base_sats: 15 },
    typical_completion_seconds: 5,
    endpoint: "http://localhost:3001/api/agent/script",
  },
  {
    agent_id: "voice-agent-v1",
    agent_type: "specialist",
    capability: "voiceover_generation",
    capability_tags: ["audio", "tts", "voice"],
    description: "Turns a script into a short MP3 voiceover using OpenAI TTS.",
    required_inputs: {
      script: { type: "string", description: "Script to read aloud" },
      voiceover_tone: { type: "string", description: "Tone (warm/playful or cinematic)" },
    },
    optional_inputs: {},
    context_gathering: { supported: false, sources: [] },
    outputs: {
      audio_url: { type: "string", description: "URL to the generated audio" },
      duration_ms: { type: "number", description: "Duration in milliseconds" },
    },
    pricing: { base_sats: 8 },
    typical_completion_seconds: 4,
    endpoint: "http://localhost:3002/api/agent/voice",
  },
  {
    agent_id: "visual-agent-v1",
    agent_type: "specialist",
    capability: "video_visual_generation",
    capability_tags: ["video", "image", "visual", "assembly"],
    description:
      "Generates (or falls back to) a short slideshow-style video based on product spec, script, and audio.",
    required_inputs: {
      spec: { type: "object", description: "Product/video spec used for prompt generation" },
      script: { type: "string", description: "Spoken script" },
      audio_url: { type: "string", description: "Public URL to the voiceover MP3" },
    },
    optional_inputs: {},
    context_gathering: { supported: false, sources: [] },
    outputs: {
      video_url: { type: "string", description: "URL to the rendered video" },
    },
    pricing: { base_sats: 45 },
    typical_completion_seconds: 20,
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

export async function pickBestAgent(capability: string): Promise<AgentManifest | null> {
  const candidates = await getAgentsByCapability(capability);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // Sort by base price ascending, pick cheapest.
  candidates.sort((a, b) => a.pricing.base_sats - b.pricing.base_sats);
  return candidates[0];
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
          // Replace the placeholder entry keyed by `a.agent_id` (if present),
          // and store the fetched manifest under its real agent_id.
          store().delete(a.agent_id);
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
