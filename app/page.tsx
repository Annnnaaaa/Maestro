export default function Home() {
  const dashboard = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "(not configured)";
  return (
    <main>
      <h1>Maestro</h1>
      <p>
        General orchestrator backend. Submits a task to Maestro; it inspects the
        marketplace, plans which specialists to hire, pays them over Lightning,
        and aggregates the outputs.
      </p>
      <p>Dashboard: <code>{dashboard}</code></p>
      <h2>Endpoints</h2>
      <ul>
        <li><code>GET  /api/agent/manifest</code> &mdash; Maestro&apos;s own manifest</li>
        <li><code>POST /api/maestro/job</code> &mdash; submit a task</li>
        <li><code>POST /api/maestro/execute</code> &mdash; run a job (SSE)</li>
        <li><code>GET  /api/marketplace</code> &mdash; list agents</li>
        <li><code>POST /api/marketplace</code> &mdash; register an agent (full manifest)</li>
      </ul>
    </main>
  );
}
