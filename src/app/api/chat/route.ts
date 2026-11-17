import { NextRequest } from "next/server";
import { z } from "zod";
import { getMode } from "@/lib/modes";
import { isRateLimited, modelName } from "@/lib/llm";
import { NO_CONTEXT_REPLY, rewriteQuery, streamAnswer } from "@/lib/rag";
import { hasUsableContext, retrieve } from "@/lib/retriever";
import type { ChatEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  mode: z.string(),
  question: z.string().min(1).max(1000),
  retrieval: z.enum(["hybrid", "vector", "keyword"]).default("hybrid"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .default([]),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { mode: modeId, question, retrieval: retrievalMode, history } = parsed.data;
  const mode = getMode(modeId);
  if (!mode) {
    return Response.json({ error: `Unknown mode: ${modeId}` }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const totalStart = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        // 1. Condense the follow-up so retrieval sees a self-contained query.
        let searchQuery = question;
        if (history.length) {
          send({ type: "status", stage: "rewriting" });
          searchQuery = await rewriteQuery(question, history);
        }

        // 2. Retrieve, and show the work before the answer starts.
        send({ type: "status", stage: "retrieving" });
        const trace = await retrieve({
          workspace: mode.workspace,
          query: question,
          searchQuery,
          mode: retrievalMode,
          matchCount: mode.retrieval.matchCount,
          maxPerDocument: mode.retrieval.maxPerDocument,
        });
        send({ type: "retrieval", trace });

        // 3. Refuse rather than improvise when nothing cleared the floor.
        if (!hasUsableContext(trace)) {
          for (const word of NO_CONTEXT_REPLY.split(" ")) {
            send({ type: "token", value: word + " " });
            await new Promise((r) => setTimeout(r, 12));
          }
          send({
            type: "done",
            answerMs: 0,
            totalMs: Date.now() - totalStart,
            model: modelName(),
          });
          controller.close();
          return;
        }

        // 4. Generate.
        send({ type: "status", stage: "generating" });
        const answerStart = Date.now();
        let answeredBy = modelName();
        for await (const token of streamAnswer(
          mode,
          question,
          trace.chunks,
          history,
          (name) => {
            answeredBy = name;
          },
        )) {
          send({ type: "token", value: token });
        }

        send({
          type: "done",
          answerMs: Date.now() - answerStart,
          totalMs: Date.now() - totalStart,
          model: answeredBy,
        });
      } catch (error) {
        // Groq's free tier allows 8,000 tokens a minute per model. A handful
        // of overlapping visitors can saturate both the primary and the
        // fallback, and a raw provider error dump helps nobody.
        send({
          type: "error",
          message: isRateLimited(error)
            ? "Both free-tier models are at their per-minute token limit right now. Give it a few seconds and ask again — the retrieval above already ran, so only the writing step failed."
            : error instanceof Error
              ? error.message
              : "Something went wrong",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
