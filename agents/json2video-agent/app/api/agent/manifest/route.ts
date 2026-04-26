import { corsPreflight, withCors } from "@/lib/cors";
import type { AgentManifest } from "@/lib/manifest-schema";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  const manifest: AgentManifest = {
    // IMPORTANT: must match marketplace placeholder id so Maestro can pay/hire it consistently.
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
    description: "Generates a complete product video using the JSON2Video API (single-call pipeline).",
    required_inputs: {
      product_name: { type: "string", description: "Product name" },
      product_description: { type: "string", description: "Short description of what the product does" },
      target_audience: { type: "string", description: "Who this is for" },
      visual_context: { type: "string", description: "Aesthetic / brand cues" },
    },
    optional_inputs: {
      style: { type: "string", description: "cinematic | playful | minimal" },
      duration_seconds: { type: "number", description: "Target duration (seconds)" },
      voiceover_tone: { type: "string", description: "Voice tone (warm, energetic, etc.)" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      video_url: { type: "string", description: "URL to the rendered MP4" },
      project: { type: "string", description: "JSON2Video project id (debug)" },
    },
    pricing: { base_sats: 13 },
    typical_completion_seconds: 45,
  };

  return withCors(manifest);
}

