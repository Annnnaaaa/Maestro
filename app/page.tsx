export default function Home() {
  const dashboard = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "(not configured)";
  return (
    <main>
      <h1>Maestro</h1>
      <p>Orchestrator agent backend. The frontend lives at:</p>
      <pre>{dashboard}</pre>
      <h2>Endpoints</h2>
      <ul>
        <li><code>POST /api/maestro/request</code></li>
        <li><code>POST /api/maestro/execute</code> (Server-Sent Events)</li>
        <li><code>GET  /api/marketplace</code></li>
        <li><code>POST /api/marketplace</code></li>
      </ul>
    </main>
  );
}
