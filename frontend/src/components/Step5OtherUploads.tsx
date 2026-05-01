// (Applicant) Step 5 - other uploads 
import React from "react";
import { FileUpload } from "./FileUpload";

interface Step5Props {
  data: {
    transcript: File[];
    ielts: File[];
    cvOptional: File[];
    statementOptional: File[];
    additional: File[];
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step5OtherUploads({ data, onUpdate, onNext, onBack }: Step5Props) {
    /* (FigmaMake, 2025) */

  const canProceed = data.transcript.length > 0 && data.ielts.length > 0;

  const Tag = ({
    text,
    variant,
  }: {
    text: string;
    variant: "required" | "optional";
  }) => {
    const isReq = variant === "required";
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 999,
          fontWeight: 900,
          fontSize: 12,
          letterSpacing: "0.02em",
          border: `1px solid ${isReq ? "rgba(239,68,68,0.30)" : "rgba(100,116,139,0.25)"}`,
          background: isReq ? "rgba(239,68,68,0.10)" : "rgba(15,23,42,0.04)",
          color: isReq ? "#991b1b" : "var(--muted)",
        }}
      >
        {text}
      </span>
    );
  };

  const SectionCard = ({
    title,
    subtitle,
    tag,
    accent,
    children,
  }: {
    title: string;
    subtitle?: string;
    tag: React.ReactNode;
    accent: "red" | "gray";
    children: React.ReactNode;
  }) => (
    <div
      className="card"
      style={{
        width: "100%",
        border: `2px solid ${accent === "red" ? "rgba(239,68,68,0.22)" : "rgba(229,231,235,1)"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        {tag}
        <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
      </div>

      {subtitle ? (
        <div style={{ color: "var(--muted)", marginBottom: 16, lineHeight: 1.6 }}>{subtitle}</div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>{children}</div>
    </div>
  );

  const Divider = () => <div style={{ borderTop: "1px solid var(--border)" }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
          Step 5 of 6 — Required & Optional Documents
        </div>
        <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Upload your official verification documents below.
        </div>
      </div>

      {/* Mandatory */}
      <SectionCard
        title="Mandatory Documents"
        tag={<Tag text="REQUIRED" variant="required" />}
        accent="red"
        subtitle="These are required to continue."
      >
        <FileUpload
          label="Official Transcript *"
          description="Your latest school/university transcript."
          acceptedFormats=".pdf"
          maxSize={10}
          multiple={false}
          files={data.transcript}
          onFilesChange={(files) => onUpdate({ ...data, transcript: files })}
        />

        <Divider />

        <FileUpload
          label="IELTS Test Report Form (TRF) *"
          description="Upload your IELTS score card (PDF image or scanned PDF)."
          acceptedFormats=".pdf,.jpg,.jpeg,.png"
          maxSize={10}
          multiple={false}
          files={data.ielts}
          onFilesChange={(files) => onUpdate({ ...data, ielts: files })}
        />
      </SectionCard>

      {/* Optional */}
      <SectionCard
        title="Optional Documents"
        tag={<Tag text="OPTIONAL" variant="optional" />}
        accent="gray"
        subtitle="Only if you want to strengthen your application."
      >
        <FileUpload
          label="CV / Resume (Optional)"
          description="Your structured resume from Step 3 is already enough. Uploading your CV is optional."
          acceptedFormats=".pdf,.docx,.doc"
          maxSize={10}
          multiple={false}
          files={data.cvOptional}
          onFilesChange={(files) => onUpdate({ ...data, cvOptional: files })}
        />

        <Divider />

        <FileUpload
          label="Personal Statement Document (Optional)"
          description="You do NOT need to upload a file. The guided personal statement you wrote earlier is fully sufficient. Only upload this if you already have a polished PDF version."
          acceptedFormats=".pdf,.docx,.doc"
          maxSize={10}
          multiple={false}
          files={data.statementOptional}
          onFilesChange={(files) => onUpdate({ ...data, statementOptional: files })}
        />

        <Divider />

        <FileUpload
          label="Additional Materials (Optional)"
          description="Examples: recommendation letters, certificates, extra evidence."
          acceptedFormats=".pdf,.docx,.doc,.jpg,.jpeg,.png"
          maxSize={10}
          multiple={true}
          files={data.additional}
          onFilesChange={(files) => onUpdate({ ...data, additional: files })}
        />
      </SectionCard>

      {!canProceed && (
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.08)",
            color: "#991b1b",
            fontWeight: 700,
            lineHeight: 1.6,
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Required documents missing</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            {data.transcript.length === 0 && <li>Official Transcript — not yet uploaded</li>}
            {data.ielts.length === 0 && <li>IELTS Test Report Form — not yet uploaded</li>}
          </ul>
          <div style={{ marginTop: 6, fontSize: 13 }}>Please upload both documents above before continuing.</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="ghost-btn" onClick={onBack}>
          ← Back
        </button>

        <button
          className="primary-btn"
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          style={!canProceed ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
          title={!canProceed ? "Upload both required documents to continue" : undefined}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
