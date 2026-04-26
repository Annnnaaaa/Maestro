import { corsPreflight, withCors } from "@/lib/cors";
import type { AgentManifest } from "@/lib/manifest-schema";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  const manifest: AgentManifest = {
    agent_id: "voice-agent-v1",
    agent_type: "specialist",
    capability: "voiceover_generation",
    capability_tags: ["audio", "tts", "voice"],
    description: "Turns a script into a short MP3 voiceover using OpenAI TTS.",
    required_inputs: {
      script: { type: "string", description: "Spoken script text" },
      voiceover_tone: { type: "string", description: "Tone (warm/playful or cinematic)" },
    },
    optional_inputs: {},
    context_gathering: { supported: false, sources: [] },
    outputs: {
      audio_url: { type: "string", description: "Public URL to the generated MP3" },
      duration_ms: { type: "number", description: "Estimated duration in milliseconds" },
    },
    pricing: { base_sats: 8 },
    typical_completion_seconds: 4,
  };

  return withCors(manifest);
}

