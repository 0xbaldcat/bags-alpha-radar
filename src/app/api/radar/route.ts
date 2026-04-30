import { NextResponse } from "next/server";
import { detectAlert } from "@/lib/alerts/detector";
import { bagsApi } from "@/lib/bags/client";
import { getRadarTokens } from "@/lib/radar";

export const dynamic = "force-dynamic";

export async function GET() {
  const tokens = await getRadarTokens();
  const alerts = tokens.map((token) => detectAlert(token)).filter(Boolean);

  return NextResponse.json({
    mode: bagsApi.hasCredentials() ? "live" : "mock",
    tokens,
    alerts
  });
}
