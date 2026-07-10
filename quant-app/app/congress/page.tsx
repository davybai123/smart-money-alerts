import fs from "fs";
import path from "path";
import CongressClient from "@/components/CongressClient";

export default function CongressPage() {
  const tradesPath = path.join(process.cwd(), "..", "trades.json");
  let rawTrades: string[] = [];
  try {
    rawTrades = JSON.parse(fs.readFileSync(tradesPath, "utf-8")) as string[];
  } catch {
    rawTrades = [];
  }
  // Skip the header row (first element is column names)
  const data = rawTrades.filter((r) => !r.startsWith("Politician"));
  return <CongressClient rawTrades={data} />;
}
