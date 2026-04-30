import { z } from "zod";

const serverEnvSchema = z.object({
  BAGS_API_KEY: z.string().min(1).optional(),
  SOLANA_RPC_URL: z.string().url().default("https://api.mainnet-beta.solana.com"),
  DATABASE_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000")
});

export const env = serverEnvSchema.parse(process.env);

export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = env[key];

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value as NonNullable<(typeof env)[K]>;
}
