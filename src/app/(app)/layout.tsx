import { Sidebar } from "@/components/sidebar";
import { SITE } from "@/lib/site";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden lg:flex">
        <Sidebar repoUrl={SITE.repo} />
      </div>
      {children}
    </div>
  );
}
