import { afterEach, describe, expect, it } from "vitest";

import { getOpenRouterEnv } from "@/lib/env";

const originalEnvironment = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_DEMO_API_KEY: process.env.OPENROUTER_DEMO_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
};

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("OpenRouter environment selection", () => {
  it("uses a separate API key for demo sessions", () => {
    process.env.OPENROUTER_API_KEY = "normal-key";
    process.env.OPENROUTER_DEMO_API_KEY = "demo-key";
    process.env.OPENROUTER_MODEL = "example/model";
    process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

    expect(getOpenRouterEnv("normal")?.OPENROUTER_API_KEY).toBe("normal-key");
    expect(getOpenRouterEnv("demo")?.OPENROUTER_API_KEY).toBe("demo-key");
  });

  it("does not fall back to the normal key when the demo key is absent", () => {
    process.env.OPENROUTER_API_KEY = "normal-key";
    delete process.env.OPENROUTER_DEMO_API_KEY;
    process.env.OPENROUTER_MODEL = "example/model";
    process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

    expect(getOpenRouterEnv("demo")).toBeNull();
  });
});
