import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Smart Money — Quant Trading Framework",
  description:
    "EV-based opportunity analyzer, Kelly position sizing, trade journal, and congressional smart-money feed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body
        className="flex h-full min-h-screen antialiased"
        style={{ background: "#080808", color: "#f0f0f0" }}
      >
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
