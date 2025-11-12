import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  SchemaType,
  type EnhancedGenerateContentResponse,
  type FunctionCallPart,
  type FunctionResponsePart,
  type Part,
  type ResponseSchema,
  type TextPart,
} from "@google/generative-ai";
import { getTokenSnapshot, recordTokenUsage } from "@/lib/tokenTracker";
import { z } from "zod";

const requestSchema = z.object({
  topic: z.string().trim().min(2, "Topic must be at least 2 characters."),
  reportText: z
    .string()
    .trim()
    .min(50, "Report text must be at least 50 characters."),
});

const responseSchema = z.object({
  keyPartners: z.string().trim(),
  keyActivities: z.string().trim(),
  valuePropositions: z.string().trim(),
  customerRelationships: z.string().trim(),
  customerSegments: z.string().trim(),
  keyResources: z.string().trim(),
  channels: z.string().trim(),
  costStructure: z.string().trim(),
  revenueModel: z.string().trim(),
});

const PRIMARY_MAX_OUTPUT_TOKENS = 2500;
const COMPACT_MAX_OUTPUT_TOKENS = 1500;
const DEFAULT_TEMPERATURE = 0.4;

const CANVAS_KEYS = [
  "keyPartners",
  "keyActivities",
  "valuePropositions",
  "customerRelationships",
  "customerSegments",
  "keyResources",
  "channels",
  "costStructure",
  "revenueModel",
] as const;

const CANVAS_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    keyPartners: { type: SchemaType.STRING },
    keyActivities: { type: SchemaType.STRING },
    valuePropositions: { type: SchemaType.STRING },
    customerRelationships: { type: SchemaType.STRING },
    customerSegments: { type: SchemaType.STRING },
    keyResources: { type: SchemaType.STRING },
    channels: { type: SchemaType.STRING },
    costStructure: { type: SchemaType.STRING },
    revenueModel: { type: SchemaType.STRING },
  },
  required: [...CANVAS_KEYS],
};

const buildPrompt = (
  topic: string,
  reportText: string,
  { compact = false }: { compact?: boolean } = {},
) => `You are an expert venture analyst.
Summarize the following case study on "${topic}" into the Business Model Canvas fields.
Keep each field concise: up to ${compact ? "2" : "3"} short bullet fragments separated by newline characters, no more than ${
  compact ? "35" : "60"
} words total.
If information is missing, infer reasonable context from the narrative; avoid placeholders like "N/A".
Return only JSON — no commentary or markdown.

Case study:
"""
${reportText}
"""`;

const MAX_WORDS_PER_BLOCK = 120;
const wordLimiter = /\s+/;

const condenseReportText = (text: string): string => {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const words = block.split(wordLimiter);
      if (words.length <= MAX_WORDS_PER_BLOCK) {
        return block;
      }

      return `${words.slice(0, MAX_WORDS_PER_BLOCK).join(" ")} ...`;
    })
    .join("\n\n");
};

type ModelPayload = string | Record<string, unknown>;

const removeTrailingCommas = (input: string): string => {
  let result = "";
  let inString = false;
  let escaping = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escaping) {
      result += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaping = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (!inString && char === ",") {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) {
        j += 1;
      }
      const nextChar = input[j];
      if (nextChar === "}" || nextChar === "]") {
        i = j - 1;
        continue;
      }
    }

    result += char;
  }

  return result;
};

const sanitizeJsonText = (text: string): string => {
  let sanitized = text.replace(/```json|```/gi, "").trim();

  if (!sanitized.startsWith("{")) {
    const jsonSegment = sanitized.match(/\{[\s\S]*\}/);
    if (jsonSegment) {
      sanitized = jsonSegment[0];
    }
  }

  sanitized = sanitized.replace(/\r\n?/g, "\n");
  sanitized = sanitized.replace(/\u0000/g, "");
  sanitized = removeTrailingCommas(sanitized);

  return sanitized.trim();
};

const hasBalancedDelimiters = (json: string): boolean => {
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (const char of json) {
    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }

  return depth === 0 && !inString;
};

const isLikelyTruncated = (json: string): boolean => {
  const trimmed = json.trim();
  if (!trimmed) {
    return true;
  }

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return true;
  }

  return !hasBalancedDelimiters(trimmed);
};

const extractFromArgs = (value: unknown): ModelPayload | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if ("json" in record) {
      const nested = record.json;
      if (typeof nested === "string") {
        const trimmed = nested.trim();
        return trimmed ? trimmed : null;
      }
      if (nested && typeof nested === "object") {
        return nested as Record<string, unknown>;
      }
    }

    return Object.keys(record).length > 0 ? record : null;
  }

  return null;
};

const isTextPart = (part: Part): part is TextPart =>
  typeof (part as TextPart).text === "string";

const isFunctionCallPart = (part: Part): part is FunctionCallPart =>
  Boolean((part as FunctionCallPart).functionCall);

const isFunctionResponsePart = (part: Part): part is FunctionResponsePart =>
  Boolean((part as FunctionResponsePart).functionResponse);

const extractModelPayload = (
  aiResponse: EnhancedGenerateContentResponse,
): ModelPayload | null => {
  try {
    const primaryText = aiResponse.text();
    const trimmed = primaryText.trim();
    if (trimmed) {
      return trimmed;
    }
  } catch {
    // ignore blocked/empty text extraction
  }

  const functionCalls =
    typeof aiResponse.functionCalls === "function"
      ? aiResponse.functionCalls()
      : undefined;
  if (functionCalls) {
    for (const call of functionCalls) {
      const extracted = extractFromArgs(call.args);
      if (extracted) {
        return extracted;
      }
    }
  }

  for (const candidate of aiResponse.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (isTextPart(part)) {
        const trimmed = part.text.trim();
        if (trimmed) {
          return trimmed;
        }
      } else if (isFunctionCallPart(part)) {
        const extracted = extractFromArgs(part.functionCall.args);
        if (extracted) {
          return extracted;
        }
      } else if (isFunctionResponsePart(part)) {
        const extracted = extractFromArgs(part.functionResponse.response);
        if (extracted) {
          return extracted;
        }
      }
    }
  }

  return null;
};

export async function POST(req: NextRequest) {
  const apiKey = String(process.env.GOOGLE_GEMINI_API_KEY || "").trim();
  const modelName =
    process.env.GOOGLE_GEMINI_MODEL?.trim() || "models/gemini-2.5-flash";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GOOGLE_GEMINI_API_KEY." },
      { status: 500 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parseResult = requestSchema.safeParse(json);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { topic, reportText } = parseResult.data;
  const condensedReport = condenseReportText(reportText);

  const snapshotBefore = await getTokenSnapshot();
  if (snapshotBefore.remaining <= 0) {
    return NextResponse.json(
      {
        error:
          "Token allowance exhausted. Regenerate allowance before making new requests.",
        allowance: snapshotBefore.allowance,
        used: snapshotBefore.used,
        remaining: snapshotBefore.remaining,
      },
      { status: 429 },
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  type AttemptConfig = {
    compact: boolean;
    maxOutputTokens: number;
    label: "primary" | "compact";
  };

  const attemptConfigs: AttemptConfig[] = [
    {
      compact: false,
      maxOutputTokens: PRIMARY_MAX_OUTPUT_TOKENS,
      label: "primary",
    },
    {
      compact: true,
      maxOutputTokens: COMPACT_MAX_OUTPUT_TOKENS,
      label: "compact",
    },
  ];

  let availableTokens = snapshotBefore.remaining;
  let tokensUsedTotal = 0;
  let lastErrorMessage =
    "The AI response was not valid JSON. Please try generating the Business Model Canvas again.";
  let lastStatus = 502;

  const callModel = async (promptText: string, maxOutputTokens: number) => {
    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: DEFAULT_TEMPERATURE,
        maxOutputTokens,
        responseMimeType: "application/json",
        responseSchema: CANVAS_RESPONSE_SCHEMA,
      },
    });

    const tokensUsed = response.response.usageMetadata?.totalTokenCount ?? 0;
    return { aiResponse: response.response, tokensUsed };
  };

  try {
    for (const attempt of attemptConfigs) {
      if (availableTokens <= 0) {
        lastErrorMessage =
          "Token allowance exhausted while generating the Business Model Canvas. Please refresh your allowance and try again.";
        lastStatus = 429;
        break;
      }

      const maxTokensThisAttempt = Math.min(
        attempt.maxOutputTokens,
        availableTokens,
      );

      if (maxTokensThisAttempt <= 0) {
        continue;
      }

      const promptText = buildPrompt(topic, condensedReport, {
        compact: attempt.compact,
      });

      const { aiResponse, tokensUsed } = await callModel(
        promptText,
        maxTokensThisAttempt,
      );

      tokensUsedTotal += tokensUsed;
      availableTokens = Math.max(0, availableTokens - tokensUsed);

      const rawPayload = extractModelPayload(aiResponse);

      if (!rawPayload) {
        console.warn("AI returned empty response payload.", {
          attempt: attempt.label,
          response: aiResponse,
        });
        lastErrorMessage =
          attempt.compact
            ? "The AI returned an empty response. Please try generating the Business Model Canvas again."
            : "The AI returned an empty response. Retrying with a more concise prompt.";
        continue;
      }

      let parsedJson: unknown;

      if (typeof rawPayload === "string") {
        const sanitized = sanitizeJsonText(rawPayload);

        if (isLikelyTruncated(sanitized)) {
          const finishReason = aiResponse.candidates?.[0]?.finishReason;
          console.warn("Detected truncated Business Model Canvas response", {
            attempt: attempt.label,
            finishReason,
            sanitized,
          });
          lastErrorMessage =
            attempt.compact
              ? "The AI response was incomplete even after retrying. Please try again."
              : "The AI response looked incomplete. Retrying with a more concise prompt.";
          if (attempt.compact) {
            break;
          }
          continue;
        }

        try {
          parsedJson = JSON.parse(sanitized);
        } catch (error) {
          console.error("Failed to parse Business Model Canvas JSON", {
            attempt: attempt.label,
            error,
            sanitized,
          });
          lastErrorMessage =
            attempt.compact
              ? "The AI response was still invalid JSON after retrying. Please try again."
              : "The AI response was not valid JSON. Retrying with a more concise prompt.";
          if (attempt.compact) {
            break;
          }
          continue;
        }
      } else {
        parsedJson = rawPayload;
      }

      const canvasResult = responseSchema.safeParse(parsedJson);
      if (!canvasResult.success) {
        console.error("Invalid Business Model Canvas schema", {
          attempt: attempt.label,
          issues: canvasResult.error.issues,
          parsedJson,
        });
        lastErrorMessage =
          attempt.compact
            ? "The AI response was missing required Business Model Canvas fields even after retrying. Please try again."
            : "The AI response was missing required Business Model Canvas fields. Retrying with a more concise prompt.";
        if (attempt.compact) {
          break;
        }
        continue;
      }

      const snapshotAfter = await recordTokenUsage(
        tokensUsedTotal,
        `${topic} (Business Model Canvas)`,
      );

      return NextResponse.json({
        canvas: canvasResult.data,
        tokensUsed: tokensUsedTotal,
        allowance: snapshotAfter.allowance,
        tokensRemaining: snapshotAfter.remaining,
      });
    }

    if (tokensUsedTotal > 0) {
      const snapshotAfterFailure = await recordTokenUsage(
        tokensUsedTotal,
        `${topic} (Business Model Canvas - failed)`,
      );

      return NextResponse.json(
        {
          error: lastErrorMessage,
          allowance: snapshotAfterFailure.allowance,
          used: snapshotAfterFailure.used,
          remaining: snapshotAfterFailure.remaining,
        },
        { status: lastStatus },
      );
    }

    const snapshotAfterFailure = await getTokenSnapshot();

    return NextResponse.json(
      {
        error: lastErrorMessage,
        allowance: snapshotAfterFailure.allowance,
        used: snapshotAfterFailure.used,
        remaining: snapshotAfterFailure.remaining,
      },
      { status: lastStatus },
    );
  } catch (error) {
    console.error("Business Model Canvas generation failed", error);

    const snapshotAfterError =
      tokensUsedTotal > 0
        ? await recordTokenUsage(
            tokensUsedTotal,
            `${topic} (Business Model Canvas - failed)`,
          )
        : await getTokenSnapshot();

    const status =
      typeof (error as { status?: number } | undefined)?.status === "number"
        ? (error as { status: number }).status
        : 502;

    return NextResponse.json(
      {
        error:
          status === 400
            ? "Gemini rejected the request. Confirm your API key is valid and has access to the selected model."
            : "Business Model Canvas generation failed. Please try again later.",
        allowance: snapshotAfterError.allowance,
        used: snapshotAfterError.used,
        remaining: snapshotAfterError.remaining,
      },
      { status },
    );
  }
}
