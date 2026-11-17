import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";
import { SetupNotice } from "@/components/setup-notice";
import { isConfigured } from "@/lib/env";
import { getMode } from "@/lib/modes";
import { statsFor } from "@/lib/stats";

// Rendered per request: corpus size and configuration state are read at run
// time, so a prerendered copy would freeze the setup screen in place.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mode: string }>;
}): Promise<Metadata> {
  const mode = getMode((await params).mode);
  if (!mode) return {};
  return { title: mode.name, description: mode.blurb };
}

export default async function ModePage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const mode = getMode((await params).mode);
  if (!mode) notFound();

  if (!isConfigured()) {
    return <SetupNotice />;
  }

  const stats = await statsFor(mode.workspace);

  if (!stats) {
    return <SetupNotice variant="empty" />;
  }

  return <Workspace mode={mode} stats={stats} />;
}
