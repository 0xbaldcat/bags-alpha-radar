import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

let queryClient: postgres.Sql | null = null;
let dbClient: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function createDb() {
  if (!env.DATABASE_URL) {
    return null;
  }

  if (!queryClient) {
    queryClient = postgres(env.DATABASE_URL, { max: 5, idle_timeout: 20 });
    dbClient = drizzle(queryClient, { schema });
  }

  return dbClient;
}
