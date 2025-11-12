"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import styles from "./page.module.css";
import ReactMarkdown from "react-markdown";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { BusinessModelCanvas } from "@/components/BusinessModelCanvas";
import type { BusinessModelCanvasData } from "@/components/BusinessModelCanvas";

import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

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

const buildCaseStudyText = (
  sections: Array<{ key: string; label: string }>,
  caseStudy: Record<string, string>,
  presentation?: string,
): string => {
  const sectionTexts = sections
    .map(({ key, label }) => {
      const sectionContent = caseStudy?.[key];

      if (!sectionContent) {
        return null;
      }

      return `${label}\n${sectionContent}`.trim();
    })
    .filter((value): value is string => Boolean(value));

  if (presentation) {
    sectionTexts.push(`Presentation\n${presentation.trim()}`);
  }

  return sectionTexts.join("\n\n");
};

export default function HomePage() {
  const [topic, setTopic] = useState("");
  const [data, setData] = useState<CaseStudyResponse | null>(null);
  const [sections, setSections] = useState(SECTION_ORDER);
  const [caseStudy, setCaseStudy] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [canvasData, setCanvasData] = useState<BusinessModelCanvasData | null>(
    null,
  );
  const [isGeneratingCanvas, setIsGeneratingCanvas] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.caseStudy) {
      setCaseStudy(data.caseStudy);
      setSections(SECTION_ORDER);
    } else {
      setCaseStudy({});
      setSections(SECTION_ORDER);
    }
  }, [data]);

  useEffect(() => {
    setCanvasData(null);
    setCanvasError(null);
  }, [data?.topic]);

  const caseStudyText = useMemo(
    () => buildCaseStudyText(sections, caseStudy, data?.presentation),
    [sections, caseStudy, data?.presentation],
  );

  const handleEdit = (sectionKey: string, value: string | undefined) => {
    setCaseStudy((prev) => ({ ...prev, [sectionKey]: value ?? "" }));
  };

  const handleDragEnd = (result: DropResult) => {
    const destination = result.destination;
    if (!destination) return;
    setSections((prev) => {
      const reordered = [...prev];
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(destination.index, 0, removed);
      return reordered;
    });
  };

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
        setCanvasData(null);
        setCanvasError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error.");
        setData(null);
      }
    });
  };

  const handleExport = async () => {
    if (!data) {
      setExportError("Generate the case study before exporting to Google Docs.");
      return;
    }

    if (!caseStudyText.trim()) {
      setExportError("Generate the case study before exporting to Google Docs.");
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const orderedData = sections.map(({ key, label }) => ({
        section: key,
        label,
        content: caseStudy[key] ?? "",
      }));

      const response = await fetch("/api/createDoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${data.topic} Case Study`,
          caseStudyData: orderedData,
          presentation: data.presentation ?? undefined,
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

  const handleGenerateCanvas = async () => {
    if (!data) {
      setCanvasError("Generate the case study before building the Business Model Canvas.");
      return;
    }

    if (!caseStudyText.trim()) {
      setCanvasError("Add case study content before building the Business Model Canvas.");
      return;
    }

    setIsGeneratingCanvas(true);
    setCanvasError(null);

    try {
      const response = await fetch("/api/generateCanvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: data.topic,
          reportText: caseStudyText,
        }),
      });

      const payload = (await response.json()) as {
        canvas?: BusinessModelCanvasData;
        tokensUsed?: number;
        allowance?: number;
        tokensRemaining?: number;
        error?: unknown;
      };

      if (!response.ok || !payload?.canvas) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Failed to generate the Business Model Canvas.";
        throw new Error(message);
      }

      setCanvasData(payload.canvas);

      setData((prev) =>
        prev
          ? {
              ...prev,
              allowance: payload.allowance ?? prev.allowance,
              tokensRemaining: payload.tokensRemaining ?? prev.tokensRemaining,
              tokensUsed: payload.tokensUsed ?? prev.tokensUsed,
            }
          : prev,
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Business Model Canvas generation failed.";
      setCanvasError(message);
    } finally {
      setIsGeneratingCanvas(false);
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
        <section className={styles.results} data-color-mode="light">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="sections">
              {(droppableProvided) => (
                <div
                  ref={droppableProvided.innerRef}
                  {...droppableProvided.droppableProps}
                  className={styles.droppable}
                >
                  {sections.map(({ key, label }, index) => (
                    <Draggable key={key} draggableId={key} index={index}>
                      {(draggableProvided) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          className={styles.sectionCard}
                        >
                          <div
                            className={styles.sectionHeader}
                            {...draggableProvided.dragHandleProps}
                          >
                            <h2>{label}</h2>
                            <span className={styles.dragHint}>Drag to reorder</span>
                          </div>
                          <MDEditor
                            value={caseStudy[key] ?? ""}
                            onChange={(val) => handleEdit(key, val)}
                            height={250}
                            preview="live"
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {droppableProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          {data.presentation ? (
            <div className={styles.presentation}>
              <h2>Presentation Outline</h2>
              <ReactMarkdown>{data.presentation}</ReactMarkdown>
            </div>
          ) : null}
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
        <button
          type="button"
          className={styles.canvasButton}
          onClick={handleGenerateCanvas}
          disabled={isGeneratingCanvas || !data}
        >
          {isGeneratingCanvas
            ? "Generating Canvas..."
            : "Generate Business Model Canvas"}
        </button>
      </div>
      {exportError ? <p className={styles.exportError}>{exportError}</p> : null}
      {canvasError ? <p className={styles.canvasError}>{canvasError}</p> : null}
      {canvasData && data ? (
        <section className={styles.canvasSection}>
          <h2 className={styles.canvasTitle}>Business Model Canvas</h2>
          <BusinessModelCanvas topic={data.topic} data={canvasData} />
        </section>
      ) : null}
    </main>
  );
}
