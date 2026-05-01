// (Applicant) Form section of personal statement 
import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { scorePersonalStatement } from "../lib/api";
import { PS_CRITERIA } from "../lib/scores";
import OcrUploader from "./OcrUploader";

// split OCR text into 4 sections for the form
function distributeText(raw) {
  const paragraphs = raw.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  if (paragraphs.length === 0) return ["", "", "", ""];
  if (paragraphs.length === 1) return [paragraphs[0], "", "", ""];
  const q = Math.ceil(paragraphs.length / 4);
  return [
    paragraphs.slice(0, q),
    paragraphs.slice(q, q * 2),
    paragraphs.slice(q * 2, q * 3),
    paragraphs.slice(q * 3),
  ].map((c) => c.join("\n\n"));
}

// Different sections definations
const SECTIONS = [
  {
    key: "interests_and_values",
    label: "Interests & Values",
    hint: "Describe your personal interests, passions, and core values that drive you.",
    placeholder: "What topics, activities, or causes are you passionate about? What values guide your decisions and actions?",
  },
  {
    key: "academic_commitment",
    label: "Academic Commitment",
    hint: "Describe your academic dedication, achievements, and scholarly pursuits.",
    placeholder: "Highlight your academic achievements, study habits, intellectual curiosity, and commitment to learning in your field.",
  },
  {
    key: "clarity_of_vision",
    label: "Clarity of Vision",
    hint: "Explain your clear vision for your future and how this program fits.",
    placeholder: "Where do you see yourself in 5–10 years? How does this program prepare you for that path?",
  },
  {
    key: "closing",
    label: "Closing Summary",
    hint: "End with a strong, well-organized summary of why you are an ideal candidate.",
    placeholder: "Summarize what makes you stand out, what you will contribute, and why you are confident in your application.",
  },
];


export default function PersonalStatementForm() {
  const [values, setValues] = useState({
    interests_and_values: "",
    academic_commitment: "",
    clarity_of_vision: "",
    closing: "",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const wordCount = Object.values(values).join(" ").split(/\s+/).filter(Boolean).length;
  const isOverLimit = wordCount > 1000;

  async function submit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);
    try {
      // API expects these field names regardless of how the state keys are named
      const res = await scorePersonalStatement({
        academic_goals: values.academic_commitment,
        career_goals: values.clarity_of_vision,
        leadership_experience: values.interests_and_values,
        personal_statement: Object.values(values).filter(Boolean).join("\n\n"),
      });
      setResult(res);
    } catch (err) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    /* (FigmaMake 2025) */
    <div style={{ maxWidth: 950, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ color: "#111827", marginBottom: 8 }}>Personal Statement</h1>
      <p style={{ color: "#4b5563", marginBottom: 24 }}>
        Fill in each section below. Your statement is scored on: Interests &amp; Values,
        Academic Commitment, Clarity of Vision, Organization, and Language Quality.
      </p>

      <form onSubmit={submit}>
        <div style={{ background: "#fff", borderRadius: 24, boxShadow: "0 1px 8px rgba(0,0,0,0.08)", padding: 32, marginBottom: 24 }}>
          <h2 style={{ color: "#111827", marginBottom: 8 }}>Structure Your Statement</h2>
          <p style={{ color: "#4b5563", margin: "0 0 16px", fontSize: 14 }}>
            Have an existing statement? Upload it and we'll fill the sections automatically.
          </p>
          <div style={{ marginBottom: 20 }}>
            <OcrUploader
              onExtract={(text) => {
                const [s1, s2, s3, s4] = distributeText(text);
                setValues({ interests_and_values: s1, academic_commitment: s2, clarity_of_vision: s3, closing: s4 });
              }}
              buttonLabel="Upload & Fill Sections"
            />
          </div>

          {SECTIONS.map(({ key, label, hint, placeholder }) => (
            <div key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontWeight: 600, color: "#111827" }}>
                {values[key] ? <CheckCircle2 size={20} color="#16a34a" /> : <Circle size={20} color="#9ca3af" />}
                <span>{label}</span>
              </div>
              <p style={{ color: "#4b5563", margin: "0 0 12px", fontSize: 14 }}>{hint}</p>
              <textarea
                style={{ width: "100%", minHeight: 150, padding: 16, border: "1px solid #d1d5db", borderRadius: 10, resize: "vertical", fontSize: 14, boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}
                placeholder={placeholder}
                value={values[key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}

          <div style={{ color: isOverLimit ? "#dc2626" : "#4b5563", marginTop: 4 }}>
            Word count: {wordCount} / 1000{isOverLimit ? " (exceeds limit)" : ""}
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: 16, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10 }}>
              <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>
            </div>
          )}

          {result && (
            <div style={{ marginTop: 16, padding: 20, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
              <p style={{ color: "#166534", marginBottom: 16, fontWeight: 600, marginTop: 0 }}>✓ Statement scored successfully.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {PS_CRITERIA.map(({ key, label, max }) => {
                  const score = result[key] ?? 0;
                  return (
                    <div key={key}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                        <span style={{ color: "#374151" }}>{label}</span>
                        <span style={{ color: "#166534", fontWeight: 600 }}>{score} / {max}</span>
                      </div>
                      <div style={{ height: 6, background: "#d1fae5", borderRadius: 4 }}>
                        <div style={{ height: "100%", width: `${(score / max) * 100}%`, background: "#16a34a", borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "#111827" }}>Overall Score</span>
                  <span style={{ fontWeight: 700, color: "#1A3175", fontSize: 18 }}>
                    {result.overall_score ?? 0} / 100
                    <span style={{ fontSize: 14, color: "#6b7280", marginLeft: 8 }}>({result.grade_pct ?? 0}%)</span>
                  </span>
                </div>
                {result.strengths?.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontWeight: 600, color: "#166534", margin: "0 0 8px" }}>Strengths</p>
                    <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                      {result.strengths.map((s, i) => <li key={i} style={{ color: "#374151", fontSize: 13 }}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {result.improvements?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontWeight: 600, color: "#92400e", margin: "0 0 8px" }}>Areas to Improve</p>
                    <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                      {result.improvements.map((s, i) => <li key={i} style={{ color: "#374151", fontSize: 13 }}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={isSubmitting || isOverLimit}
            style={{
              background: isSubmitting || isOverLimit ? "#94a3b8" : "#1A3175",
              color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px",
              fontSize: 14, fontWeight: 600, cursor: isSubmitting || isOverLimit ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
