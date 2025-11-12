import { NextResponse } from "next/server";

type SectionDescriptor = {
  key: string;
  label: string;
};

const DEFAULT_SECTION_ORDER: SectionDescriptor[] = [
  { key: "titleAbstract", label: "Title & Abstract" },
  { key: "introduction", label: "Introduction" },
  { key: "problemStatement", label: "Problem Statement" },
  { key: "solutionInnovation", label: "Solution / Innovation" },
  { key: "businessModel", label: "Business Model" },
  { key: "challengesRisks", label: "Challenges & Risks" },
  { key: "growthAchievements", label: "Growth & Achievements" },
  { key: "impactFuture", label: "Impact & Future Plans" },
  { key: "conclusion", label: "Conclusion" },
  { key: "references", label: "References" },
];

type SectionPayload = {
  section: string;
  label?: string;
  content?: string;
};

type CreateDocPayload = {
  title: string;
  presentation?: string;
  caseStudyData?: SectionPayload[];
  [key: string]: unknown;
};

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as CreateDocPayload;

    if (!payload?.title || typeof payload.title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const caseStudyData = Array.isArray(payload.caseStudyData)
      ? payload.caseStudyData
      : []; // If payload.caseStudyData is not an array, default to an empty array to prevent generated text.

    const normalizedCaseStudy = caseStudyData.reduce<Record<string, string>>(
      (acc, { section, content }) => {
        if (section) {
          acc[section] = content ?? "";
        }
        return acc;
      },
      {},
    );

    const requestBody: Record<string, unknown> = {
      title: payload.title,
      ...normalizedCaseStudy, // Spread the normalized case study data directly
      presentation:
        typeof payload.presentation === "string"
          ? payload.presentation
          : undefined,
    };

    const response = await fetch(
      "https://script.google.com/macros/s/AKfycbwskchZcbHQltXvvNuVWCQekybE3AUvS4TMTOUejciT23p-wP8Fju6GsT15s3p-NYA/exec",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
    );

    const data = await response.json();

    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
