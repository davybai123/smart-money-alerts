import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "faceless-yt-dashboard",
    timestamp: new Date().toISOString(),
  });
}
