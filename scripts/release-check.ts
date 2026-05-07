import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envPath = ".env";
const failures: string[] = [];

function readEnvValue(name: string) {
  if (!existsSync(envPath)) {
    return null;
  }

  const content = readFileSync(envPath, "utf8");
  const match = new RegExp(`^${name}=(.*)$`, "m").exec(content);

  return match?.[1]?.replace(/^["']|["']$/g, "") ?? null;
}

function requireEnv(name: string, minimumLength: number) {
  const value = readEnvValue(name);

  if (!value || value.length < minimumLength) {
    failures.push(`${name} must be set in .env and be at least ${minimumLength} characters.`);
  }
}

function forbidEnv(name: string, reason: string) {
  if (readEnvValue(name)) {
    failures.push(`${name} is set in .env. ${reason}`);
  }
}

requireEnv("AUTH_PASSWORD", 12);
requireEnv("AUTH_SESSION_SECRET", 32);
requireEnv("DATABASE_URL", 1);
requireEnv("APP_DATA_DIR", 1);
forbidEnv("NEXT_PUBLIC_OPENROUTER_API_KEY", "OpenRouter keys must only be available server-side.");
forbidEnv("NEXT_PUBLIC_OPENROUTER_MODEL", "OpenRouter configuration must only be available server-side.");
forbidEnv("NEXT_PUBLIC_OPENROUTER_BASE_URL", "OpenRouter configuration must only be available server-side.");

const gitEnvCheck = spawnSync("git", ["ls-files", ".env"], {
  encoding: "utf8",
});

if (gitEnvCheck.stdout.trim()) {
  failures.push(".env is tracked by git. Remove it from the index before releasing.");
}

if (failures.length > 0) {
  console.error("Release check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Release check passed.");
