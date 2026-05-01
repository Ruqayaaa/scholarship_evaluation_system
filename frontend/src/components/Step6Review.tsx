// // (Applicant) Step 6 - review
import React, { useMemo, useState } from "react";
import type { ApplicationData } from "../types";
import { scorePersonalStatement, scoreResume } from "../lib/api";
import { supabase } from "../lib/supabase";
import { NODE_API } from "../lib/api";

/* This component includes: 
- all application data 
- be able to go back to previous step 
- submit final application 
*/
interface Step6Props {
  data: ApplicationData;
  onBack: () => void;
  onSubmitted: () => void;
}

export function Step6Review({ data, onBack, onSubmitted }: Step6Props) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<
    null | "statement" | "resume" | "portfolio" | "documents" | "personal"
  >(null);

  const handleSubmit = async () => {
    if (!isConfirmed || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    // getting personal statement data 
    try {
      const psData = {
        academic_goals: data.personalStatement.valuesGoals,
        career_goals: data.personalStatement.whyMajor,
        leadership_experience: data.personalStatement.interests,
        personal_statement: [
          data.personalStatement.valuesGoals,
          data.personalStatement.whyMajor,
          data.personalStatement.interests,
          data.personalStatement.summary,
        ]
          .filter(Boolean)
          .join("\n\n"),
      };
      await scorePersonalStatement(psData, data.personalInfo.fullName || undefined);

      // getting resume data
      const resumeParts: string[] = [];
      if (data.resume.education.length) {
        resumeParts.push(
          "Education:\n" +
            data.resume.education
              .map((e) => `${e.degree || ""} at ${e.institution || ""} (${e.startYear || ""}–${e.endYear || ""})`)
              .join("\n")
        );
      }
      if (data.resume.experience.length) {
        resumeParts.push(
          "Experience:\n" +
            data.resume.experience
              .map((x) => `${x.jobTitle || ""} at ${x.organization || ""} (${x.startDate || ""}–${x.endDate || ""})`)
              .join("\n")
        );
      }
      if (data.resume.skills.length) {
        resumeParts.push("Skills: " + data.resume.skills.join(", "));
      }
      if (data.resume.awards.length) {
        resumeParts.push(
          "Awards:\n" +
            data.resume.awards.map((a) => `${a.name || ""} (${a.year || ""})`).join("\n")
        );
      }
      if (data.resume.community.length) {
        resumeParts.push(
          "Community/Volunteer:\n" +
            data.resume.community
              .map((c) => `${c.role || ""} at ${c.organization || ""} (${c.startDate || ""}–${c.endDate || ""})`)
              .join("\n")
        );
      }
      const hasResumeData =
        resumeParts.length > 0 || data.resume.uploadedFile?.length > 0;
      if (hasResumeData) {
        await scoreResume(resumeParts.join("\n\n"));
      }

      const { data: { session } } = await supabase.auth.getSession();

      // extracting the portifolio from supabase
      if (session && data.portfolio.files.length > 0) {
        try {
          const file = data.portfolio.files[0];
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          await fetch(`${NODE_API}/applicants/submit/portfolio`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              applicantId: session.user.id,
              fileData: base64,
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
            }),
          });
        } catch {}
      }

      // for supporting documents (transcript, IELTS, optional)  backend storage
      if (session) {
        try {
          const docCategories: Array<{ key: keyof typeof data.documents; category: string }> = [
            { key: "transcript", category: "transcript" },
            { key: "ielts", category: "ielts" },
            { key: "cvOptional", category: "cv_optional" },
            { key: "statementOptional", category: "statement_optional" },
            { key: "additional", category: "additional" },
          ];

          const docsToUpload: { category: string; fileData: string; fileName: string; mimeType: string }[] = [];

          for (const { key, category } of docCategories) {
            const files = data.documents[key] as File[];
            if (!files || files.length === 0) continue;
            for (const file of files) {
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(",")[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              docsToUpload.push({ category, fileData: base64, fileName: file.name, mimeType: file.type || "application/octet-stream" });
            }
          }

          if (docsToUpload.length > 0) {
            await fetch(`${NODE_API}/applicants/submit/documents`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ applicantId: session.user.id, documents: docsToUpload }),
            });
          }
        } catch {}
      }
      onSubmitted();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Submission failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // getting personal info 
  const personalFields = useMemo(
    () => [
      ["Full Name", data.personalInfo.fullName],
      ["Date of Birth", data.personalInfo.dateOfBirth],
      ["Country", data.personalInfo.country],
      ["Chosen Major", data.personalInfo.chosenMajor],
      ["School Name", data.personalInfo.university],
      ["GPA", data.personalInfo.gpa],
      ["Expected Graduation Year", data.personalInfo.graduationYear],
      ["IELTS Overall Score", data.personalInfo.ieltsScore],
    ] as const,
    [data]
  );

  const hasTranscript = data.documents.transcript?.length > 0;
  const hasIelts = data.documents.ielts?.length > 0;

  // section cards
  const Section = ({
    title,
    right,
    children,
  }: {
    title: string;
    right?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "rgba(255,255,255,0.70)",
        padding: "12px 16px",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#16a34a",
              boxShadow: "0 0 0 3px rgba(22,163,74,0.12)",
              flexShrink: 0,
            }}
          />
          <div style={{ fontWeight: 900, fontSize: 14 }}>{title}</div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );

  // Compact 2-col key-value grid
  const KVGrid = ({ rows }: { rows: Array<[string, string]> }) => (
    <div
      className="step6-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 8,
      }}
    >
      {rows.map(([k, v]) => (
        <div
          key={k}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 10px",
            background: "rgba(255,255,255,0.55)",
          }}
        >
          <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 800, marginBottom: 2 }}>{k}</div>
          <div style={{ color: "var(--navy)", fontWeight: 700, fontSize: 13, lineHeight: 1.4 }}>
            {String(v || "").trim() ? v : "Not provided"}
          </div>
        </div>
      ))}
    </div>
  );

  // listing the files 
  const SmallFileList = ({ files }: { files: File[] }) => {
    if (!files || files.length === 0) {
      return <div style={{ color: "var(--muted)", fontSize: 13 }}>No files uploaded</div>;
    }
    return (
      <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7, color: "var(--navy)", fontSize: 13 }}>
        {files.map((f, idx) => (
          <li key={idx}>{f.name}</li>
        ))}
      </ul>
    );
  };

  const Modal = ({
    title,
    children,
    onClose,
  }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 680, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button type="button" className="ghost-btn" onClick={onClose}>Close</button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );

  const ViewBtn = ({ onClick }: { onClick: () => void }) => (
    <button type="button" className="ghost-btn" onClick={onClick} style={{ fontSize: 12, padding: "4px 10px" }}>
      View
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Scoring in-progress overlay */}
      {isSubmitting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15,23,42,0.60)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: "32px 36px",
              maxWidth: 400,
              width: "90%",
              textAlign: "center",
              boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
              border: "1.5px solid rgba(37,99,235,0.18)",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 14 }}>⏳</div>
            <div style={{ fontWeight: 900, fontSize: 18, color: "var(--navy)", marginBottom: 10 }}>
              Scoring in Progress
            </div>
            <div style={{ color: "#374151", lineHeight: 1.75, fontSize: 14 }}>
              Please <strong style={{ color: "#b91c1c" }}>do not close this tab</strong>.
              Your application is being scored and submitted. This may take up to 3 mins.
            </div>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: "var(--blue)",
                      opacity: 0.3 + i * 0.35,
                      animation: `pulse${i} 1.2s ${i * 0.4}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>
          Step 6 of 6 — Review Your Application
        </div>
        <div style={{ color: "var(--muted)", lineHeight: 1.5, fontSize: 14 }}>
          Review all information carefully before submitting.
        </div>
      </div>

      <Section title="Personal Information" right={<ViewBtn onClick={() => setPreviewOpen("personal")} />}>
        <KVGrid rows={personalFields.map(([k, v]) => [k, v || ""])} />
      </Section>

      <Section title="Personal Statement" right={<ViewBtn onClick={() => setPreviewOpen("statement")} />}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <PreviewBlock label="Interests & Values"     text={data.personalStatement.valuesGoals} />
          <PreviewBlock label="Academic Commitment"    text={data.personalStatement.whyMajor} />
          <PreviewBlock label="Clarity of Vision"      text={data.personalStatement.interests} />
          <PreviewBlock label="Closing Summary"        text={data.personalStatement.summary} />
        </div>
      </Section>

      <Section title="Resume / CV" right={<ViewBtn onClick={() => setPreviewOpen("resume")} />}>
        <div
          className="step6-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}
        >
          <SummaryTile label="Education"         value={`${data.resume.education.length} entry(s)`} />
          <SummaryTile label="Work Experience"   value={`${data.resume.experience.length} position(s)`} />
          <SummaryTile label="Awards"            value={`${data.resume.awards.length} award(s)`} />
          <SummaryTile label="Community Work"    value={`${data.resume.community.length} contribution(s)`} />
          <div style={{ gridColumn: "1 / -1" }}>
            <SummaryTile
              label="Skills"
              value={data.resume.skills.length ? data.resume.skills.join(", ") : "None listed"}
            />
          </div>
        </div>
      </Section>

      <Section title="Portfolio" right={<ViewBtn onClick={() => setPreviewOpen("portfolio")} />}>
        <SmallFileList files={data.portfolio.files} />
      </Section>

      <Section title="Documents" right={<ViewBtn onClick={() => setPreviewOpen("documents")} />}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <DocLine ok={hasTranscript} label="Official Transcript"  value={hasTranscript ? data.documents.transcript[0].name : "Not uploaded"} />
          <DocLine ok={hasIelts}      label="IELTS TRF"            value={hasIelts      ? data.documents.ielts[0].name      : "Not uploaded"} />
          <DocLine ok={data.documents.cvOptional.length > 0}        label="CV (optional)"   value={data.documents.cvOptional.length > 0 ? data.documents.cvOptional[0].name : "Not uploaded"} />
          <DocLine ok={data.documents.statementOptional.length > 0} label="PS PDF (optional)" value={data.documents.statementOptional.length > 0 ? data.documents.statementOptional[0].name : "Not uploaded"} />
        </div>
      </Section>

      {/* Confirmation checkbox */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "rgba(255,255,255,0.70)",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input
            id="confirm"
            type="checkbox"
            checked={isConfirmed}
            onChange={(e) => setIsConfirmed(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
          />
          <label htmlFor="confirm" style={{ cursor: "pointer", color: "var(--navy)", lineHeight: 1.55, fontSize: 13 }}>
            I confirm that all information provided is accurate and truthful. I acknowledge that my personal statement is my
            original work and that any false information may result in disqualification.
          </label>
        </div>
      </div>

      {/* Submission error */}
      {submitError && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(220,38,38,0.3)",
            background: "rgba(220,38,38,0.07)",
            color: "#b91c1c",
            fontWeight: 700,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="ghost-btn" onClick={onBack} disabled={isSubmitting}>
          ← Back
        </button>

        <button
          type="button"
          className="primary-btn primary-btn-lg"
          onClick={handleSubmit}
          disabled={!isConfirmed || isSubmitting}
          style={
            !isConfirmed || isSubmitting
              ? { opacity: 0.65, cursor: "not-allowed", borderColor: "rgba(22,163,74,0.25)" }
              : { borderColor: "rgba(22,163,74,0.35)" }
          }
        >
          {isSubmitting ? "Submitting…" : "Submit Application"}
        </button>
      </div>

      {/* Modals */}
      {previewOpen === "personal" && (
        <Modal title="Personal Information" onClose={() => setPreviewOpen(null)}>
          <KVGrid rows={personalFields.map(([k, v]) => [k, v || ""])} />
        </Modal>
      )}

      {previewOpen === "statement" && (
        <Modal title="Personal Statement (Full)" onClose={() => setPreviewOpen(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FullBlock title="Interests & Values"  text={data.personalStatement.valuesGoals} />
            <FullBlock title="Academic Commitment" text={data.personalStatement.whyMajor} />
            <FullBlock title="Clarity of Vision"   text={data.personalStatement.interests} />
            <FullBlock title="Closing Summary"     text={data.personalStatement.summary} />
          </div>
        </Modal>
      )}

      {previewOpen === "resume" && (
        <Modal title="Resume (Summary)" onClose={() => setPreviewOpen(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Education</div>
            <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7, fontSize: 13 }}>
              {data.resume.education.map((e, idx) => (
                <li key={idx}>
                  {e.institution || "Institution"} — {e.degree || "Degree"} ({e.startYear || "—"}–{e.endYear || "—"})
                </li>
              ))}
            </ul>
            <div style={{ fontWeight: 900, fontSize: 13, marginTop: 6 }}>Experience</div>
            <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.7, fontSize: 13 }}>
              {data.resume.experience.map((x, idx) => (
                <li key={idx}>
                  {x.jobTitle || "Role"} @ {x.organization || "Organization"} ({x.startDate || "—"}–{x.endDate || "—"})
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}

      {previewOpen === "portfolio" && (
        <Modal title="Portfolio Files" onClose={() => setPreviewOpen(null)}>
          <SmallFileList files={data.portfolio.files} />
        </Modal>
      )}

      {previewOpen === "documents" && (
        <Modal title="Documents" onClose={() => setPreviewOpen(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Required</div>
            <SmallFileList files={data.documents.transcript} />
            <SmallFileList files={data.documents.ielts} />
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>Optional</div>
              <SmallFileList files={data.documents.cvOptional} />
              <SmallFileList files={data.documents.statementOptional} />
              <div style={{ color: "var(--navy)", fontSize: 13 }}>
                Additional: {data.documents.additional.length} file(s)
              </div>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        @media (max-width: 900px) {
          .step6-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes pulse0 { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes pulse1 { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes pulse2 { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `}</style>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 10px",
        background: "rgba(255,255,255,0.55)",
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 800, marginBottom: 2 }}>{label}</div>
      <div style={{ color: "var(--navy)", fontWeight: 800, fontSize: 13, lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

function PreviewBlock({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  const short = text.length > 120 ? text.slice(0, 120).trim() + "…" : text;
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 10px",
        background: "rgba(255,255,255,0.55)",
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 800, marginBottom: 3 }}>{label}</div>
      <div style={{ color: "var(--navy)", lineHeight: 1.55, fontSize: 13 }}>{short}</div>
    </div>
  );
}

function FullBlock({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.65)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6 }}>{title}</div>
      <div style={{ whiteSpace: "pre-wrap", color: "var(--navy)", lineHeight: 1.7, fontSize: 13 }}>
        {text?.trim() ? text : "Not provided"}
      </div>
    </div>
  );
}

function DocLine({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: ok ? "#16a34a" : "#cbd5e1",
          boxShadow: ok ? "0 0 0 3px rgba(22,163,74,0.12)" : "none",
          flexShrink: 0,
        }}
      />
      <span style={{ fontWeight: 700, minWidth: 150 }}>{label}:</span>
      <span style={{ color: ok ? "var(--navy)" : "var(--muted)" }}>{value}</span>
    </div>
  );
}
