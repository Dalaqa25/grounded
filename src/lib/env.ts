import { z } from "zod";

/**
 * Environment is validated once, lazily, so a missing key fails with a readable
 * message instead of an undefined-property crash deep inside a request.
 */
const schema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a full https URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_ANON_KEY: z.string().min(20).optional(),
  GROQ_API_KEY: z.string().min(10),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  GROQ_JUDGE_MODEL: z.string().default("openai/gpt-oss-20b"),
  GROQ_FALLBACK_MODELS: z
    .string()
    .default("openai/gpt-oss-20b,qwen/qwen3.8-27b"),
  GOOGLE_API_KEY: z.string().min(10),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-2"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    GROQ_JUDGE_MODEL: process.env.GROQ_JUDGE_MODEL,
    GROQ_FALLBACK_MODELS: process.env.GROQ_FALLBACK_MODELS,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Environment is not configured.\n${missing}\n\nCopy .env.example to .env.local and fill it in.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** True when every required key is present — used to show a setup screen. */
export function isConfigured(): boolean {
  try {
    env();
    return true;
  } catch {
    return false;
  }
}
