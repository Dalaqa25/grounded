/**
 * Three demo corpora over one engine. Each mode changes the data and the voice
 * of the answer; the retrieval pipeline underneath is identical.
 */

export interface Mode {
  id: string;
  /** Postgres `workspace` value. */
  workspace: string;
  name: string;
  tagline: string;
  blurb: string;
  /** Tailwind colour token used for accents in this mode. */
  accent: "amber" | "violet" | "emerald";
  noun: string;
  /** How many chunks to put in front of the model, and the per-document cap. */
  retrieval: { matchCount: number; maxPerDocument: number };
  /** Appended to the shared system prompt. */
  persona: string;
  samples: string[];
}

export const MODES: Mode[] = [
  {
    id: "talent",
    workspace: "talent",
    name: "Talent Match",
    tagline: "Search a candidate pool in plain English",
    blurb:
      "Twelve candidate profiles. Ask for skills, seniority, location or availability and get an answer that cites the exact line in the exact CV.",
    accent: "amber",
    noun: "candidate",
    // Twelve short documents, and the questions are mostly "who matches?".
    // Breadth beats depth: more slots, and at most two per candidate.
    retrieval: { matchCount: 10, maxPerDocument: 2 },
    persona:
      "You are a recruiting analyst. Be concrete about people: name them, give years of experience and the specific technologies evidenced in their profile. When comparing candidates, lay out the trade-off plainly rather than hedging. Never invent a candidate, a skill or a number that is not in the sources.",
    samples: [
      "Who has production experience with OAuth and third-party API integrations?",
      "Which candidates are in a UTC+2 to UTC+4 timezone and available within a month?",
      "Compare the two strongest candidates for a forward-deployed engineer role.",
      "Has anyone actually shipped a RAG system to production?",
    ],
  },
  {
    id: "handbook",
    workspace: "handbook",
    name: "Company Knowledge",
    tagline: "The internal handbook, answerable",
    blurb:
      "Policies, onboarding and engineering practice for a fictional company. The questions people actually ask in their first month — answered with the paragraph they came from.",
    accent: "violet",
    noun: "policy",
    retrieval: { matchCount: 6, maxPerDocument: 3 },
    persona:
      "You are an internal operations assistant. Answer the way a well-briefed colleague would: lead with the rule, then the exception, then who to contact. Quote exact figures, notice periods and limits from the sources. If a policy does not cover the question, say so and point to the nearest owner.",
    samples: [
      "How much remote-work equipment budget do I get, and how do I claim it?",
      "What is the process for taking parental leave?",
      "What are the rules for using AI coding assistants on customer code?",
      "Who approves a production deploy on a Friday?",
    ],
  },
  {
    id: "docs",
    workspace: "docs",
    name: "Docs Copilot",
    tagline: "Technical documentation, without the search box",
    blurb:
      "Reference docs for a fictional workflow-automation platform. The kind of corpus where keyword search alone fails and embeddings alone hallucinate — so the retrieval does both.",
    accent: "emerald",
    noun: "page",
    // Answers usually live in one page, so let that page dominate.
    retrieval: { matchCount: 6, maxPerDocument: 4 },
    persona:
      "You are a developer-documentation assistant. Be precise and terse. Use the exact names of fields, endpoints, error codes and defaults as written in the sources. Prefer a short code block or a numbered procedure over prose. Never guess a parameter name.",
    samples: [
      "How do I retry a failed step without re-running the whole workflow?",
      "What does error AUTH_403_SCOPE mean and how do I fix it?",
      "What are the rate limits, and how should I handle a 429?",
      "How do I pass data between two steps?",
    ],
  },
];

export const DEFAULT_MODE = MODES[0];

export function getMode(id: string | undefined): Mode | undefined {
  return MODES.find((m) => m.id === id);
}

export const ACCENTS: Record<
  Mode["accent"],
  { text: string; bg: string; ring: string; dot: string; glow: string }
> = {
  amber: {
    text: "text-amber-300",
    bg: "bg-amber-400/10",
    ring: "ring-amber-400/30",
    dot: "bg-amber-400",
    glow: "shadow-[0_0_24px_-6px_rgb(251_191_36/0.45)]",
  },
  violet: {
    text: "text-violet-300",
    bg: "bg-violet-400/10",
    ring: "ring-violet-400/30",
    dot: "bg-violet-400",
    glow: "shadow-[0_0_24px_-6px_rgb(167_139_250/0.45)]",
  },
  emerald: {
    text: "text-emerald-300",
    bg: "bg-emerald-400/10",
    ring: "ring-emerald-400/30",
    dot: "bg-emerald-400",
    glow: "shadow-[0_0_24px_-6px_rgb(52_211_153/0.45)]",
  },
};
