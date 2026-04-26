// Orchestration templates - fast paths for known task categories.
//
// The "real" planner in lib/planner.ts asks Claude to compose a plan freely
// from the marketplace's available capabilities. Templates exist as a
// pragmatic shortcut for the demo: when a request obviously matches a known
// category, we skip the LLM round-trip and use the canonical capability
// sequence below. This is a hackathon-scope optimization, not the long-term
// architecture - delete or extend as Maestro learns to plan more domains.
//
// To add a template: pick a stable key, list the ordered capabilities, and
// (optionally) add keywords that should trigger it.

export type Template = {
  key: string;
  description: string;
  capabilities: string[]; // ordered pipeline of required capabilities
  keywords: string[];     // lowercase substrings that activate this template
};

export const TEMPLATES: Template[] = [
  {
    key: "product_video",
    description:
      "End-to-end product video generated directly via a single-call video generator agent.",
    capabilities: [
      "product_video_generation",
    ],
    keywords: [
      "product video",
      "explainer video",
      "promo video",
      "ad video",
      "video ad",
      "commercial",
      "video for",
      "make a video",
      "create a video",
      "produce a video",
    ],
  },
];

export function findTemplate(taskRequest: string): Template | undefined {
  const haystack = taskRequest.toLowerCase();
  return TEMPLATES.find((t) => t.keywords.some((kw) => haystack.includes(kw)));
}

export function getTemplate(key: string): Template | undefined {
  return TEMPLATES.find((t) => t.key === key);
}
