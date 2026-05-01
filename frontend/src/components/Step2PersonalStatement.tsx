// Step 2 of the application process where applicants fill out their personal statement; includes an optional PDF upload feature that extracts text and distributes it into structured sections for easier editing and review; includes a live word count with validation against a 1000-word limit; applicants can preview their combined statement before proceeding to the next step.
import { useMemo, useState } from "react";
import OcrUploader from "./OcrUploader";

/* This component needs:
- the different items for personal statement 
- updates, next, back, saving draft 
*/
interface Step2Props {
  data: {
    valuesGoals: string;
    whyMajor: string;
    interests: string;
    summary: string;
    uploadedFile: File[];
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  onSaveDraft: () => void;
}

// different sections 
type SectionKey = "valuesGoals" | "whyMajor" | "interests" | "summary";

// Route each paragraph to the most relevant section using keyword scoring.
// valuesGoals  → "Interests & Values"
// whyMajor     → "Academic Commitment"
// interests    → "Clarity of Vision"
// summary      → "Closing Summary"
const SECTION_KEYWORDS: Record<string, string[]> = {
  valuesGoals: [
    "interest", "passion", "value", "believe", "love", "care", "dedicated",
    "committed", "motivated", "driven", "enthusiast", "community", "service",
    "inspired", "meaningful", "purpose",
  ],
  whyMajor: [
    "academic", "study", "gpa", "grade", "course", "degree", "major",
    "university", "research", "scholar", "achievement", "honour", "honor",
    "curriculum", "programme", "field", "discipline", "professor",
  ],
  interests: [
    "future", "goal", "vision", "plan", "aspire", "aim", "career", "hope",
    "five year", "ten year", "contribute", "impact", "see myself", "pursue",
    "intend", "ambition", "opportunity",
  ],
  summary: [
    "conclude", "in conclusion", "ultimately", "stand out", "confident",
    "ready", "finally", "overall", "therefore", "thus", "grateful",
    "appreciate", "thank", "look forward",
  ],
};

//adding text to the different sections 
function distributeText(raw: string): { valuesGoals: string; whyMajor: string; interests: string; summary: string } {
  const paragraphs = raw
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return { valuesGoals: "", whyMajor: "", interests: "", summary: "" };
  if (paragraphs.length === 1) return { valuesGoals: paragraphs[0], whyMajor: "", interests: "", summary: "" };

  const buckets: Record<string, string[]> = { valuesGoals: [], whyMajor: [], interests: [], summary: [] };

  // Last paragraph almost always closes the statement
  buckets.summary.push(paragraphs[paragraphs.length - 1]);

  for (let i = 0; i < paragraphs.length - 1; i++) {
    const lower = paragraphs[i].toLowerCase();
    let bestKey = "valuesGoals";
    let bestScore = 0;

    for (const [key, words] of Object.entries(SECTION_KEYWORDS)) {
      const score = words.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; bestKey = key; }
    }

    buckets[bestKey].push(paragraphs[i]);
  }

  return {
    valuesGoals: buckets.valuesGoals.join("\n\n"),
    whyMajor:    buckets.whyMajor.join("\n\n"),
    interests:   buckets.interests.join("\n\n"),
    summary:     buckets.summary.join("\n\n"),
  };
}


/* (FigmaMake 2025) */
type SectionComponentProps = {
  k: SectionKey;
  title: string;
  example: string;
  placeholder: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
};

function Section({ title, example, placeholder, value, isOpen, onToggle, onChange }: SectionComponentProps) {
  const done = String(value).trim().length > 0;
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, background: "rgba(255,255,255,0.96)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: done ? "#16a34a" : "#cbd5e1", boxShadow: done ? "0 0 0 4px rgba(22,163,74,0.12)" : "none" }} />
          <span style={{ fontWeight: 900, color: "var(--navy)" }}>{title}</span>
        </div>
        <span style={{ color: "var(--muted)", fontWeight: 800 }}>{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
            <span style={{ fontWeight: 800 }}>Example:</span> {example}
          </div>
          <div className="input-wrap" style={{ alignItems: "stretch" }}>
            <textarea className="input" style={{ minHeight: 150, resize: "vertical" }} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}

export function Step2PersonalStatement({ data, onUpdate, onNext, onBack, onSaveDraft }: Step2Props) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    valuesGoals: true,
    whyMajor: false,
    interests: false,
    summary: false,
  });

  const [ocrText, setOcrText] = useState("");

  const handleChange = (field: SectionKey, value: string) => {
    onUpdate({ ...data, [field]: value });
  };

  const wordCount = useMemo(() => {
    const textOnly = [data.valuesGoals, data.whyMajor, data.interests, data.summary].join(" ");
    return textOnly.split(/\s+/).filter(Boolean).length;
  }, [data.valuesGoals, data.whyMajor, data.interests, data.summary]);

  const isOverLimit = wordCount > 1000;
  const sectionsFilledCount = [data.valuesGoals, data.whyMajor, data.interests, data.summary]
    .filter((v) => v.trim().length > 0).length;
  const canContinue = !isOverLimit && sectionsFilledCount >= 4;
  const toggle = (k: SectionKey) => setOpenSections((p) => ({ ...p, [k]: !p[k] }));

  function fillSectionsFromOcr() {
    const distributed = distributeText(ocrText);
    onUpdate({ ...data, ...distributed });
    setOpenSections({ valuesGoals: true, whyMajor: true, interests: true, summary: true });
  }

  const SECTIONS: { k: SectionKey; title: string; example: string; placeholder: string }[] = [
    {
      k: "valuesGoals",
      title: "Interests & Values",
      example: '"I am deeply passionate about environmental sustainability and driven by the value of making technology accessible to underserved communities."',
      placeholder: "Describe your personal interests, passions, and core values. What topics or causes motivate you? What principles guide your decisions?",
    },
    {
      k: "whyMajor",
      title: "Academic Commitment",
      example: '"Maintaining a 3.9 GPA while taking advanced coursework in data science reflects my dedication to academic excellence and continuous learning."',
      placeholder: "Describe your academic achievements, dedication to learning, and scholarly pursuits. How have you demonstrated commitment to your field of study?",
    },
    {
      k: "interests",
      title: "Clarity of Vision",
      example: '"In five years, I see myself leading a team developing AI-driven healthcare diagnostics in Bahrain, bridging the gap between technology and public health."',
      placeholder: "Explain your clear vision for the future. Where do you see yourself in 5–10 years? How does this program prepare you for that path?",
    },
    {
      k: "summary",
      title: "Closing Summary",
      example: '"My combination of technical skills, community leadership, and unwavering dedication makes me confident I will contribute meaningfully to this program."',
      placeholder: "End with a strong, well-organized summary of why you stand out and what you will contribute to the program and community.",
    },
  ];


  const PreviewModal = () => (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 580, maxHeight: "70vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Personal Statement Preview</div>
          <button type="button" className="ghost-btn" onClick={() => setIsPreviewOpen(false)}>Close</button>
        </div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
          {SECTIONS.map(({ k, title }) =>
            data[k] ? (
              <div key={k}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>{title}</div>
                <div style={{ whiteSpace: "pre-wrap", color: "var(--navy)", lineHeight: 1.7 }}>{data[k]}</div>
              </div>
            ) : null
          )}
          {!data.valuesGoals && !data.whyMajor && !data.interests && !data.summary && (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: "22px 0" }}>Start filling out the sections to preview your statement.</div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Step 2 of 6 — Personal Statement</div>
        <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Fill in each section below, or upload your existing personal statement to extract text automatically.
          Scored on: Interests & Values, Academic Commitment, Clarity of Vision, Organization, and Language Quality.
        </div>
      </div>

      {/* OCR Upload Card */}
      <div className="card" style={{ width: "100%" }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Upload & Extract Text (PDF only)</div>
        <div style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
          Have an existing personal statement? Upload a <strong>PDF file</strong> — the text will be extracted so you can review and fill the sections below. Only text-based PDFs are supported.
        </div>

        <OcrUploader buttonLabel="Upload PDF & Extract Text" onExtract={(text: string) => setOcrText(text)} />

        {ocrText && (
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>
              Extracted text — review and edit, then click Fill Sections:
            </label>
            <div className="input-wrap" style={{ alignItems: "stretch" }}>
              <textarea
                className="input"
                style={{ minHeight: 140, resize: "vertical" }}
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={fillSectionsFromOcr}
                className="primary-btn"
              >
                Fill Sections from Extracted Text
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Structured Sections */}
      <div className="card" style={{ width: "100%" }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Structure Your Statement</div>
        <div style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
          All four sections are required. Your content will be combined and evaluated by AI.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SECTIONS.map((s) => (
            <Section
              key={s.k}
              k={s.k}
              title={s.title}
              example={s.example}
              placeholder={s.placeholder}
              value={data[s.k]}
              isOpen={openSections[s.k]}
              onToggle={() => toggle(s.k)}
              onChange={(v) => handleChange(s.k, v)}
            />
          ))}
        </div>

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, color: isOverLimit ? "#b91c1c" : "var(--muted)" }}>
              Word count: {wordCount} / 1000 {isOverLimit ? "(exceeds limit)" : ""}
            </div>
            {!isOverLimit && sectionsFilledCount < 4 && (
              <div style={{ fontSize: 13, color: "#92400e", fontWeight: 600, marginTop: 2 }}>
                All 4 sections are required to continue ({sectionsFilledCount}/4 done).
              </div>
            )}
          </div>
          <button type="button" className="ghost-btn" onClick={() => setIsPreviewOpen(true)} style={{ borderColor: "rgba(37, 99, 235, 0.35)" }}>
            Preview Statement
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="ghost-btn" onClick={onBack}>← Back</button>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="ghost-btn" onClick={onSaveDraft}>Save Draft</button>
          <button type="button" className="primary-btn primary-btn-lg" onClick={onNext} disabled={!canContinue} style={!canContinue ? { opacity: 0.65, cursor: "not-allowed" } : undefined}>
            Next →
          </button>
        </div>
      </div>

      {isPreviewOpen && <PreviewModal />}
    </div>
  );
}
