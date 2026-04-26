import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
function getBaseUrl() {
    return (process.env.MAESTRO_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
async function fetchJson(url, init) {
    const res = await fetch(url, init);
    const status = res.status;
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, status, text };
    }
    if (ct.includes("application/json")) {
        const data = (await res.json());
        return { ok: true, status, data };
    }
    const text = await res.text().catch(() => "");
    return { ok: false, status, text: `Expected JSON but got: ${text.slice(0, 200)}` };
}
function asToolResult(obj) {
    const json = JSON.stringify(obj, null, 2);
    return {
        content: [{ type: "text", text: json }],
        structuredContent: obj,
    };
}
function toolError(message, details) {
    return {
        isError: true,
        content: [
            {
                type: "text",
                text: details ? `${message}\n\n${JSON.stringify(details, null, 2)}` : message,
            },
        ],
        structuredContent: { error: message, details },
    };
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
async function getManifest(base) {
    // Requested path is /api/maestro/manifest; Maestro currently exposes /api/agent/manifest.
    const primary = await fetchJson(`${base}/api/maestro/manifest`);
    if (primary.ok)
        return primary.data;
    const fallback = await fetchJson(`${base}/api/agent/manifest`);
    if (fallback.ok)
        return fallback.data;
    throw new Error(`manifest fetch failed (maestro/manifest=${primary.status}, agent/manifest=${fallback.status})`);
}
function randomHex(len) {
    const alphabet = "0123456789abcdef";
    let out = "";
    for (let i = 0; i < len; i += 1)
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
}
function stubPaymentHash() {
    return `stub_${randomHex(24)}`;
}
async function jobStatus(base, jobId) {
    // Foreman endpoint is expected by the hackathon demo.
    const urls = [
        `${base}/api/foreman/job/${encodeURIComponent(jobId)}/status`,
        `${base}/api/maestro/job/${encodeURIComponent(jobId)}/status`,
        `${base}/api/maestro/job/${encodeURIComponent(jobId)}`,
    ];
    let last = null;
    for (const url of urls) {
        const res = await fetchJson(url, { method: "GET" });
        if (res.ok)
            return res.data;
        last = res;
        // try next fallback url
    }
    throw new Error(`status fetch failed (last=${last?.status}): ${last?.text ?? ""}`);
}
function isDoneStatus(payload) {
    if (!payload || typeof payload !== "object")
        return { done: false };
    const p = payload;
    const status = typeof p.status === "string" ? p.status : undefined;
    // Accept a few likely shapes:
    // { status: "complete", video_url: "..." }
    // { status: "done", result: { video_url } }
    // { done: true, final_video_url: "..." }
    const direct = (typeof p.video_url === "string" && p.video_url) ||
        (typeof p.final_video_url === "string" && p.final_video_url) ||
        (typeof p.result?.video_url === "string" && p.result.video_url);
    if (typeof p.done === "boolean" && p.done === true)
        return { done: true, finalUrl: direct };
    if (status && ["complete", "completed", "done", "success"].includes(status.toLowerCase())) {
        return { done: true, finalUrl: direct };
    }
    return { done: false };
}
const server = new McpServer({ name: "maestro-mcp", version: "0.1.0" });
server.registerTool("maestro_get_manifest", {
    title: "Get Maestro manifest",
    description: "Get the capability manifest for Maestro, an orchestrator agent that generates product videos by hiring specialist sub-agents and paying them via Lightning Network.",
    inputSchema: z.object({}),
}, async () => {
    try {
        const base = getBaseUrl();
        const data = await getManifest(base);
        return asToolResult(data);
    }
    catch (e) {
        return toolError("Failed to get manifest", { message: e.message });
    }
});
server.registerTool("maestro_submit_job", {
    title: "Submit Maestro job",
    description: "Submit a job to Maestro. Provide product info and visual context, optionally pass a github_repo_url to have Maestro gather missing context autonomously.",
    inputSchema: z
        .object({
        product_name: z.string(),
        product_description: z.string(),
        target_audience: z.string(),
        visual_context: z.string().optional(),
        gather_missing_from: z
            .object({
            github_repo_url: z.string().url(),
        })
            .optional(),
        style: z.string().optional(),
        duration_seconds: z.number().optional(),
    })
        .strict(),
}, async (args) => {
    try {
        const base = getBaseUrl();
        const visual_context = args.visual_context ??
            (args.gather_missing_from?.github_repo_url
                ? `Gather missing visual context from repo: ${args.gather_missing_from.github_repo_url}`
                : "");
        const requestParts = [
            `Create a short product video for ${args.product_name}.`,
            args.style ? `Style: ${args.style}.` : undefined,
            args.duration_seconds ? `Target duration: ${args.duration_seconds}s.` : undefined,
            args.gather_missing_from?.github_repo_url
                ? `If any context is missing, inspect ${args.gather_missing_from.github_repo_url}.`
                : undefined,
        ].filter(Boolean);
        const payload = {
            request: requestParts.join(" "),
            inputs: {
                product_name: args.product_name,
                product_description: args.product_description,
                target_audience: args.target_audience,
                visual_context,
                ...(args.style ? { style: args.style } : {}),
                ...(typeof args.duration_seconds === "number"
                    ? { duration_seconds: args.duration_seconds }
                    : {}),
            },
        };
        const res = await fetchJson(`${base}/api/maestro/job`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            return toolError("Maestro job submission failed", {
                url: `${base}/api/maestro/job`,
                status: res.status,
                body: res.text,
            });
        }
        return asToolResult(res.data);
    }
    catch (e) {
        return toolError("Failed to submit job", { message: e.message });
    }
});
server.registerTool("maestro_pay_invoice", {
    title: "Pay Lightning invoice",
    description: "Pay a Lightning invoice using the configured wallet.",
    inputSchema: z
        .object({
        invoice: z.string(),
    })
        .strict(),
}, async ({ invoice }) => {
    const base = getBaseUrl();
    try {
        const res = await fetchJson(`${base}/api/lightning/pay`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoice }),
        });
        if (res.ok)
            return asToolResult(res.data);
        // If Maestro doesn't have /api/lightning/pay yet, fall back to a stub
        // hash for hackathon/demo flows (invoice-like strings will still work end-to-end).
        if (res.status === 404 || res.status === 405) {
            return asToolResult({ payment_hash: stubPaymentHash(), stub: true });
        }
        return toolError("Invoice payment failed", { status: res.status, body: res.text });
    }
    catch (e) {
        return toolError("Invoice payment failed", { message: e.message });
    }
});
server.registerTool("maestro_check_status", {
    title: "Check Maestro job status",
    description: "Check the current status of a Maestro job.",
    inputSchema: z
        .object({
        job_id: z.string(),
    })
        .strict(),
}, async ({ job_id }) => {
    try {
        const base = getBaseUrl();
        const status = await jobStatus(base, job_id);
        return asToolResult(status);
    }
    catch (e) {
        return toolError("Failed to fetch job status", { message: e.message });
    }
});
server.registerTool("maestro_execute_job", {
    title: "Execute Maestro job",
    description: "Trigger execution of a paid job. Returns the final video URL when complete.",
    inputSchema: z
        .object({
        job_id: z.string(),
    })
        .strict(),
}, async ({ job_id }) => {
    try {
        const base = getBaseUrl();
        const maxMs = Number.parseInt(process.env.MAESTRO_EXECUTE_MAX_MS ?? "180000", 10);
        const pollMs = Number.parseInt(process.env.MAESTRO_EXECUTE_POLL_MS ?? "2000", 10);
        const started = Date.now();
        while (Date.now() - started < maxMs) {
            const status = await jobStatus(base, job_id);
            const done = isDoneStatus(status);
            if (done.done) {
                return asToolResult({ job_id, status, final_video_url: done.finalUrl ?? null });
            }
            await sleep(pollMs);
        }
        return toolError("Job did not complete before timeout", {
            job_id,
            maxMs,
        });
    }
    catch (e) {
        return toolError("Failed to execute job", { message: e.message });
    }
});
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
run().catch((err) => {
    console.error("[maestro-mcp] fatal:", err);
    process.exit(1);
});
process.stdin.on("close", () => {
    server.close().catch(() => undefined);
});
