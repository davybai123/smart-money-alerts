import { NextResponse } from "next/server";

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:3001";

export async function GET() {
  try {
    const res = await fetch(`${ENGINE_URL}/health`, { next: { revalidate: 30 } });
    const data = await res.json();
    return NextResponse.json({ connected: true, engine: data });
  } catch {
    return NextResponse.json(
      { connected: false, engine: null, error: "Engine unreachable" },
      { status: 503 }
    );
  }
}
