import { corsPreflight, withCors } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors({
    id: "voice-agent",
    fee_sats: 25,
    specialty: "OpenAI TTS (tts-1, nova/onyx) for short voiceovers",
    status: "available",
  });
}
