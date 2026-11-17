import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  chatModel,
  fallbackModel,
  fallbackModelName,
  isRateLimited,
  modelName,
  withGroqRetry,
} from "./llm";
import type { Mode } from "./modes";
import type { ChatTurn, RetrievedChunk } from "./types";

/**
 * Rewrites a follow-up into a question that stands on its own.
 *
 * Retrieval has no memory. "What about her Python?" embeds to nothing useful,
 * because the subject lives in the previous turn. Condensing first is what
 * makes multi-turn conversation work at all over a vector store.
 */
export async function rewriteQuery(
  question: string,
  history: ChatTurn[],
): Promise<string> {
  if (history.length === 0) return question;

  const transcript = history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n");

  const model = chatModel({ temperature: 0, maxTokens: 120 });
  const result = await withGroqRetry(() =>
    model.invoke([
    new SystemMessage(
      "Rewrite the user's latest message as a standalone search query that makes sense without the conversation. " +
        "Resolve pronouns and implied subjects using the transcript. " +
        "Keep proper nouns and technical terms exactly as written. " +
        "Reply with the query only — no preamble, no quotes.",
    ),
      new HumanMessage(`Transcript:\n${transcript}\n\nLatest message: ${question}`),
    ]),
  );

  const text = String(result.content).trim().replace(/^["']|["']$/g, "");
  return text.length > 3 && text.length < 400 ? text : question;
}

export function buildSystemPrompt(mode: Mode, chunks: RetrievedChunk[]): string {
  const sources = chunks
    .map(
      (c) =>
        `[${c.citation}] ${c.documentTitle}${
          c.sourcePath ? ` (${c.sourcePath})` : ""
        }\n${c.content}`,
    )
    .join("\n\n---\n\n");

  return [
    `You answer questions using only the numbered sources below. ${mode.persona}`,
    "",
    "Rules:",
    "1. Every factual sentence must carry a citation at the end of the sentence, written with ASCII square brackets exactly like [1] or [2][3]. Never use 【 】, parentheses, or the word 'Source'.",
    "2. Use only what the sources state. Do not add background knowledge, do not estimate, do not fill gaps.",
    "3. If the sources do not answer the question, say exactly what is missing and stop. Do not apologise at length.",
    "4. Be complete. Give every figure, limit, deadline, exception and follow-up step the sources state for this question. An answer that is correct but omits a stated limit or caveat is wrong.",
    "5. Answer every part of a multi-part question, and when asked to compare, name the trade-off rather than listing both sides neutrally.",
    "6. Prefer short paragraphs, bullets or a small table. No preamble like 'Based on the sources'. Start with the answer.",
    "7. If sources disagree, show both and cite each.",
    "",
    "Sources:",
    "",
    sources,
  ].join("\n");
}

export const NO_CONTEXT_REPLY =
  "I could not find anything in this workspace that answers that. " +
  "Nothing retrieved cleared the relevance floor, so rather than guess from loosely related text, " +
  "I am telling you the corpus does not cover it. Try rephrasing, or switch to a workspace that holds this kind of material.";

/** Streams the grounded answer token by token. */
export async function* streamAnswer(
  mode: Mode,
  question: string,
  chunks: RetrievedChunk[],
  history: ChatTurn[],
  /** Called once with the model that actually produced the answer. */
  onModel?: (name: string) => void,
): AsyncGenerator<string> {
  const model = chatModel({ temperature: 0.1, maxTokens: 900 });

  const messages = [
    new SystemMessage(buildSystemPrompt(mode, chunks)),
    ...history.slice(-4).map((t) =>
      t.role === "user"
        ? new HumanMessage(t.content)
        : new SystemMessage(`Your previous answer: ${t.content}`),
    ),
    new HumanMessage(question),
  ];

  let stream;
  try {
    stream = await withGroqRetry(() => model.stream(messages));
    onModel?.(modelName());
  } catch (error) {
    // Out of daily quota on the primary. A smaller model's answer beats an
    // error page on a public demo, and the UI reports which one replied.
    if (!isRateLimited(error)) throw error;
    stream = await withGroqRetry(() => fallbackModel().stream(messages));
    onModel?.(fallbackModelName());
  }

  for await (const part of stream) {
    const text = typeof part.content === "string" ? part.content : "";
    if (text) yield text;
  }
}
