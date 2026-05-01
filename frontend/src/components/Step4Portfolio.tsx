// (Applicant) step 4 portifolio 
import { InfoCard } from "./InfoCard";
import { FileUpload } from "./FileUpload";

interface Step4Props {
  data: {
    files: File[];
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step4Portfolio({ data, onUpdate, onNext, onBack }: Step4Props) {
  const hasFile = data.files.length > 0;

  /* (FigmaMake, 2025) */
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
          Step 4 of 6 — Portfolio
        </div>
        <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Upload a portfolio showcasing achievements, creativity, and community contribution.
          A portfolio upload is required to continue.
        </div>
      </div>

      {/* Requirements */}
      <div className="step4-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <InfoCard type="info" title="Format Requirements">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Slideshow presentation (PPTX) or PDF document</li>
            <li>Include supporting evidence (photos, certificates, letters)</li>
            <li>Clear organization with labeled sections</li>
            <li>Professional formatting and design</li>
          </ul>
        </InfoCard>

        <InfoCard type="warning" title="Content Requirements">
          <p style={{ marginTop: 0, marginBottom: 10 }}>
            Your portfolio must address:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>
              <strong>What did you achieve?</strong> — Specific accomplishments and outcomes
            </li>
            <li>
              <strong>What do you offer AUBH?</strong> — Unique value and contributions
            </li>
            <li>
              <strong>What makes you stand out?</strong> — Distinctive qualities and experiences
            </li>
          </ul>
        </InfoCard>
      </div>

      {/* Upload */}
      <div className="card" style={{ width: "100%" }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 14 }}>
          Upload Your Portfolio <span style={{ color: "#ef4444", fontSize: 14 }}>*</span>
        </div>

        <FileUpload
          label="Portfolio Document"
          description="Upload your portfolio as a PDF or PowerPoint presentation."
          acceptedFormats=".pdf,.pptx,.ppt"
          maxSize={10}
          multiple={false}
          files={data.files}
          onFilesChange={(files) => onUpdate({ files })}
        />

        {!hasFile && (
          <div style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.07)",
            color: "#991b1b",
            fontWeight: 700,
            fontSize: 13,
          }}>
            Portfolio upload is required to continue to the next step.
          </div>
        )}

        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(37, 99, 235, 0.25)",
            background: "rgba(37, 99, 235, 0.08)",
            color: "var(--navy)",
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Tips for a strong portfolio:</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", lineHeight: 1.7 }}>
            <li>Start with a clear introduction and table of contents</li>
            <li>Use high-quality images and evidence</li>
            <li>Provide context and impact for each achievement</li>
            <li>Quantify results where possible (metrics, numbers, outcomes)</li>
            <li>Include testimonials or recommendations if available</li>
            <li>End with a summary of how you'll contribute to AUBH</li>
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="ghost-btn" onClick={onBack}>
          ← Back
        </button>

        <button
          className="primary-btn"
          type="button"
          onClick={onNext}
          disabled={!hasFile}
          style={!hasFile ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
          title={!hasFile ? "Upload your portfolio to continue" : undefined}
        >
          Next →
        </button>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .step4-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
