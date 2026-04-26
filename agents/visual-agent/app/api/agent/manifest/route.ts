import { corsPreflight, withCors } from "@/lib/cors";
import type { AgentManifest } from "@/lib/manifest-schema";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  const manifest: AgentManifest = {
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
      video_url: { type: "string", description: "Public URL to the resulting MP4" },
    },
    pricing: { base_sats: 45 },
    typical_completion_seconds: 20,
  };

  return withCors(manifest);
}

