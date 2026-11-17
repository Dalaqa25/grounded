import { supabaseAdmin } from "./supabase";
import type { WorkspaceStat } from "./types";

/**
 * Corpus size per workspace. Returns null rather than throwing so a missing
 * database shows a setup screen instead of a stack trace.
 */
export async function workspaceStats(): Promise<WorkspaceStat[] | null> {
  try {
    const { data, error } = await supabaseAdmin().rpc("workspace_stats");
    if (error) return null;
    return (data ?? []) as WorkspaceStat[];
  } catch {
    return null;
  }
}

export async function statsFor(
  workspace: string,
): Promise<{ documents: number; chunks: number } | null> {
  const all = await workspaceStats();
  const row = all?.find((s) => s.workspace === workspace);
  return row ? { documents: row.documents, chunks: row.chunks } : null;
}
