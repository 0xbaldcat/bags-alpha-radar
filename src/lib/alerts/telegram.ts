import TelegramBot from "node-telegram-bot-api";
import { compactAddress, formatNumber } from "@/lib/utils";
import type { AlertEvent, AlertSink } from "./types";

export class TelegramAlertSink implements AlertSink {
  private readonly bot: TelegramBot;
  private readonly chatId: string;

  constructor(token: string, chatId: string) {
    this.bot = new TelegramBot(token, { polling: false });
    this.chatId = chatId;
  }

  async send(event: AlertEvent) {
    await this.bot.sendMessage(this.chatId, renderTelegramAlert(event), {
      parse_mode: "Markdown",
      disable_web_page_preview: false
    });
  }
}

export function renderTelegramAlert(event: AlertEvent) {
  const token = event.token;

  return [
    `*BagsRadar alert* ${token.symbol}`,
    `${event.reason}`,
    `Score: *${event.score}*`,
    `Mint: \`${compactAddress(token.mint, 5)}\``,
    `Holders: ${formatNumber(token.holderCount)} | Liquidity: $${formatNumber(token.liquidityUsd, { maximumFractionDigits: 0 })}`,
    `Open: https://bags.fm/${token.mint}`
  ].join("\n");
}
