# Maestro MCP Server (stdio)

This is a local **Model Context Protocol (MCP)** server that exposes **Maestro** as callable tools to MCP-compatible clients (Claude.ai with MCP enabled, Cursor, etc.).

It runs over **stdio** (the standard Claude transport): the client spawns this process and communicates via stdin/stdout.

## Install

```bash
cd mcp-server
npm install
npm run build
```

## Configure

### Environment variables

- **`MAESTRO_API_URL`** (required): Base URL for your Maestro deployment (defaults to `http://localhost:3000`)
- **`MAESTRO_EXECUTE_MAX_MS`** (optional): Max poll time for `maestro_execute_job` (default `180000`)
- **`MAESTRO_EXECUTE_POLL_MS`** (optional): Poll interval (default `2000`)

### Claude.ai / Claude Desktop MCP config (stdio)

Add a server entry pointing at the built script:

```json
{
  "mcpServers": {
    "maestro": {
      "command": "node",
      "args": ["<ABS_PATH>/Maestro/mcp-server/dist/index.js"],
      "env": {
        "MAESTRO_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

Replace `<ABS_PATH>` with the full path on your machine.

### Cursor MCP config

Use the same `command`, `args`, and `env` values when adding an MCP server in Cursor.

## Tools exposed

### `maestro_get_manifest`

Gets Maestro’s capability manifest.

- Calls: `GET /api/maestro/manifest` (falls back to `GET /api/agent/manifest` if needed)

### `maestro_submit_job`

Submits a new Maestro job.

- Calls: `POST /api/maestro/job`
- Returns: Maestro response (includes invoice)

### `maestro_pay_invoice`

Pays a Lightning invoice.

- Calls: `POST /api/lightning/pay`
- If the endpoint is not implemented yet (404/405), returns a **stub** `payment_hash` for demo flows.

### `maestro_check_status`

Fetches job status.

- Calls (first one that exists):
  - `GET /api/foreman/job/<id>/status`
  - `GET /api/maestro/job/<id>/status`
  - `GET /api/maestro/job/<id>`

### `maestro_execute_job`

Polls job status until complete (or timeout).

- Polls: `GET /api/foreman/job/<id>/status` (with fallbacks above)
- Returns: `final_video_url` when available

