import { corsPreflight, withCors } from "@/lib/cors";
import { verifyPaymentHash } from "@/lib/verify";

export async function OPTIONS() {
  return corsPreflight();
}

type Inputs = {
  payment_hash?: string;
  product_name?: string;
  product_description?: string;
  target_audience?: string;
  visual_context?: string;
  style?: string;
  duration_seconds?: number;
  voiceover_tone?: string;
  task_description?: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildPrompt(inputs: Inputs): string {
  const name = inputs.product_name?.trim() || "the product";
  const desc = inputs.product_description?.trim() || "";
  const audience = inputs.target_audience?.trim() || "customers";
  const ctx = inputs.visual_context?.trim() || "";
  const style = inputs.style?.trim() || "cinematic";
  const tone = inputs.voiceover_tone?.trim() || "confident";

  // Keep this prompt compact; Magic Hour max is 2000 chars.
  return [
    `Create a short product promo video for ${name}.`,
    desc ? `Product: ${desc}` : "",
    `Target audience: ${audience}.`,
    ctx ? `Brand / visual context: ${ctx}` : "",
    `Style: ${style}. Tone: ${tone}.`,
    "Cinematic camera moves, crisp lighting, clean typography, no watermarks, no logos unless provided.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function createTextToVideoJob(apiKey: string, inputs: Inputs): Promise<{ id: string }> {
  const endSecondsRaw =
    typeof inputs.duration_seconds === "number" && Number.isFinite(inputs.duration_seconds)
      ? inputs.duration_seconds
      : 6;
  const end_seconds = clamp(endSecondsRaw, 1.5, 15);

  const body = {
    name: `Maestro: ${inputs.product_name ?? "Product"} (${new Date().toISOString()})`.slice(0, 120),
    end_seconds,
    aspect_ratio: "16:9",
    resolution: "720p",
    // Keep model default server-side unless you want to pin it via env later.
    // model: "kling-3.0",
    audio: false,
    style: { prompt: buildPrompt(inputs) },
  };

  const res = await fetch("https://api.magichour.ai/v1/text-to-video", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`magichour create failed: ${res.status}${text ? `: ${text}` : ""}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data?.id) throw new Error("magichour create missing id");
  return { id: data.id };
}

type VideoDetails = {
  id: string;
  status: "draft" | "queued" | "rendering" | "complete" | "error" | "canceled" | string;
  downloads?: { url: string; expires_at: string }[];
  error?: { message?: string; code?: string } | null;
};

async function getVideoDetails(apiKey: string, id: string): Promise<VideoDetails> {
  const res = await fetch(`https://api.magichour.ai/v1/video-projects/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`magichour status failed: ${res.status}${text ? `: ${text}` : ""}`);
  }
  return (await res.json()) as VideoDetails;
}

export async function POST(req: Request) {
  let body: { inputs?: Inputs } | Inputs;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors({ error: "Invalid JSON" }, { status: 400 });
  }

  const inputs: Inputs = (body as any).inputs ?? (body as any) ?? {};
  const payment_hash = inputs.payment_hash?.trim() || "stub_missing_payment_hash";

  const ok = await verifyPaymentHash(payment_hash);
  if (!ok) return withCors({ error: "payment verification failed" }, { status: 402 });

  const apiKey = process.env.MAGIC_HOUR_API_KEY?.trim();
  if (!apiKey) {
    return withCors(
      {
        video_url: "http://localhost:3005/demo-video.mp4",
        project_id: "stub_no_api_key",
        status: "complete",
        agent_id: "magichour-video-agent-v1",
        payment_hash,
        warning: "MAGIC_HOUR_API_KEY not configured; returning fallback demo URL",
      },
      { status: 200 }
    );
  }

  try {
    const { id } = await createTextToVideoJob(apiKey, inputs);

    const timeoutMs = Number(process.env.MAGIC_HOUR_POLL_MAX_MS ?? 120_000);
    const pollMs = Number(process.env.MAGIC_HOUR_POLL_MS ?? 2_500);
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      await sleep(pollMs);
      const details = await getVideoDetails(apiKey, id);
      if (details.status === "complete") {
        const url = details.downloads?.[0]?.url;
        if (!url) {
          return withCors(
            {
              error: "magichour completed but downloads missing",
              project_id: id,
              status: details.status,
              agent_id: "magichour-video-agent-v1",
              payment_hash,
            },
            { status: 502 }
          );
        }
        return withCors({
          video_url: url,
          project_id: id,
          status: details.status,
          agent_id: "magichour-video-agent-v1",
          payment_hash,
        });
      }
      if (details.status === "error" || details.status === "canceled") {
        return withCors(
          {
            error: `magichour render ${details.status}`,
            project_id: id,
            status: details.status,
            details: details.error ?? null,
          },
          { status: 502 }
        );
      }
    }

    return withCors(
      {
        error: "magichour render timeout",
        project_id: id,
        status: "timeout",
        agent_id: "magichour-video-agent-v1",
        payment_hash,
      },
      { status: 504 }
    );
  } catch (err) {
    return withCors(
      { error: (err as Error).message, agent_id: "magichour-video-agent-v1", payment_hash },
      { status: 502 }
    );
  }
}

