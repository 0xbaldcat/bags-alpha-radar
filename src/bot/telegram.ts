import { detectAlert } from "@/lib/alerts/detector";
import { TelegramAlertSink } from "@/lib/alerts/telegram";
import { BagsApi } from "@/lib/bags/client";
import { env, requireEnv } from "@/lib/env";

async function main() {
  const sink = new TelegramAlertSink(requireEnv("TELEGRAM_BOT_TOKEN"), requireEnv("TELEGRAM_CHAT_ID"));
  const bags = new BagsApi(env.BAGS_API_KEY);
  const [token] = await bags.getTopTokens();
  const alert = detectAlert(token, 50);

  if (!alert) {
    console.log("No alert fired.");
    return;
  }

  await sink.send(alert);
  console.log(`Sent alert for ${token.symbol} (${token.mint}).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
