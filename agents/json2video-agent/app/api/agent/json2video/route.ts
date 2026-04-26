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

function baseUrl(): string {
  return "https://api.json2video.com/v2";
}

function buildMovieJson(inputs: Inputs): Record<string, unknown> {
  const product = inputs.product_name ?? "your product";
  const desc = inputs.product_description ?? "";
  const audience = inputs.target_audience ?? "customers";
  const ctx = inputs.visual_context ?? "";
  const style = inputs.style ?? "playful";
  const tone = inputs.voiceover_tone ?? "warm";

  const hook = `${product}: ${desc}`.slice(0, 140);
  const line2 = `Made for ${audience}. ${ctx}`.slice(0, 160);
  const line3 = `Style: ${style}. Tone: ${tone}.`.slice(0, 120);

  const total = typeof inputs.duration_seconds === "number" && inputs.duration_seconds > 1
    ? inputs.duration_seconds
    : 15;
  const perScene = Math.max(2, total / 3);

  // Minimal JSON2Video payload. If your account supports richer elements
  // (AI voice, images, templates), you can expand this later.
  return {
    scenes: [
      { duration: perScene, elements: [{ type: "text", text: hook, duration: -2 }] },
      { duration: perScene, elements: [{ type: "text", text: line2, duration: -2 }] },
      { duration: perScene, elements: [{ type: "text", text: line3, duration: -2 }] },
    ],
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  let body: { inputs?: Inputs } | Inputs;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors({ error: "Invalid JSON" }, { status: 400 });
  }

  const inputs: Inputs = (body as any).inputs ?? (body as any) ?? {};
  // Hackathon-friendly: allow missing payment_hash and treat as stub payment.
  // In production, require a real payment hash and enforce verification.
  const payment_hash = inputs.payment_hash?.trim() || "stub_missing_payment_hash";

  const ok = await verifyPaymentHash(payment_hash);
  if (!ok) return withCors({ error: "payment verification failed" }, { status: 402 });

  const apiKey = process.env.JSON2VIDEO_API_KEY?.trim();
  if (!apiKey) {
    return withCors(
      {
        video_url: "http://localhost:3004/demo-video.mp4",
        project: "stub_no_api_key",
        agent_id: "json2video-agent-v1",
        payment_hash,
        warning: "JSON2VIDEO_API_KEY not configured; returning fallback demo URL",
      },
      { status: 200 }
    );
  }

  const payload = buildMovieJson(inputs);

  const createRes = await fetch(`${baseUrl()}/movies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    return withCors(
      { error: `json2video create failed: ${createRes.status}`, details: text },
      { status: 502 }
    );
  }

  const created = (await createRes.json()) as { success?: boolean; project?: string };
  const project = created.project;
  if (!project) {
    return withCors({ error: "json2video create missing project id", created }, { status: 502 });
  }

  // Poll until done. Keep it hackathon-fast; production should use webhook.
  const timeoutMs = Number(process.env.JSON2VIDEO_POLL_MAX_MS ?? 90_000);
  const pollMs = Number(process.env.JSON2VIDEO_POLL_MS ?? 2_000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await sleep(pollMs);
    const statusRes = await fetch(`${baseUrl()}/movies?project=${encodeURIComponent(project)}`, {
      headers: { "x-api-key": apiKey },
    });
    if (!statusRes.ok) continue;
    const status = (await statusRes.json()) as {
      success?: boolean;
      movie?: { status?: string; url?: string; message?: string };
    };
    const st = status.movie?.status;
    if (st === "done" && status.movie?.url) {
      return withCors({
        video_url: status.movie.url,
        project,
        agent_id: "json2video-agent-v1",
        payment_hash,
      });
    }
    if (st === "error") {
      return withCors(
        { error: "json2video render error", project, message: status.movie?.message ?? "" },
        { status: 502 }
      );
    }
  }

  return withCors(
    { error: "json2video render timeout", project, agent_id: "json2video-agent-v1", payment_hash },
    { status: 504 }
  );
}

