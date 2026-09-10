import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const shared = globalThis as unknown as { kiteDb?: PrismaClient };

export function getDb() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured.");
  if (!shared.kiteDb) {
    shared.kiteDb = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }
  return shared.kiteDb;
}
