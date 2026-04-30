import { getRadarTokensFromDb } from "@/db/radar";
import { bagsApi } from "@/lib/bags/client";
import type { BagsToken } from "@/lib/bags/types";

export async function getRadarTokens() {
  let dbTokens: BagsToken[] = [];

  try {
    dbTokens = await getRadarTokensFromDb();
  } catch (error) {
    console.warn("Falling back to live Bags API because DB radar query failed:", error);
  }

  if (dbTokens.length) {
    return dbTokens;
  }

  return bagsApi.getRadarTokens();
}
