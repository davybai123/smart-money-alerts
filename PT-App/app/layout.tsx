import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Faceless YT",
  description: "AI-powered faceless YouTube & social content suite for World Cup 2026 — generate, track and schedule at scale",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="flex h-full min-h-screen antialiased" style={{ background: "#080808", color: "#f0f0f0" }}>
        <Sidebar />
        <main className="flex-1 overflow-auto" style={{ marginLeft: "0" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
