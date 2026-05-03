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

function parseJsonContent(content: string) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error("OpenRouter grading returned invalid JSON content.", {
      cause: error,
    });
  }
}

export async function requestStructuredGrade(prompt: GradingPromptMessages) {
  const openRouterEnv = getOpenRouterEnv();
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
        max_tokens: 700,
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
