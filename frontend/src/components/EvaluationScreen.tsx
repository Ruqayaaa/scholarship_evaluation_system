// (Reviewer) This component is responsible for displaying the detailed evaluation interface for a single applicant, including all steps of the review process, and saving the reviewer's scores, notes, and final recommendation.
import { useEffect, useMemo, useState } from "react";
import type { Applicant } from "../types";
import { PS_CRITERIA, RESUME_CRITERIA } from "../lib/scores";
import type { PsScores, ResumeScores } from "../lib/scores";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { adminFetch } from "../lib/api";

// Reusable block for reviewer notes with a title and input
function ReviewerNotesBlock({
  title, value, onChange, placeholder, disabled,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="reviewer-block">
      <div className="reviewer-block-title">{title}</div>
      <p className="reviewer-muted" style={{ marginBottom: 10 }}>{placeholder}</p>
      <textarea
        className="reviewer-textarea"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add your notes here…"
        disabled={disabled}
      />
    </div>
  );
}

// static data structure 
/* (Claude Code, 2026) 
Make a list of static data structures for evaluation criteria, questions, and step labels to keep the component organized and maintainable.
First - PS criteria: key (interests_and_values, academic_commitment, clarity_of_vision, organization, language_quality), label, max score 
Second - Resume criteria: key (academic_achievement, leadership_and_extracurriculars, community_service, research_and_work_experience, skills_and_certifications, awards_and_recognition), label, max score
Third - Interview rubric: id (communication, critical, alignment, passion, professionalism), title, hint
Fourth - Available interview questions: a list of 6-8 common questions that reviewers can select from when creating the interview question set
Fifth - Step labels and total steps for the review process (e.g. Review Info, Portfolio, Interview Questions, Interview Score, Final Decision)
Sixth - portfolio rubric criteria: id (creativity, technical, relevance, impact), title, hint
*/


const PORTFOLIO_RUBRIC = [
  { id: "creativity", title: "Creativity & Originality", hint: "Originality and creative expression" },
  { id: "technical",  title: "Technical Skill",           hint: "Demonstrated technical proficiency" },
  { id: "relevance",  title: "Relevance & Purpose",       hint: "Alignment with scholarship goals" },
  { id: "impact",     title: "Impact & Achievement",      hint: "Evidence of meaningful outcomes" },
];

const INTERVIEW_RUBRIC = [
  { id: "communication",   title: "Communication & Clarity",           hint: "Ability to articulate ideas clearly" },
  { id: "critical",        title: "Critical Thinking",                  hint: "Depth of reasoning and problem-solving" },
  { id: "alignment",       title: "Alignment with Scholarship Values",  hint: "Connection to mission and goals" },
  { id: "passion",         title: "Passion & Motivation",               hint: "Genuine enthusiasm and drive" },
  { id: "professionalism", title: "Professional Demeanor",              hint: "Confidence, respect, and presence" },
];

const AVAILABLE_QUESTIONS = [
  "Can you elaborate on your leadership experience and its impact?",
  "How do you plan to contribute to your community after graduation?",
  "What specific skills have you developed through your extracurricular activities?",
  "Describe a time when you failed and what you learned from it.",
  "How will this scholarship help you achieve your long-term goals?",
  "What makes you uniquely qualified for this scholarship?",
];

const STEP_LABELS = ["Review Info", "Portfolio", "Interview Questions", "Interview Score", "Final Decision"];
const TOTAL_STEPS = 5;

/* This component needs: 
- to display all relevant information about the applicant 
- back navigation 
*/
interface Props {
  applicant: Applicant;
  onBack: () => void;
}

export default function EvaluationScreen({ applicant, onBack }: Props) {
  const [step, setStep] = useState(1);

  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");

  const [portfolioScores, setPortfolioScores] = useState({ creativity: "", technical: "", relevance: "", impact: "" });
  const [portfolioNotes, setPortfolioNotes] = useState("");

  const [interviewScores, setInterviewScores] = useState({communication: "", critical: "", alignment: "", passion: "", professionalism: "",});

  // AI notes are stored per-section 
  const [psAiNotes, setPsAiNotes] = useState("");
  const [resumeAiNotes, setResumeAiNotes] = useState("");

  // Final step
  const [comments, setComments] = useState("");
  // Recommendation is only "Yes" or "No"
  const [recommendation, setRecommendation] = useState<"Yes" | "No" | "">("");
  const [evalStatus, setEvalStatus] = useState<"draft" | "submitted">("draft");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [reviewerId, setReviewerId] = useState<string | null>(null);

  // Aggregate score
  /* (Claude Code, 2026)
I want to be able to calculate an overall score based on the available scores from the portfolio rubric, interview rubric, and AI scores. 
Normalize all scores to a common scale (e.g. 0-100) and compute a weighted average to display. 
  */
  const aggregatedScore = useMemo(() => {
    const portfolioVals = Object.values(portfolioScores).map(Number).filter((n) => !isNaN(n) && n > 0);
    const interviewVals = Object.values(interviewScores).map(Number).filter((n) => !isNaN(n) && n > 0);
    const portfolioAvg  = portfolioVals.length === 4 ? portfolioVals.reduce((a, b) => a + b, 0) / 4 : null;
    const interviewAvg  = interviewVals.length === 5 ? interviewVals.reduce((a, b) => a + b, 0) / 5 : null;
    const aiNorm        = applicant.aiScore ? applicant.aiScore / 10 : null;
    const parts: number[] = [];
    if (aiNorm !== null)      parts.push(aiNorm);
    if (portfolioAvg !== null) parts.push(portfolioAvg);
    if (interviewAvg !== null) parts.push(interviewAvg);
    if (parts.length === 0) return 0;
    return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10);
  }, [portfolioScores, interviewScores, applicant.aiScore]);

  // Load saved evaluation
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;
      setReviewerId(uid);
      try {
        const res = await adminFetch(`/reviewer/${uid}/applications/${applicant.id}/evaluation`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data) return;

        // Recommendation values to Yes/No
        const savedRec = data.recommendation || "";
        if (savedRec === "Recommend") setRecommendation("Yes");
        else if (savedRec === "Do Not Recommend" || savedRec === "Borderline") setRecommendation("No");
        else if (savedRec === "Yes" || savedRec === "No") setRecommendation(savedRec as "Yes" | "No");

        setComments(data.notes || "");
        setEvalStatus((data.status as "draft" | "submitted") || "draft");

        /* (Claude Code, 2026)
        I want to load scores, notes, and selected questions for the applicant when the evaluation screen is opened, so that reviewers can see their previous inputs and continue where they left off.
        Needs: 
        - to fetch the saved evaluation data from the backend API for the given applicant and reviewer
        - to populate the component state with the retrieved scores (portfolio and interview), notes (AI and general comments), and selected questions for the interview
        - to handle cases where some data might be missing 
        */
        if (data.scores && typeof data.scores === "object") {
          const s = data.scores as Record<string, number | string>;
          if (s._step) setStep(Number(s._step));
          setPortfolioScores({
            creativity: s.p_creativity != null ? String(s.p_creativity) : "",
            technical:  s.p_technical  != null ? String(s.p_technical)  : "",
            relevance:  s.p_relevance  != null ? String(s.p_relevance)  : "",
            impact:     s.p_impact     != null ? String(s.p_impact)     : "",
          });
          setInterviewScores({
            communication:   s.i_communication   != null ? String(s.i_communication)   : "",
            critical:        s.i_critical         != null ? String(s.i_critical)         : "",
            alignment:       s.i_alignment        != null ? String(s.i_alignment)        : "",
            passion:         s.i_passion          != null ? String(s.i_passion)          : "",
            professionalism: s.i_professionalism  != null ? String(s.i_professionalism)  : "",
          });
          if (s._ps_ai_notes)     setPsAiNotes(String(s._ps_ai_notes));
          if (s._resume_ai_notes) setResumeAiNotes(String(s._resume_ai_notes));
          if (s._portfolio_notes) setPortfolioNotes(String(s._portfolio_notes));
          if (s._selectedQs) {
            try { setSelectedQuestions(JSON.parse(String(s._selectedQs))); } catch { /* ignore */ }
          }
          if (s._customQs) {
            try { setCustomQuestions(JSON.parse(String(s._customQs))); } catch { /* ignore */ }
          }
        }
      } catch {}
    }
    load();
  }, [applicant.id]);

  // saving evaluation
  async function saveEvaluation(status: "draft" | "submitted") {
    if (!reviewerId) return;
    if (status === "submitted" && !recommendation) {
      setSaveMsg("Please select Yes or No for your recommendation before submitting.");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      /* (Claude Code, 2026) 
      I want to save the reviewer's evaluation inputs (scores, notes, selected questions) to the backend when they click "Save Progress" or "Submit Evaluation"
      Needs:
      - to gather all relevant data from the component state, including portfolio and interview scores, AI notes, general comments, selected interview questions, and the final recommendation
      - to send this data to the backend API in a structured format, associating it with the correct applicant and reviewer
      - to handle the response from the backend, showing a success message and updating the evaluation status in the UI, or showing an error message if the save fails
      */
      const scores: Record<string, unknown> = { _step: step };
      if (portfolioScores.creativity) scores.p_creativity    = parseFloat(portfolioScores.creativity);
      if (portfolioScores.technical)  scores.p_technical     = parseFloat(portfolioScores.technical);
      if (portfolioScores.relevance)  scores.p_relevance     = parseFloat(portfolioScores.relevance);
      if (portfolioScores.impact)     scores.p_impact        = parseFloat(portfolioScores.impact);
      if (portfolioNotes)             scores._portfolio_notes = portfolioNotes;
      if (interviewScores.communication)   scores.i_communication   = parseFloat(interviewScores.communication);
      if (interviewScores.critical)        scores.i_critical         = parseFloat(interviewScores.critical);
      if (interviewScores.alignment)       scores.i_alignment        = parseFloat(interviewScores.alignment);
      if (interviewScores.passion)         scores.i_passion          = parseFloat(interviewScores.passion);
      if (interviewScores.professionalism) scores.i_professionalism  = parseFloat(interviewScores.professionalism);
      if (psAiNotes)     scores._ps_ai_notes     = psAiNotes;
      if (resumeAiNotes) scores._resume_ai_notes = resumeAiNotes;
      scores._selectedQs = JSON.stringify(selectedQuestions);
      scores._customQs   = JSON.stringify(customQuestions);

      const res = await adminFetch(
        `/reviewer/${reviewerId}/applications/${applicant.id}/evaluation`,
        { method: "PATCH", body: JSON.stringify({ recommendation, notes: comments, scores, status }) }
      );
      if (!res.ok) throw new Error("Save failed");
      setEvalStatus(status);
      setSaveMsg(status === "submitted" ? "Evaluation submitted!" : "Progress saved.");
      if (status === "submitted") {
        setTimeout(() => { setSaveMsg(null); onBack(); }, 1500);
      }
    } catch {
      setSaveMsg("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }


  const toggleQuestion = (q: string) =>
    setSelectedQuestions((prev) => prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]);

  const addCustomQuestion = () => {
    const q = newQuestion.trim();
    if (!q) return;
    setCustomQuestions((prev) => [...prev, q]);
    setNewQuestion("");
  };

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));
  const isLocked = evalStatus === "submitted";

  // AI Scores read-only display 
  function AiScoreBlock({
    title, overall, outOf, criteria, justification,
  }: {
    title: string;
    overall: number;
    outOf: number;
    criteria: { key: string; label: string; max: number; score: number }[];
    justification?: string;
  }) {
    const pct = outOf > 0 ? Math.round((overall / outOf) * 100) : 0;
    const scoreColor = pct >= 70 ? "#15803d" : pct >= 50 ? "#b45309" : "#b91c1c";
    return (
         /* (FigmaMake 2025) */
      <div className="reviewer-block reviewer-ai" style={{ padding: "18px 20px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
          <div className="reviewer-block-title" style={{ margin: 0, fontSize: 15 }}>{title}</div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#f8fafc", border: "1.5px solid #e2e8f0",
            borderRadius: 10, padding: "8px 16px",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Score
            </span>
            <span style={{ fontSize: 22, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
              {overall}
            </span>
            <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>/ {outOf}</span>
            <span style={{
              fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 20,
              background: pct >= 70 ? "#dcfce7" : pct >= 50 ? "#fef3c7" : "#fee2e2",
              color: scoreColor,
            }}>
              {pct}%
            </span>
          </div>
        </div>

        {/* Criteria bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {criteria.map(({ key, label, max, score }) => {
            const barPct = max > 0 ? (score / max) * 100 : 0;
            const barColor = barPct >= 70 ? "#16a34a" : barPct >= 50 ? "#d97706" : "#ef4444";
            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: barColor, minWidth: 50, textAlign: "right" }}>
                    {score} <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12 }}>/ {max}</span>
                  </span>
                </div>
                <div style={{ height: 8, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 6, transition: "width 0.4s ease",
                    width: `${barPct}%`,
                    background: barColor,
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Justification (resume only) */}
        {justification && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#374151", lineHeight: 1.65 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              AI Notes
            </div>
            {justification}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="reviewer-page">
      <button className="back-btn" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to Applicants
      </button>

      {/* Stepper */}
      <div className="top-stepper">
        <div className="top-stepper-head">
          <div>
            <div className="top-stepper-title">{applicant.name}</div>
            <div className="top-stepper-sub">{applicant.scholarship}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isLocked && (
              <span style={{ background: "#dcfce7", color: "#166534", fontWeight: 700, fontSize: 13, padding: "4px 12px", borderRadius: 20 }}>
                ✓ Submitted
              </span>
            )}
            <div className="top-stepper-sub">Step {step} / {TOTAL_STEPS}</div>
          </div>
        </div>
        <div className="top-stepper-track">
          {STEP_LABELS.map((label, i) => {
            const num = i + 1;
            const cls = num === step ? "is-active" : num < step ? "is-done" : "";
            return (
              <div key={label} className={`top-stepper-item ${cls}`}>
                <div className="top-stepper-bubble">{num}</div>
                <div className="top-stepper-label">{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="reviewer-content">

        {/* ── STEP 1: REVIEW INFO & AI SCORES ────────────────────────────────── */}
        {step === 1 && (() => {
          const psAnswers    = applicant.answers.filter((a) => a.question !== "Resume Text");
          const resumeAnswer = applicant.answers.find((a) => a.question === "Resume Text");
          return (
            <div className="reviewer-stack">

              {/* Application Information */}
              <div className="reviewer-block">
                <div className="reviewer-block-title">Application Information</div>
                <div className="reviewer-grid-2">
                  {applicant.formFields.map((f, idx) => (
                    <div key={idx} className="reviewer-field">
                      <div className="reviewer-field-label">{f.label}</div>
                      <div className="reviewer-field-value">{f.value || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personal Statement text */}
              {psAnswers.length > 0 && (
                <div className="reviewer-block">
                  <div className="reviewer-block-title">Personal Statement</div>
                  <div className="reviewer-stack" style={{ gap: 12 }}>
                    {psAnswers.map((a, i) => (
                      <div key={i}>
                        <div className="reviewer-field-label" style={{ marginBottom: 6 }}>{a.question}</div>
                        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                          {a.answer || "Not provided"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PS AI Scores + reviewer notes */}
              {applicant.psScores && (
                <>
                  <AiScoreBlock
                    title="AI Scores — Personal Statement"
                    overall={applicant.psScores.overall_score}
                    outOf={150}
                    criteria={PS_CRITERIA.map((c) => ({ ...c, score: (applicant.psScores![c.key] as number) || 0 }))}
                  />
                  <ReviewerNotesBlock
                    title="Personal Statement Notes"
                    value={psAiNotes}
                    onChange={setPsAiNotes}
                    placeholder="Record observations or comments about the personal statement AI scores."
                    disabled={isLocked}
                  />
                </>
              )}

              {/* Resume text */}
              {resumeAnswer && (
                <div className="reviewer-block">
                  <div className="reviewer-block-title">Resume</div>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                    {resumeAnswer.answer || "Not provided"}
                  </div>
                </div>
              )}

              {/* Resume AI Scores + reviewer notes */}
              {applicant.resumeScores && (
                <>
                  <AiScoreBlock
                    title="AI Scores — Resume"
                    overall={applicant.resumeScores.overall_score}
                    outOf={180}
                    criteria={RESUME_CRITERIA.map((c) => ({ ...c, score: (applicant.resumeScores![c.key] as number) || 0 }))}
                    justification={applicant.resumeScores.justification}
                  />
                  <ReviewerNotesBlock
                    title="Resume Notes"
                    value={resumeAiNotes}
                    onChange={setResumeAiNotes}
                    placeholder="Record observations or comments about the resume AI scores."
                    disabled={isLocked}
                  />
                </>
              )}

              {!applicant.psScores && !applicant.resumeScores && (
                <div className="reviewer-block reviewer-ai">
                  <div className="reviewer-block-title">AI Summary</div>
                  <div className="reviewer-ai-row">
                    <div className="reviewer-ai-score">
                      <div className="reviewer-ai-score-num">{applicant.aiScore}</div>
                      <div className="reviewer-ai-score-sub">AI Score (0–100)</div>
                    </div>
                  </div>
                  <div className="reviewer-ai-card">
                    <div className="reviewer-ai-card-title">AI Feedback</div>
                    <div className="reviewer-ai-card-text">{applicant.aiFeedback}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── STEP 2: PORTFOLIO REVIEW & RUBRIC ──────────────────────────────── */}
        {step === 2 && (
          <div className="reviewer-stack">
            {/* Portfolio display */}
            <div className="reviewer-block">
              <div className="reviewer-block-title">Portfolio</div>
              {applicant.portfolio ? (
                <>
                  <p className="reviewer-muted" style={{ marginBottom: 12 }}>
                    Review the portfolio materials below, then complete the rubric and add your notes.
                  </p>
                  {applicant.portfolio.items?.map((item, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      {item.title && (
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{item.title}</div>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="primary-btn"
                          style={{ display: "inline-block", fontSize: 13, textDecoration: "none" }}
                        >
                          Open / Download Portfolio
                        </a>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <p className="reviewer-muted">
                  No portfolio was submitted by this applicant. Complete the rubric based on any
                  materials reviewed, or leave scores blank if not applicable.
                </p>
              )}
            </div>

            {/* Portfolio Rubric */}
            <div className="reviewer-block">
              <div className="reviewer-block-title">Portfolio Rubric (0–10)</div>
              <div className="reviewer-rubric">
                {PORTFOLIO_RUBRIC.map((c) => (
                  <div className="rubric-row" key={c.id}>
                    <div className="rubric-left">
                      <div className="rubric-title">{c.title}</div>
                      <div className="rubric-hint">{c.hint}</div>
                    </div>
                    <input
                      className="rubric-input"
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={(portfolioScores as Record<string, string>)[c.id]}
                      onChange={(e) => setPortfolioScores((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="0–10"
                      disabled={isLocked}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio Notes */}
            <div className="reviewer-block">
              <div className="reviewer-block-title">Portfolio Notes</div>
              <p className="reviewer-muted" style={{ marginBottom: 10 }}>
                Record observations, impressions, or specific feedback about the portfolio.
              </p>
              <textarea
                className="reviewer-textarea"
                rows={5}
                value={portfolioNotes}
                onChange={(e) => setPortfolioNotes(e.target.value)}
                placeholder="Describe the quality, relevance, and standout elements of the portfolio…"
                disabled={isLocked}
              />
            </div>
          </div>
        )}

        {/* ── STEP 3: INTERVIEW QUESTIONS ─────────────────────────────────────── */}
        {step === 3 && (
          <div className="reviewer-stack">
            <div className="reviewer-block">
              <div className="reviewer-block-title">Suggested Interview Questions</div>
              <p className="reviewer-muted" style={{ marginBottom: 12 }}>
                Select questions to use in the interview. You can also add custom questions.
              </p>
              <div className="reviewer-checklist">
                {AVAILABLE_QUESTIONS.map((q) => (
                  <label key={q} className="check-item">
                    <input type="checkbox" checked={selectedQuestions.includes(q)} onChange={() => toggleQuestion(q)} disabled={isLocked} />
                    <span>{q}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="reviewer-block">
              <div className="reviewer-block-title">Custom Questions</div>
              {customQuestions.length > 0 && (
                <div className="reviewer-custom-list">
                  {customQuestions.map((q, idx) => (
                    <div key={idx} className="custom-row">
                      <span>{q}</span>
                      {!isLocked && (
                        <button className="icon-btn" type="button" onClick={() => setCustomQuestions((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remove">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!isLocked && (
                <div className="reviewer-inline">
                  <input
                    className="input"
                    value={newQuestion}
                    placeholder="Type your question..."
                    onChange={(e) => setNewQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" ? (e.preventDefault(), addCustomQuestion()) : undefined}
                  />
                  <button className="primary-btn" type="button" onClick={addCustomQuestion}>
                    <Plus size={16} /> Add
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 4: INTERVIEW SCORING RUBRIC ────────────────────────────────── */}
        {step === 4 && (
          <div className="reviewer-stack">
            <div className="reviewer-block">
              <div className="reviewer-block-title">Interview Scoring Rubric (0–10)</div>
              <p className="reviewer-muted" style={{ marginBottom: 16 }}>
                Score the applicant on each criterion based on their interview performance.
              </p>
              <div className="reviewer-rubric">
                {INTERVIEW_RUBRIC.map((c) => (
                  <div className="rubric-row" key={c.id}>
                    <div className="rubric-left">
                      <div className="rubric-title">{c.title}</div>
                      <div className="rubric-hint">{c.hint}</div>
                    </div>
                    <input
                      className="rubric-input"
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={(interviewScores as Record<string, string>)[c.id]}
                      onChange={(e) => setInterviewScores((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="0–10"
                      disabled={isLocked}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: FINAL SCORE & DECISION ──────────────────────────────────── */}
        {step === 5 && (
          <div className="reviewer-stack">
            {/* Score breakdown */}
            <div className="reviewer-block reviewer-ai">
              <div className="reviewer-block-title">Score Summary</div>
              <div className="reviewer-rubric" style={{ gap: 10 }}>
                <div className="rubric-row">
                  <div className="rubric-left">
                    <div className="rubric-title">AI Score</div>
                    <div className="rubric-hint">System-generated score</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "var(--primary)", minWidth: 60, textAlign: "right" }}>
                    {applicant.aiScore ?? "—"}<span style={{ fontWeight: 400, fontSize: 13 }}>/100</span>
                  </div>
                </div>
                {(() => {
                  const vals = Object.values(portfolioScores).map(Number).filter((n) => !isNaN(n) && n > 0);
                  const avg  = vals.length === 4 ? (vals.reduce((a, b) => a + b, 0) / 4).toFixed(1) : null;
                  return (
                    <div className="rubric-row">
                      <div className="rubric-left">
                        <div className="rubric-title">Portfolio Score</div>
                        <div className="rubric-hint">Average of portfolio rubric (0–10)</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: "var(--primary)", minWidth: 60, textAlign: "right" }}>
                        {avg ?? "—"}<span style={{ fontWeight: 400, fontSize: 13 }}>/10</span>
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const vals = Object.values(interviewScores).map(Number).filter((n) => !isNaN(n) && n > 0);
                  const avg  = vals.length === 5 ? (vals.reduce((a, b) => a + b, 0) / 5).toFixed(1) : null;
                  return (
                    <div className="rubric-row">
                      <div className="rubric-left">
                        <div className="rubric-title">Interview Score</div>
                        <div className="rubric-hint">Average of interview rubric (0–10)</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: "var(--primary)", minWidth: 60, textAlign: "right" }}>
                        {avg ?? "—"}<span style={{ fontWeight: 400, fontSize: 13 }}>/10</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="reviewer-final" style={{ marginTop: 16, textAlign: "center" }}>
                <div className="reviewer-final-score-num">{aggregatedScore}</div>
                <div className="reviewer-final-score-sub">Aggregate Score (0–100)</div>
              </div>
            </div>

            {/* Recommendation — strictly Yes or No */}
            <div className="reviewer-block">
              <div className="reviewer-block-title">Recommendation</div>
              <p className="reviewer-muted" style={{ marginBottom: 12 }}>
                Do you recommend this applicant for the scholarship?
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                {(["Yes", "No"] as const).map((opt) => {
                  const isSelected = recommendation === opt;
                  const isYes = opt === "Yes";
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setRecommendation(opt)}
                      style={{
                        flex: 1, padding: "14px 0", borderRadius: 10, fontSize: 16, fontWeight: 800,
                        border: `2px solid ${isSelected ? (isYes ? "#16a34a" : "#dc2626") : "#e5e7eb"}`,
                        background: isSelected ? (isYes ? "#dcfce7" : "#fee2e2") : "#f8fafc",
                        color: isSelected ? (isYes ? "#15803d" : "#b91c1c") : "#94a3b8",
                        cursor: isLocked ? "not-allowed" : "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {isYes ? "✓ Yes" : "✗ No"}
                    </button>
                  );
                })}
              </div>
              {!recommendation && !isLocked && (
                <p style={{ marginTop: 8, fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                  Please select Yes or No.
                </p>
              )}
            </div>

            {/* Evaluation Notes */}
            <div className="reviewer-block">
              <div className="reviewer-block-title">Evaluation Notes & Comments</div>
              <textarea
                className="reviewer-textarea"
                rows={8}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Provide your overall assessment, justification for your recommendation, and any notable observations from the interview…"
                disabled={isLocked}
              />
            </div>

            {/* Actions */}
            <div className="reviewer-actions">
              {isLocked ? (
                <div style={{ padding: "10px 16px", background: "#dcfce7", borderRadius: 8, color: "#166534", fontWeight: 600, fontSize: 14 }}>
                  ✓ Evaluation Submitted
                </div>
              ) : (
                <>
                  <button className="ghost-btn" type="button" onClick={() => saveEvaluation("draft")} disabled={saving}>
                    {saving ? "Saving…" : "Save Draft"}
                  </button>
                  {recommendation && comments.trim().length === 0 && (
                    <span style={{ fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                      Please add evaluation notes before submitting.
                    </span>
                  )}
                  <button
                    className="approve-btn"
                    type="button"
                    onClick={() => saveEvaluation("submitted")}
                    disabled={saving || !recommendation || comments.trim().length === 0}
                  >
                    {saving ? "Submitting…" : "Submit Evaluation"}
                  </button>
                </>
              )}
              {saveMsg && (
                <span style={{ fontSize: 13, color: saveMsg.includes("Failed") || saveMsg.includes("Please") ? "#ef4444" : "#16a34a", fontWeight: 600 }}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="reviewer-footer-nav">
        <button className="ghost-btn" type="button" onClick={prev} disabled={step === 1}>
          Previous
        </button>
        {!isLocked && reviewerId && step < TOTAL_STEPS && (
          <button className="ghost-btn" type="button" onClick={() => saveEvaluation("draft")} disabled={saving} style={{ fontSize: 13 }}>
            {saving ? "Saving…" : "Save Progress"}
          </button>
        )}
        {step < TOTAL_STEPS && (
          <button className="primary-btn" type="button" onClick={next}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}
