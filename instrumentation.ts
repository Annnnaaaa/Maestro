// Next.js calls register() once when the server boots. Used here to seed the
// marketplace from sub-agent /api/agent/manifest endpoints (best-effort) and
// log a startup summary line.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logStartupSummary, seedFromEndpoints } = await import("./lib/marketplace");
  await seedFromEndpoints();
  logStartupSummary();
}
