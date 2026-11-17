"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CodeXml, FlaskConical, Users, Wrench } from "lucide-react";
import { ACCENTS, MODES } from "@/lib/modes";

const ICONS: Record<string, typeof Users> = {
  talent: Users,
  handbook: BookOpen,
  docs: Wrench,
};

export function Sidebar({ repoUrl }: { repoUrl: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-[15.5rem] shrink-0 flex-col border-r border-white/7 bg-ink-900/50">
      <div className="px-5 py-5">
        <Link href="/" className="group inline-flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Grounded
          </span>
        </Link>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-400">
          Answers with the receipts attached.
        </p>
      </div>

      <div className="px-3">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Workspaces
        </p>
        <ul className="flex flex-col gap-0.5">
          {MODES.map((mode) => {
            const Icon = ICONS[mode.id] ?? Users;
            const active = pathname === `/${mode.id}`;
            const accent = ACCENTS[mode.accent];
            return (
              <li key={mode.id}>
                <Link
                  href={`/${mode.id}`}
                  className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition ${
                    active ? "bg-white/7" : "hover:bg-white/4"
                  }`}
                >
                  <Icon
                    className={`mt-0.5 size-4 shrink-0 ${active ? accent.text : "text-ink-500"}`}
                    strokeWidth={1.8}
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-[13px] font-medium leading-tight ${
                        active ? "text-white" : "text-ink-200"
                      }`}
                    >
                      {mode.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">
                      {mode.tagline}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-auto px-3 pb-4">
        <ul className="flex flex-col gap-0.5 border-t border-white/7 pt-3">
          <li>
            <SideLink href="/evals" active={pathname === "/evals"} icon={FlaskConical}>
              Evaluation
            </SideLink>
          </li>
          <li>
            <SideLink href="/how-it-works" active={pathname === "/how-it-works"} icon={BookOpen}>
              How it works
            </SideLink>
          </li>
          <li>
            <SideLink href={repoUrl} icon={CodeXml} external>
              Source
            </SideLink>
          </li>
        </ul>
      </div>
    </nav>
  );
}

function SideLink({
  href,
  children,
  icon: Icon,
  active,
  external,
}: {
  href: string;
  children: React.ReactNode;
  icon: typeof Users;
  active?: boolean;
  external?: boolean;
}) {
  const className = `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition ${
    active ? "bg-white/7 text-white" : "text-ink-400 hover:bg-white/4 hover:text-ink-200"
  }`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
        <Icon className="size-3.5" strokeWidth={1.8} />
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      <Icon className="size-3.5" strokeWidth={1.8} />
      {children}
    </Link>
  );
}

function Mark() {
  return (
    <span className="relative flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400/90 to-indigo-600 shadow-[0_0_18px_-4px_rgb(129_140_248/0.6)]">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
        <path
          d="M12 3v9m0 0 4-3m-4 3-4-3M5 16.5c0 2.5 3.1 4.5 7 4.5s7-2 7-4.5"
          stroke="#0b0d10"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
