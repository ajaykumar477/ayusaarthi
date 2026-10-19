import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AYUsaarthi — Intelligent Legal & Scientific AYUSH Library",
  description: "Unified legal & statutory guidance across the complete Ministry of AYUSH ecosystem and global regimes (TKDL, D&C Act 1940, WIPO, EPO, Nagoya Protocol).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="h-full bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}

