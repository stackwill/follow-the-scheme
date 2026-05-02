import { z } from "zod";

const localDevEnvDefaults = {
  DATABASE_URL: "file:../data/app.db",
  APP_DATA_DIR: "./data",
} as const;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_DATA_DIR: z.string().min(1),
});

const openRouterEnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_MODEL: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? localDevEnvDefaults.DATABASE_URL,
  APP_DATA_DIR: process.env.APP_DATA_DIR ?? localDevEnvDefaults.APP_DATA_DIR,
});

export function getOpenRouterEnv() {
  return openRouterEnvSchema.parse({
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
  });
}
