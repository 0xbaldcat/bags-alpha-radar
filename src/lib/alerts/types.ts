import type { BagsToken } from "@/lib/bags/types";

export type AlertEvent = {
  token: BagsToken;
  reason: string;
  score: number;
  createdAt: string;
  source: "bags" | "liquify" | "mock";
};

export type AlertSink = {
  send(event: AlertEvent): Promise<void>;
};
