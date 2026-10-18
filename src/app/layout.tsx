import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SynapseProvider } from "@/context/SynapseContext";
import AppShell from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SynapseOps — Self-Learning Multi-Agent Incident War Room",
  description:
    "Enterprise-grade incident troubleshooting powered by FalkorDB cognitive graph memory. Multi-agent coordination with episodic recall, procedural learning, and real-time blast-radius analysis.",
  keywords: [
    "SynapseOps",
    "FalkorDB",
    "incident management",
    "multi-agent",
    "graph database",
    "SRE",
    "war room",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <SynapseProvider>
          <AppShell>{children}</AppShell>
        </SynapseProvider>
      </body>
    </html>
  );
}
