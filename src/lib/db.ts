import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function resolveDatabaseUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:") || databaseUrl.startsWith("file://")) {
    return databaseUrl;
  }

  const sqlitePath = databaseUrl.slice("file:".length);

  if (path.isAbsolute(sqlitePath)) {
    return pathToFileURL(sqlitePath).href;
  }

  const prismaRoot = path.resolve(process.cwd(), "prisma");
  return pathToFileURL(path.resolve(prismaRoot, sqlitePath)).href;
}

function ensureLocalDatabaseDir(databaseUrl: string) {
  if (!databaseUrl.startsWith("file://")) {
    return;
  }

  const databaseFilePath = new URL(databaseUrl).pathname;
  mkdirSync(path.dirname(databaseFilePath), { recursive: true });
}

const resolvedDatabaseUrl = resolveDatabaseUrl(env.DATABASE_URL);

ensureLocalDatabaseDir(resolvedDatabaseUrl);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaLibSQL({
      url: resolvedDatabaseUrl,
    }),
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
