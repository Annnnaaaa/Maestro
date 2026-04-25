# Maestro

Orchestrator agent backend for the Maestro hackathon project. Maestro is an
LLM-powered agent (Claude via the Anthropic SDK) that hires other agents from
a marketplace, pays them over Lightning, and aggregates their outputs into a
finished product video.

This package is the **backend only** — Next.js 14 App Router, deployable to
Vercel. The dashboard frontend lives in a separate repo (point
`NEXT_PUBLIC_DASHBOARD_URL` at it).

## Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY
npm run dev
```

The server starts on `http://localhost:3000`.

## Environment variables

| Var | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required. Used by `lib/llm.ts` for Maestro's analysis. |
| `NEXT_PUBLIC_DASHBOARD_URL` | URL of the demo dashboard, displayed on `/`. |

## Endpoints

All endpoints allow CORS from any origin (demo).

### `POST /api/maestro/request`

Submit a consumer request. Maestro decides whether it has enough info or needs
to ask clarifying questions.

```json
// Request
{
  "consumerRequest": "Make a 30s playful video for our new dog treat brand 'Bork Bites' aimed at millennial pet parents.",
  "providedSpecs": { "voiceover_tone": "warm" }   // optional
}
```

Returns either:

```json
{ "needsClarification": true, "questions": ["..."] }
```

or:

```json
{
  "needsClarification": false,
  "jobId": "job_abc123",
  "spec": { "product_name": "...", "...": "..." },
  "plannedAgents": [{ "name": "script-agent", "fee_sats": 15 }, ...],
  "subtotal": 68,
  "margin": 11,
  "totalCost": 79
}
```

### `POST /api/maestro/execute`

Body: `{ "jobId": "..." }`. Streams progress as Server-Sent Events. Each event
follows:

```json
{ "step": "hiring" | "working" | "complete" | "error",
  "agent": "script-agent",
  "paymentSent": 15,
  "output": { ... } }
```

Use with the Fetch streaming API or `EventSource`.

### `GET /api/marketplace`

Returns `{ "agents": [...] }`.

### `POST /api/marketplace`

Adds an agent to the in-memory registry. Body:

```json
{
  "id": "music-agent",
  "endpoint": "http://localhost:3004/api/agent/music",
  "fee_sats": 20,
  "specialty": "background music",
  "name": "Music Agent"
}
```

## File map

```
app/
  api/
    maestro/
      request/route.ts   # POST: analyze + plan + price
      execute/route.ts   # POST: SSE pipeline runner
    marketplace/route.ts # GET / POST
  layout.tsx
  page.tsx
lib/
  cors.ts                # shared CORS helpers
  lightning.ts           # STUB - real impl coming from another team member
  llm.ts                 # Anthropic SDK wrapper -> askClaude(system, user)
  marketplace.ts         # in-memory agent registry
  maestro.ts             # decomposeTask, executeJob, analyzeRequest, pricing
```

## Notes / hackathon scope

- **No database.** All state is held in `Map`s on `globalThis` so they
  survive HMR but are obviously per-process.
- **Lightning is stubbed.** `lib/lightning.ts` returns a fake payment hash and
  logs to the console. Another team member is building the real
  `payInvoice` and will swap this file out.
- **Sub-agents may be unreachable.** If a sub-agent endpoint is down,
  Maestro returns a stub output for that step rather than failing the job,
  so demos keep running.
- **No tests, no auth.** Per the hackathon spec.
