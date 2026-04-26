import { NextRequest } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";
import { getJob, updateJob } from "@/lib/maestro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

// POST /api/maestro/job/:jobId/mark-paid
//
// DEMO-ONLY SHORTCUT.
//
// Real production would wait for an actual NWC / Lightning payment
// notification webhook and only flip the job past the payment gate after a
// settled-on-chain (well, settled-on-Lightning) confirmation arrived. We
// did not build that for the hackathon - too much infrastructure.
//
// This route lets the dashboard simulate that confirmation: when the
// consumer clicks "Pay 90 sats" in the UI, the frontend POSTs here and the
// gated execute endpoint will treat the invoice as paid. Honest scope
// reduction; remove before any non-demo deployment.
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

  const stubHash = `stub_paid_${Date.now()}`;
  const updated = updateJob(jobId, {
    payment_hash_received: stubHash,
    payment_verified_at: Date.now(),
  });

  return withCors({
    ok: true,
    jobId: updated.id,
    status: updated.status,
    payment_hash_received: updated.payment_hash_received,
    note: "demo-only payment shortcut; not a real Lightning settlement",
  });
}
