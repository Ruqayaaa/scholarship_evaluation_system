import { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

async function extractPdfText(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group by y-coordinate so items on the same visual line are joined together
    const yMap = new Map();
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      // Round to nearest 2 units to tolerate sub-pixel differences
      const y = Math.round((item.transform?.[5] ?? 0) / 2) * 2;
      if (!yMap.has(y)) yMap.set(y, []);
      yMap.get(y).push(item.str);
    }

    // PDF y-axis increases upward, so descending sort = top-to-bottom reading order
    const pageLines = [...yMap.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, parts]) => parts.join("").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    fullText += pageLines.join("\n") + "\n\n";
    onProgress(i / pdf.numPages);
  }

  return fullText.trim();
}

export default function OcrUploader({ onExtract, buttonLabel = "Upload Document (OCR)" }) {
  const fileRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastFile, setLastFile] = useState("");
  const [ocrError, setOcrError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastFile(file.name);
    setIsProcessing(true);
    setProgress(0);
    setOcrError("");

    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const text = isPdf ? await extractPdfText(file, setProgress) : "";
      if (!text) {
        setOcrError("No text could be extracted. Try a clearer image or a text-based PDF.");
      } else {
        onExtract(text);
      }
    } catch (err) {
      console.error("OCR error:", err);
      setOcrError("Extraction failed. Please try again with a different file.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const pct = Math.round(progress * 100);

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      <button
        type="button"
        disabled={isProcessing}
        onClick={() => { setOcrError(""); fileRef.current?.click(); }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 18px",
          backgroundColor: isProcessing ? "#94a3b8" : "#f0f4ff",
          color: isProcessing ? "#fff" : "#1A3175",
          border: "1.5px solid #1A3175",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: isProcessing ? "not-allowed" : "pointer",
          transition: "background 0.15s",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {isProcessing ? `Extracting text… ${pct}%` : buttonLabel}
      </button>

      {isProcessing && (
        <div style={{ marginTop: "8px", height: "4px", backgroundColor: "#e5e7eb", borderRadius: "4px", overflow: "hidden", width: "260px" }}>
          <div style={{ height: "100%", width: `${pct}%`, backgroundColor: "#1A3175", borderRadius: "4px", transition: "width 0.3s" }} />
        </div>
      )}

      {!isProcessing && lastFile && !ocrError && (
        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#16a34a" }}>✓ Text extracted from {lastFile}</p>
      )}

      {ocrError && (
        <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#dc2626" }}>{ocrError}</p>
      )}
    </div>
  );
}
