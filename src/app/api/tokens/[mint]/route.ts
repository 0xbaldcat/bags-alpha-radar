import { NextResponse } from "next/server";
import { bagsApi } from "@/lib/bags/client";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: { mint: string } }) {
  const snapshot = await bagsApi.getTokenSnapshot(context.params.mint);

  return NextResponse.json({
    mode: bagsApi.hasCredentials() ? "live" : "mock",
    snapshot
  });
}
