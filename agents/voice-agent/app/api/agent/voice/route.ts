import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { corsPreflight, withCors } from "@/lib/cors";
import { getMp3DurationMs } from "@/lib/audioDuration";
import { verifyPaymentHash } from "@/lib/verify";

export async function OPTIONS() {
  return corsPreflight();
}

function pickVoice(voiceover_tone: string | undefined): "nova" | "onyx" {
  const t = (voiceover_tone ?? "").toLowerCase();
  if (t.includes("cinematic") || t.includes("dramatic") || t.includes("movie")) {
    return "onyx";
  }
  return "nova";
}

function origin(req: Request): string {
  const host = req.headers.get("host") ?? "localhost:3002";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  let body: { payment_hash?: string; script?: string; voiceover_tone?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors({ error: "Invalid JSON" }, { status: 400 });
  }

  const payment_hash = body.payment_hash?.trim();
  const script = body.script?.trim();
  if (!payment_hash || !script) {
    return withCors({ error: "payment_hash and script required" }, { status: 400 });
  }

  const ok = await verifyPaymentHash(payment_hash);
  if (!ok) {
    return withCors({ error: "payment verification failed" }, { status: 402 });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return withCors({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: key });
  const voice = pickVoice(body.voiceover_tone);

  const speech = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: script,
  });

  const buf = Buffer.from(await speech.arrayBuffer());
  const ts = Date.now();
  const rel = path.join("public", "audio", `${ts}.mp3`);
  const abs = path.join(process.cwd(), rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);

  const duration_ms = getMp3DurationMs(abs);
  const audio_url = `${origin(req)}/audio/${ts}.mp3`;

  return withCors({
    audio_url,
    duration_ms,
    agent_id: "voice-agent",
    payment_hash,
  });
}
