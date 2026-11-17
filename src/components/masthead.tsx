"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODES } from "@/lib/modes";
import { ThemeToggle } from "./theme-toggle";

/**
 * A masthead rather than a sidebar. The page is meant to read as a printed
 * document, and documents carry their title and section across the top.
 */
export function Masthead({ repoUrl }: { repoUrl: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[86rem] items-end justify-between gap-6 px-6 pb-2 pt-3.5">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="group flex items-baseline gap-2">
            <span
              className="text-[1.3rem] font-semibold leading-none tracking-[-0.015em]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Grounded
            </span>
          </Link>
          <span className="hidden text-[0.78rem] italic leading-none text-ink-faint sm:inline">
            answers with the receipts attached
          </span>
        </div>

        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-1 md:flex">
            <SecondaryLink href="/how-it-works" active={pathname === "/how-it-works"}>
              Method
            </SecondaryLink>
            <Dot />
            <SecondaryLink href="/evals" active={pathname === "/evals"}>
              Evaluation
            </SecondaryLink>
            <Dot />
            <SecondaryLink href={repoUrl} external>
              Source
            </SecondaryLink>
          </nav>
          <ThemeToggle />
        </div>
      </div>

      {/* Section rule: the workspace tabs sit on it like a contents line. */}
      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-[86rem] items-stretch gap-0 px-6">
          {MODES.map((mode, i) => {
            const active = pathname === `/${mode.id}`;
            return (
              <Link
                key={mode.id}
                href={`/${mode.id}`}
                className={`group relative -mb-px border-b-2 py-2 pr-7 transition-colors ${
                  i > 0 ? "pl-7" : ""
                } ${
                  active
                    ? "border-accent"
                    : "border-transparent hover:border-rule-strong"
                }`}
              >
                <span className="figure-num mr-2">{String(i + 1).padStart(2, "0")}</span>
                <span
                  className={`text-[0.95rem] ${
                    active ? "text-ink" : "text-ink-muted group-hover:text-ink"
                  }`}
                >
                  {mode.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

function Dot() {
  return <span className="text-[0.7rem] text-ink-faint">·</span>;
}

function SecondaryLink({
  href,
  children,
  active,
  external,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  external?: boolean;
}) {
  const className = `px-1.5 py-1 text-[0.82rem] transition-colors ${
    active
      ? "text-accent"
      : "text-ink-muted hover:text-ink"
  }`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
