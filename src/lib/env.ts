import { z } from "zod";

const localDevEnvDefaults = {
  DATABASE_URL: "file:../data/app.db",
  APP_DATA_DIR: "./data",
} as const;

const useLocalDevEnvDefaults =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_DATA_DIR: z.string().min(1),
});

const openRouterEnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url(),
});

type OpenRouterAccessMode = "normal" | "demo";

export const env = envSchema.parse({
  DATABASE_URL:
    process.env.DATABASE_URL ??
    (useLocalDevEnvDefaults ? localDevEnvDefaults.DATABASE_URL : undefined),
  APP_DATA_DIR:
    process.env.APP_DATA_DIR ??
    (useLocalDevEnvDefaults ? localDevEnvDefaults.APP_DATA_DIR : undefined),
});

export function getOpenRouterEnv(accessMode: OpenRouterAccessMode = "normal") {
  const apiKey =
    accessMode === "demo" ? process.env.OPENROUTER_DEMO_API_KEY : process.env.OPENROUTER_API_KEY;

  if (accessMode === "demo" && !apiKey) {
    return null;
  }

  const candidate = {
    OPENROUTER_API_KEY: apiKey,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
  };

  if (!candidate.OPENROUTER_API_KEY && !candidate.OPENROUTER_MODEL && !candidate.OPENROUTER_BASE_URL) {
    return null;
  }

  return openRouterEnvSchema.parse(candidate);
}
