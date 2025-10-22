"use client";

import { FormEvent, useState, useTransition } from "react";
import styles from "./page.module.css";
import ReactMarkdown from "react-markdown";

type CaseStudyResponse = {
  topic: string;
  caseStudy: Record<string, string>;
  presentation?: string;
  tokensUsed: number;
  allowance: number;
  tokensRemaining: number;
};

const SECTION_ORDER: Array<{ key: string; label: string }> = [
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

const buildCaseStudyText = (payload: CaseStudyResponse): string => {
  const sectionTexts = SECTION_ORDER.map(({ key, label }) => {
    const sectionContent = payload.caseStudy?.[key];

    if (!sectionContent) {
      return null;
    }

    return `${label}\n${sectionContent}`.trim();
  }).filter((value): value is string => Boolean(value));

  if (payload.presentation) {
    sectionTexts.push(`Presentation\n${payload.presentation.trim()}`);
  }

  return sectionTexts.join("\n\n");
};

export default function HomePage() {
  const [topic, setTopic] = useState("");
  const [data, setData] = useState<CaseStudyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const caseStudyText = data ? buildCaseStudyText(data) : "";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic }),
        });

        const payload = await response.json();
        if (!response.ok) {
          const message =
            typeof payload.error === "string"
              ? payload.error
              : "Generation failed. Please try again.";

          setError(message);
          setData(null);
          return;
        }

        setData(payload as CaseStudyResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
        setData(null);
      }
    });
  };

  const handleExport = async () => {
    if (!data || !caseStudyText.trim()) {
      setExportError("Generate the case study before exporting to Google Docs.");
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const response = await fetch("/api/createDoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data.caseStudy,
          title: `${data.topic} Case Study`,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.url) {
        const errorMessage = result?.error ?? "Failed to create Google Doc.";
        throw new Error(errorMessage);
      }

      window.open(result.url as string, "_blank");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed.";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  };

  const tokensRemaining = data?.tokensRemaining;
  const allowance = data?.allowance ?? 50000;
  const tokensUsed = data?.tokensUsed;

  return (
    <main className={styles.main}>
      <section className={styles.header}>
        <h1>Case Study Generator</h1>
        <p>
          Enter a topic. The app drafts a structured case study and tracks your
          Gemini Flash token budget (50k tokens hobby allowance).
        </p>
      </section>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>
          <span>Topic</span>
          <input
            className={styles.input}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. Figma in entrepreneurship"
            required
            minLength={2}
          />
        </label>
        <button className={styles.button} type="submit" disabled={isPending}>
          {isPending ? "Generating..." : "Generate Case Study"}
        </button>
        {error ? <p className={styles.error}>{error}</p> : null}
      </form>

      {tokensRemaining !== undefined ? (
        <section className={styles.budget}>
          <div>
            <span className={styles.budgetLabel}>Tokens remaining</span>
            <span className={styles.budgetValue}>{tokensRemaining}</span>
          </div>
          <div>
            <span className={styles.budgetLabel}>Tokens used this request</span>
            <span className={styles.budgetValue}>{tokensUsed ?? 0}</span>
          </div>
          <div>
            <span className={styles.budgetLabel}>Allowance</span>
            <span className={styles.budgetValue}>{allowance}</span>
          </div>
        </section>
      ) : null}

      {data ? (
        <section className={styles.results}>
          {SECTION_ORDER.map(({ key, label }) => {
            const text = data.caseStudy?.[key];
            if (!text) return null;

            return (
              <details key={key} className={styles.detail} open={key === "titleAbstract"}>
                <summary>{label}</summary>
                <ReactMarkdown>{text}</ReactMarkdown>
              </details>
            );
          })}
        </section>
      ) : null}

      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleExport}
          disabled={isExporting || !data}
        >
          {isExporting ? "Creating Google Doc..." : "Create Google Doc"}
        </button>
        {exportError ? <p className={styles.exportError}>{exportError}</p> : null}
      </div>
    </main>
  );
}
