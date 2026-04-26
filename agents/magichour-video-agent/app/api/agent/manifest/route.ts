import { corsPreflight, withCors } from "@/lib/cors";
import type { AgentManifest } from "@/lib/manifest-schema";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  const manifest: AgentManifest = {
    agent_id: "magichour-video-agent",
    agent_type: "specialist",
    capability: "product_video_generation",
    capability_tags: ["product_video_generation", "video", "magichour", "text-to-video", "product"],
    description: "Generates a complete product video using the Magic Hour Text-to-Video API.",
    required_inputs: {
      product_name: { type: "string", description: "Product name" },
      product_description: { type: "string", description: "Short description of what the product does" },
    },
    optional_inputs: {
      target_audience: { type: "string", description: "Who this is for" },
      visual_context: { type: "string", description: "Aesthetic / brand cues" },
      style: { type: "string", description: "cinematic | playful | minimal" },
      duration_seconds: { type: "number", description: "Target duration (seconds)" },
      voiceover_tone: { type: "string", description: "Voice tone (warm, energetic, etc.)" },
      script: { type: "string", description: "Optional spoken script to guide pacing and copy" },
    },
    context_gathering: { supported: false, sources: [] },
    outputs: {
      video_url: { type: "string", description: "URL to the rendered MP4 (time-limited)" },
      project_id: { type: "string", description: "Magic Hour video project id (debug)" },
      status: { type: "string", description: "Final status (debug)" },
    },
    pricing: { base_sats: 1 },
    typical_completion_seconds: 35,
  };

  return withCors(manifest);
}

