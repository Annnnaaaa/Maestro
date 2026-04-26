import { NextRequest } from "next/server";
import { CORS_HEADERS, corsPreflight, withCors } from "@/lib/cors";
import { executeJob, getJob, updateJob } from "@/lib/maestro";
import { verifyPayment } from "@/lib/lightning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

// POST /api/maestro/job/:jobId/execute
//
// Payment-gated execute endpoint. Verifies the consumer paid the invoice
// before running the pipeline. State machine:
//   intake -> awaiting_payment -> executing -> complete (or failed)
export async function POST(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const jobId = params.jobId?.trim();
  if (!jobId) {
    return withCors({ error: "jobId is required" }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return withCors({ error: `unknown jobId: ${jobId}` }, { status: 404 });
  }

  // Already done? Idempotent: don't re-run.
  if (job.status === "complete") {
    return withCors({ status: "complete", finalOutput: job.results });
  }
  if (job.status === "executing") {
    return withCors(
      { error: "job is already executing" },
      { status: 409 }
    );
  }

  // Payment gate. Honor the demo backdoor first (mark-paid sets
  // payment_hash_received without going through Lightning), then fall back
  // to a real verifyPayment() call against the invoice's payment_hash.
  let verified = !!job.payment_hash_received;
  if (!verified && job.invoice?.payment_hash) {
    const result = await verifyPayment(job.invoice.payment_hash);
    verified = result.verified;
    if (verified) {
      updateJob(jobId, {
        payment_hash_received: job.invoice.payment_hash,
      });
    }
  }

  if (!verified) {
    return withCors(
      {
        error: "invoice not paid",
        invoice: job.invoice,
      },
      { status: 402 }
    );
  }

  updateJob(jobId, {
    status: "executing",
    payment_verified_at: Date.now(),
  });

  // Stream progress as Server-Sent Events.
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
