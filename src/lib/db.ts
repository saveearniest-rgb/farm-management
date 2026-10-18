import "server-only";

import { PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  prismaGlobal.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.prisma = db;
}
