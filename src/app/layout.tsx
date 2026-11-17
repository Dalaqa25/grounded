import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";

/** Text face. Newsreader has real optical sizing, so the answer body and the
 *  display headings are drawn for their size rather than scaled. */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

/** Labels and controls only — the page should not read as a dashboard. */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/** Figures: scores, ranks, timings. Tabular so columns line up. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Grounded — retrieval you can audit",
    template: "%s · Grounded",
  },
  description:
    "Retrieval-augmented question answering over three corpora. Hybrid search, footnoted answers, a visible retrieval trace, and a measured evaluation suite.",
  openGraph: {
    title: "Grounded — retrieval you can audit",
    description:
      "Hybrid retrieval, footnoted answers and a visible trace of what the model was given.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#15120e" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Applies the saved theme before first paint. Without this the page renders
 * in the system theme and then snaps to the chosen one — a flash that makes
 * the whole thing feel cheap.
 */
const NO_FLASH = `
(function () {
  try {
    var t = localStorage.getItem("grounded-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body className="min-h-dvh antialiased">
        <div aria-hidden className="grain-layer" />
        <div className="relative z-10 min-h-dvh">{children}</div>
      </body>
    </html>
  );
}
