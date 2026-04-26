export type McpGatherRequest = {
  request: string;
  missing_inputs: string[];
  consumer_inputs: Record<string, unknown>;
};

export type McpGatherResponse = {
  filled_inputs?: Record<string, unknown>;
  notes?: string;
};

function base(): string | null {
  const url = (process.env.MAESTRO_MCP_CONTEXT_URL ?? "").trim();
  return url.length ? url : null;
}

export async function gatherMissingInputsFromMcp(
  payload: McpGatherRequest
): Promise<McpGatherResponse | null> {
  const url = base();
  if (!url) return null;

  const controller = new AbortController();
  const timeoutMs = Number.parseInt(process.env.MAESTRO_MCP_TIMEOUT_MS ?? "2500", 10);
  const t = setTimeout(() => controller.abort(), Math.max(250, timeoutMs));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as McpGatherResponse;
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

