import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PROMPT_TEMPLATES } from "@/lib/prompts";
import { getTokenSnapshot, recordTokenUsage } from "@/lib/tokenTracker";
import { z } from "zod";

const requestSchema = z.object({
  topic: z.string().trim().min(2, "Topic must be at least 2 characters long."),
});

const MAX_OUTPUT_TOKENS = 5000;
const DEFAULT_TEMPERATURE = 0.7;

export async function POST(req: NextRequest) {
  const apiKey = String(process.env.GOOGLE_GEMINI_API_KEY || '').trim();
  const modelName =
    process.env.GOOGLE_GEMINI_MODEL?.trim() || "models/gemini-2.5-flash";
  const apiVersion = process.env.GOOGLE_GEMINI_API_VERSION?.trim() || "v1";
  console.log("API Key:", process.env.GOOGLE_GEMINI_API_KEY);

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GOOGLE_GEMINI_API_KEY." },
      { status: 500 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = requestSchema.safeParse(json);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { topic } = result.data;

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
      { status: 429 }
    );
  }

  const allowedMaxTokens = Math.min(MAX_OUTPUT_TOKENS, snapshotBefore.remaining);

const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const responses = await Promise.all(
      PROMPT_TEMPLATES.map(async ({ section, title, buildPrompt }) => {
        const response = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [{ text: buildPrompt(topic) }],
            },
          ],
          generationConfig: {
            temperature: DEFAULT_TEMPERATURE,
            maxOutputTokens: allowedMaxTokens,
          },
        });

        const text = response.response.text().trim();
        const usage = response.response.usageMetadata;
        const tokensUsed = usage?.totalTokenCount ?? 0;

        return { section, title, text, tokensUsed };
      })
    );

    const totalTokensUsed = responses.reduce(
      (acc, response) => acc + response.tokensUsed,
      0
    );

    const caseStudy = Object.fromEntries(
      responses
        .filter(({ section }) => section !== "presentation")
        .map(({ section, text }) => [section, text])
    );

    const presentation = responses.find(
      ({ section }) => section === "presentation"
    )?.text;

    const snapshotAfter = await recordTokenUsage(totalTokensUsed, topic);

    return NextResponse.json({
      topic,
      caseStudy,
      presentation,
      tokensUsed: totalTokensUsed,
      allowance: snapshotAfter.allowance,
      tokensRemaining: snapshotAfter.remaining,
    });
  } catch (error) {
    console.error("Gemini generation failed", error);

    const status =
      typeof (error as { status?: number } | undefined)?.status === "number"
        ? (error as { status: number }).status
        : 502;

    let message = "Generation failed. Please try again later.";
    if (status === 400) {
      message =
        "Gemini rejected the request. Confirm your API key is valid and has access to the selected model.";
    }

    const snapshotAfterError = await getTokenSnapshot();

    return NextResponse.json(
      {
        error: message,
        allowance: snapshotAfterError.allowance,
        used: snapshotAfterError.used,
        remaining: snapshotAfterError.remaining,
      },
      { status }
    );
  }
}
