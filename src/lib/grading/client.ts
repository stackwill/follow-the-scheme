import { getOpenRouterEnv } from "@/lib/env";
import { gradingResponseSchema } from "@/lib/grading/schema";
import type { GradingPromptMessages } from "@/lib/grading/prompt";

type OpenRouterChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const OPENROUTER_TIMEOUT_MS = 45_000;

function stripMarkdownJsonFence(content: string) {
  const trimmed = content.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);

  return fenceMatch?.[1] ?? trimmed;
}

function extractFirstBalancedJsonObject(content: string) {
  const start = content.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < content.length; index += 1) {
    const character = content[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = inString;
      continue;
    }

    if (character === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return content.slice(start, index + 1);
      }
    }
  }

  return null;
}

function invalidJsonError(content: string, cause?: unknown) {
  const preview = content.replace(/\s+/g, " ").trim().slice(0, 220);

  return new Error(
    `OpenRouter grading returned invalid JSON content${preview ? `: ${preview}` : "."}`,
    cause ? { cause } : undefined,
  );
}

export function parseStructuredGradeContent(content: string) {
  const candidates = [content.trim(), stripMarkdownJsonFence(content), extractFirstBalancedJsonObject(content)].filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw invalidJsonError(content, lastError);
}

function parseJsonContent(content: string) {
  try {
    return parseStructuredGradeContent(content);
  } catch (error) {
    throw error instanceof Error ? error : invalidJsonError(content, error);
  }
}

export async function requestStructuredGrade(prompt: GradingPromptMessages) {
  const openRouterEnv = getOpenRouterEnv();

  if (!openRouterEnv) {
    throw new Error("Written-answer AI marking is not configured on this server. Multiple choice questions still mark automatically.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${openRouterEnv.OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${openRouterEnv.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openRouterEnv.OPENROUTER_MODEL,
        max_tokens: 1400,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: prompt.system,
          },
          {
            role: "user",
            content: prompt.user,
          },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OpenRouter grading timed out after ${OPENROUTER_TIMEOUT_MS / 1000} seconds.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`OpenRouter grading failed with ${response.status}: ${responseText.slice(0, 300)}`);
  }

  const json = (await response.json()) as OpenRouterChatCompletion;
  const content = json.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenRouter grading response did not include message content.");
  }

  const parsedContent = parseJsonContent(content);
  const result = gradingResponseSchema.safeParse(parsedContent);

  if (!result.success) {
    throw new Error(`OpenRouter grading response failed schema validation: ${result.error.message}`);
  }

  return result.data;
}
