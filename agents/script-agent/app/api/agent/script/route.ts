import Anthropic from "@anthropic-ai/sdk";
import { corsPreflight, withCors } from "@/lib/cors";
import { verifyPaymentHash } from "@/lib/verify";

export async function OPTIONS() {
  return corsPreflight();
}

const SYSTEM =
  "You are a video script writer specialized in short-form product videos. Output only the spoken script, no scene directions.";

type Spec = {
  product_name: string;
  product_description: string;
  duration_seconds: number;
  voiceover_tone: string;
};

export async function POST(req: Request) {
  let body: { payment_hash?: string; spec?: Spec };
  try {
    body = (await req.json()) as { payment_hash?: string; spec?: Spec };
  } catch {
    return withCors({ error: "Invalid JSON" }, { status: 400 });
  }

  const payment_hash = body.payment_hash?.trim();
  const spec = body.spec;
  if (!payment_hash || !spec?.product_name) {
    return withCors({ error: "payment_hash and spec.product_name required" }, { status: 400 });
  }

  const ok = await verifyPaymentHash(payment_hash);
  if (!ok) {
    return withCors({ error: "payment verification failed" }, { status: 402 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return withCors({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: key });
  const userPrompt = `Write a spoken script for a ${spec.duration_seconds ?? 15}-second short-form product video.
Product: ${spec.product_name}
Description: ${spec.product_description || "N/A"}
Voiceover tone: ${spec.voiceover_tone || "conversational"}
Rules: maximum 50 words. Conversational tone matching the spec. Spoken words only — no scene directions, labels, or stage notes.`;

  const msg = await client.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 256,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  const script =
    textBlock && textBlock.type === "text"
      ? textBlock.text.trim()
      : "";

  return withCors({
    script,
    agent_id: "script-agent",
    payment_hash,
  });
}
