import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Receive the full case study object from frontend
    const caseStudyData = await req.json();

    // Validate required fields (optional but recommended)
    if (!caseStudyData.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Send to your Apps Script Web App
    const response = await fetch(
      "https://script.google.com/macros/s/AKfycbwskchZcbHQltXvvNuVWCQekybE3AUvS4TMTOUejciT23p-wP8Fju6GsT15s3p-NYA/exec",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(caseStudyData), // send full structured object
      }
    );

    const data = await response.json();

    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
