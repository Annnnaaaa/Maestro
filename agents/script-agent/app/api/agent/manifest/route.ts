import { corsPreflight, withCors } from "@/lib/cors";
import type { AgentManifest } from "@/lib/manifest-schema";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  const manifest: AgentManifest = {
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
    optional_inputs: {},
    context_gathering: { supported: false, sources: [] },
    outputs: {
      script: { type: "string", description: "Spoken script, max 50 words" },
    },
    pricing: { base_sats: 15 },
    typical_completion_seconds: 5,
  };

  return withCors(manifest);
}

