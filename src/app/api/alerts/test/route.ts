import { NextResponse } from "next/server";
import { detectAlert } from "@/lib/alerts/detector";
import { TelegramAlertSink } from "@/lib/alerts/telegram";
import { env } from "@/lib/env";
import { getRadarTokens } from "@/lib/radar";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return NextResponse.json(
      {
        ok: false,
        error: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required"
      },
      { status: 400 }
    );
  }

  const tokens = await getRadarTokens();
  const alert = tokens.map((token) => detectAlert(token)).find(Boolean);

  if (!alert) {
    return NextResponse.json({ ok: false, error: "No live scored alert generated" }, { status: 422 });
  }

  const sink = new TelegramAlertSink(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID);
  await sink.send(alert);

  return NextResponse.json({ ok: true, alert });
}
