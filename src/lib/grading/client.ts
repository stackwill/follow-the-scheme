import { getOpenRouterEnv } from "@/lib/env";
import { gradingResponseSchema } from "@/lib/grading/schema";

type OpenRouterChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function parseJsonContent(content: string) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error("OpenRouter grading returned invalid JSON content.", {
      cause: error,
    });
  }
}

export async function requestStructuredGrade(prompt: string) {
  const openRouterEnv = getOpenRouterEnv();
  const response = await fetch(`${openRouterEnv.OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterEnv.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openRouterEnv.OPENROUTER_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

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
