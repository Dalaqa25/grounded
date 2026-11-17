import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Grounded — retrieval you can audit",
    template: "%s · Grounded",
  },
  description:
    "A retrieval-augmented question answering demo over three corpora. Hybrid search, inline citations, a visible retrieval trace, and a measured evaluation suite.",
  openGraph: {
    title: "Grounded — retrieval you can audit",
    description:
      "Hybrid retrieval, inline citations and a visible trace of what the model was given.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        <div className="relative z-10 min-h-dvh">{children}</div>
      </body>
    </html>
  );
}
