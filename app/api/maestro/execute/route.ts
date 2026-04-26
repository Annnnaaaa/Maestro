import { NextRequest } from "next/server";
import { CORS_HEADERS, corsPreflight, withCors } from "@/lib/cors";
import { executeJob, getJob } from "@/lib/maestro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  let body: { jobId?: string };
  try {
    body = await req.json();
  } catch {
    return withCors({ error: "invalid JSON body" }, { status: 400 });
  }

  const jobId = body.jobId?.trim();
  if (!jobId) {
    return withCors({ error: "jobId is required" }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return withCors({ error: `unknown jobId: ${jobId}` }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of executeJob(jobId)) {
          send(event);
        }
      } catch (err) {
        send({ step: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
