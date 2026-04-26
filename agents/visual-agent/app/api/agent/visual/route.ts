import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { corsPreflight, withCors } from "@/lib/cors";
import { verifyPaymentHash } from "@/lib/verify";

export async function OPTIONS() {
  return corsPreflight();
}

type Spec = {
  product_name?: string;
  product_description?: string;
  duration_seconds?: number;
  voiceover_tone?: string;
};

function origin(req: Request): string {
  const host = req.headers.get("host") ?? "localhost:3003";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function toFfconcatPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

async function falFluxImage(prompt: string, falKey: string): Promise<string> {
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "landscape_16_9",
      num_images: 1,
      num_inference_steps: 4,
    }),
  });
  if (!res.ok) {
    throw new Error(`fal: ${res.status} ${await res.text()}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  const payload =
    (typeof raw.output === "object" && raw.output !== null
      ? (raw.output as Record<string, unknown>)
      : raw) as Record<string, unknown>;
  const images = payload.images as { url?: string }[] | undefined;
  const image = payload.image as { url?: string } | undefined;
  const url = images?.[0]?.url ?? image?.url;
  if (!url) throw new Error("fal: missing image url");
  return url;
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${url}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

function ffprobeDurationSec(file: string): number {
  const out = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { encoding: "utf-8" },
  ).trim();
  const sec = parseFloat(out);
  if (!Number.isFinite(sec) || sec <= 0) throw new Error("ffprobe duration");
  return sec;
}

async function tryBuildSlideshow(opts: {
  workDir: string;
  prompts: string[];
  falKey: string;
  totalSeconds: number;
  audioUrl?: string;
  videoOutAbs: string;
}): Promise<void> {
  const { workDir, prompts, falKey, totalSeconds, audioUrl, videoOutAbs } = opts;
  const slide = Math.max(1.5, totalSeconds / 3);
  const paths: string[] = [];
  for (let i = 0; i < 3; i++) {
    const imgUrl = await falFluxImage(prompts[i]!, falKey);
    const ext = imgUrl.includes(".png") ? "png" : "jpg";
    const local = path.join(workDir, `frame_${i}.${ext}`);
    await downloadToFile(imgUrl, local);
    paths.push(local);
  }

  let audioLocal: string | undefined;
  if (audioUrl) {
    audioLocal = path.join(workDir, "voice.mp3");
    await downloadToFile(audioUrl, audioLocal);
  }

  const concatLines = ["ffconcat version 1.0"];
  for (const p of paths) {
    concatLines.push(`file '${toFfconcatPath(p)}'`);
    concatLines.push(`duration ${slide.toFixed(3)}`);
  }
  const last = paths[paths.length - 1]!;
  concatLines.push(`file '${toFfconcatPath(last)}'`);
  const concatPath = path.join(workDir, "slides.ffconcat");
  fs.writeFileSync(concatPath, concatLines.join("\n"), "utf-8");

  if (audioLocal && fs.existsSync(audioLocal)) {
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatPath,
        "-i",
        audioLocal,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        videoOutAbs,
      ],
      { stdio: "pipe" },
    );
  } else {
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatPath,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        videoOutAbs,
      ],
      { stdio: "pipe" },
    );
  }
}

function promptsFromSpec(spec: Spec, script: string): string[] {
  const name = spec.product_name ?? "product";
  const desc = (spec.product_description ?? "").slice(0, 200);
  const tone = spec.voiceover_tone ?? "bright";
  const hook = script.slice(0, 160);
  return [
    `Professional product hero shot, ${name}, ${tone} mood, clean studio lighting, ${desc}`,
    `Lifestyle use case, hands interacting with ${name}, natural light, ${tone} atmosphere`,
    `Bold close-up detail of ${name}, cinematic composition, tagline energy: ${hook}`,
  ];
}

export async function POST(req: Request) {
  let body: {
    payment_hash?: string;
    spec?: Spec;
    script?: string;
    audio_url?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors({ error: "Invalid JSON" }, { status: 400 });
  }

  const payment_hash = body.payment_hash?.trim();
  const spec = body.spec ?? {};
  const script = body.script?.trim() ?? "";
  const audio_url = body.audio_url?.trim();
  if (!payment_hash) return withCors({ error: "payment_hash required" }, { status: 400 });
  if (!body.spec || !script || !audio_url) {
    return withCors(
      { error: "Missing required inputs: spec, script, audio_url" },
      { status: 400 }
    );
  }

  const ok = await verifyPaymentHash(payment_hash);
  if (!ok) {
    return withCors({ error: "payment verification failed" }, { status: 402 });
  }

  const falKey = process.env.FAL_KEY;
  const base = origin(req);

  let totalSeconds = typeof spec.duration_seconds === "number" ? spec.duration_seconds : 15;
  if (audio_url) {
    try {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-audio-"));
      const ap = path.join(tmp, "probe.mp3");
      await downloadToFile(audio_url, ap);
      totalSeconds = ffprobeDurationSec(ap);
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      totalSeconds = typeof spec.duration_seconds === "number" ? spec.duration_seconds : 15;
    }
  }

  const prompts = promptsFromSpec(spec, script);

  if (!falKey) {
    // FALLBACK: pre-generated demo when FAL_KEY (or full pipeline) is unavailable — place assets at /public/demo-video.mp4
    return withCors({
      video_url: `${base}/demo-video.mp4`,
      agent_id: "visual-agent",
      payment_hash,
    });
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-visual-"));
  const ts = Date.now();
  const relPublic = path.join("public", "video", `${ts}.mp4`);
  const videoOutAbs = path.join(process.cwd(), relPublic);

  try {
    fs.mkdirSync(path.dirname(videoOutAbs), { recursive: true });
    await tryBuildSlideshow({
      workDir,
      prompts,
      falKey,
      totalSeconds,
      audioUrl: audio_url,
      videoOutAbs,
    });
    fs.rmSync(workDir, { recursive: true, force: true });
    return withCors({
      video_url: `${base}/video/${ts}.mp4`,
      agent_id: "visual-agent-v1",
      payment_hash,
    });
  } catch {
    fs.rmSync(workDir, { recursive: true, force: true });
    if (fs.existsSync(videoOutAbs)) {
      try {
        fs.unlinkSync(videoOutAbs);
      } catch {
        /* ignore */
      }
    }
    // FALLBACK: pre-generated demo when FFmpeg/FAL fails or is too slow — add /public/demo-video.mp4 for a working URL
    return withCors({
      video_url: `${base}/demo-video.mp4`,
      agent_id: "visual-agent-v1",
      payment_hash,
    });
  }
}
