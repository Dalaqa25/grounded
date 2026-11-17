import { Masthead } from "@/components/masthead";
import { SITE } from "@/lib/site";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Masthead repoUrl={SITE.repo} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
