'use client';

import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import styles from "./BusinessModelCanvas.module.css";

export type BusinessModelCanvasData = {
  keyPartners: string;
  keyActivities: string;
  valuePropositions: string;
  customerRelationships: string;
  customerSegments: string;
  keyResources: string;
  channels: string;
  costStructure: string;
  revenueModel: string;
};

type BusinessModelCanvasProps = {
  topic: string;
  data: BusinessModelCanvasData;
};

const splitIntoBulletItems = (value: string): string[] =>
  value
    .split(/(?:\r?\n|[;\u2022])/)
    .map((entry) => entry.replace(/^[\-\u2022]+/, "").trim())
    .filter(Boolean);

const renderCellContent = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return <p />;
  }

  const items = splitIntoBulletItems(trimmed);

  if (items.length <= 1) {
    return <p>{trimmed}</p>;
  }

  return (
    <ul className={styles.bulletList}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
};

export function BusinessModelCanvas({ topic, data }: BusinessModelCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const filename = useMemo(() => {
    const safeTopic = topic.replace(/[\\/:*?"<>|]+/g, "-").trim();
    return safeTopic ? `${safeTopic}_Business_Model_Canvas.png` : "Business_Model_Canvas.png";
  }, [topic]);

  const handleDownload = async () => {
    if (!frameRef.current) {
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const canvas = await html2canvas(frameRef.current, {
        backgroundColor: "#0a1d37",
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to download Business Model Canvas", error);
      setDownloadError("Failed to export the canvas. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div ref={frameRef} className={styles.canvasFrame}>
        <div className={styles.grid}>
          <div className={styles.gridHeader}>
            <span>THE BUSINESS MODEL CANVAS</span>
            <span>
              COMPANY:&nbsp;
              {topic.trim() ? topic : "__________________"}
            </span>
          </div>

          <div className={`${styles.gridCell} ${styles.keyPartners}`}>
            <h3>KEY PARTNERS</h3>
            {renderCellContent(data.keyPartners)}
          </div>

          <div className={`${styles.gridCell} ${styles.keyActivities}`}>
            <h3>KEY ACTIVITIES</h3>
            {renderCellContent(data.keyActivities)}
          </div>

          <div className={`${styles.gridCell} ${styles.valuePropositions}`}>
            <h3>VALUE PROPOSITIONS</h3>
            {renderCellContent(data.valuePropositions)}
          </div>

          <div className={`${styles.gridCell} ${styles.customerRelationships}`}>
            <h3>CUSTOMER RELATIONSHIPS</h3>
            {renderCellContent(data.customerRelationships)}
          </div>

          <div className={`${styles.gridCell} ${styles.customerSegments}`}>
            <h3>CUSTOMER SEGMENTS</h3>
            {renderCellContent(data.customerSegments)}
          </div>

          <div className={`${styles.gridCell} ${styles.keyResources}`}>
            <h3>KEY RESOURCES</h3>
            {renderCellContent(data.keyResources)}
          </div>

          <div className={`${styles.gridCell} ${styles.channels}`}>
            <h3>CHANNELS</h3>
            {renderCellContent(data.channels)}
          </div>

          <div className={`${styles.gridCell} ${styles.costStructure}`}>
            <h3>COST STRUCTURE</h3>
            {renderCellContent(data.costStructure)}
          </div>

          <div className={`${styles.gridCell} ${styles.revenueModel}`}>
            <h3>REVENUE MODEL</h3>
            {renderCellContent(data.revenueModel)}
          </div>
        </div>
      </div>

      <div className={styles.downloadRow}>
        <button
          type="button"
          className={styles.downloadButton}
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? "Preparing PNG..." : "Download as PNG"}
        </button>
        {downloadError ? (
          <span className={styles.error}>{downloadError}</span>
        ) : isDownloading ? (
          <span className={styles.status}>Rendering high-resolution image...</span>
        ) : null}
      </div>
    </div>
  );
}
