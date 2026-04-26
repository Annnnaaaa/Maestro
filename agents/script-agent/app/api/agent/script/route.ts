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
  voiceover_tone: string;
  target_audience?: string;
  duration_seconds?: number;
};

export async function POST(req: Request) {
  let body:
    | { payment_hash?: string; spec?: Spec }
    | {
        payment_hash?: string;
        product_name?: string;
        product_description?: string;
        target_audience?: string;
        voiceover_tone?: string;
        duration_seconds?: number;
      };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors({ error: "Invalid JSON" }, { status: 400 });
  }

  const payment_hash = (body as any).payment_hash?.trim() as string | undefined;
  const spec: Spec | undefined =
    (body as any).spec ??
    (payment_hash
      ? ({
          product_name: (body as any).product_name,
          product_description: (body as any).product_description,
          target_audience: (body as any).target_audience,
          voiceover_tone: (body as any).voiceover_tone,
          duration_seconds: (body as any).duration_seconds,
        } as Spec)
      : undefined);

  if (!payment_hash) {
    return withCors({ error: "payment_hash required" }, { status: 400 });
  }
  if (!spec?.product_name || !spec.product_description || !spec.voiceover_tone || !spec.target_audience) {
    return withCors(
      {
        error:
          "Missing required inputs: product_name, product_description, target_audience, voiceover_tone",
      },
      { status: 400 }
    );
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
Target audience: ${spec.target_audience || "general"}
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
    agent_id: "script-agent-v1",
    payment_hash,
  });
}
