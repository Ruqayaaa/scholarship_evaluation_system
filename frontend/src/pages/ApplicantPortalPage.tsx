import { useEffect, useRef, useState } from "react";
import { Step1PersonalInfo } from "../components/Step1PersonalInfo";
import { Step2PersonalStatement } from "../components/Step2PersonalStatement";
import { Step3Resume } from "../components/Step3Resume";
import { Step4Portfolio } from "../components/Step4Portfolio";
import { Step5OtherUploads } from "../components/Step5OtherUploads";
import { Step6Review } from "../components/Step6Review";
import type { ApplicationData } from "../types";
import StepIndicator from "../components/StepIndicator";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { NODE_API } from "../lib/api";

// desicion styles for submitted application status display
const DECISION_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  Accepted:   { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", color: "#166534" },
  Rejected:   { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)",  color: "#991b1b" },
  Waitlisted: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", color: "#92400e" },
};

// unique ID for form entries 
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

/* (Figma Make, 2025) I want to create a form with different sections that include the following sections & their subfields: 
personal info: full name, date of birth, country of residence, chosen major, university, GPA, graduation year, IELTS score
personal statement: values and goals, why this major, interests, summary, file upload
resume: file upload, education history (institution, degree, start/end year, GPA), experience (job title, organization, start/end date, responsibilities), skills (list), awards (name, year, description), community involvement (organization, role, start/end date, description), leadership (role, organization, start/end date, description)
portfolio: links to projects or work samples, file uploads for additional materials
other uploads: transcript upload, IELTS score upload, optional CV upload, optional personal statement upload, additional documents upload
*/

// intial form data structure with empty/default values
function buildDefaultAppData(): ApplicationData {
  return {
    personalInfo: {
      fullName: "",
      dateOfBirth: "",
      country: "",
      chosenMajor: "",
      university: "",
      gpa: "",
      graduationYear: "",
      ieltsScore: "",
    },
    personalStatement: {
      valuesGoals: "",
      whyMajor: "",
      interests: "",
      summary: "",
      uploadedFile: [],
    },
    resume: {
      uploadedFile: [],
      education:  [{id: uid(), institution: "", degree: "", startYear: "", endYear: "", gpa: ""}],
      experience: [{ id: uid(), jobTitle: "", organization: "", startDate: "", endDate: "", responsibilities: "" }],
      skills:     [],
      awards:     [{ id: uid(), name: "", year: "", description: "" }],
      community:  [{ id: uid(), organization: "", role: "", startDate: "", endDate: "", description: "" }],
      leadership: [{ id: uid(), role: "", organization: "", startDate: "", endDate: "", description: "" }],
    },
    portfolio: { links: [], files: [] },
    documents: {
      transcript: [],
      ielts: [],
      cvOptional: [],
      statementOptional: [],
      additional: [],
    },
  };
}

// Restore saved draft data 
// https://www.pluralsight.com/resources/blog/guides/load-an-existing-database-record-to-a-reactjs-form
function applyDraft(saved: any, base: ApplicationData): ApplicationData {
  if (!saved || typeof saved !== "object") return base;
  return {
    ...base,
    personalInfo: { ...base.personalInfo, ...(saved.personalInfo ?? {}) },
    personalStatement: {
      ...base.personalStatement,
      ...(saved.personalStatement ?? {}),
      uploadedFile: [],
    },
    resume: {
      ...base.resume,
      education:  saved.resume?.education?.length  ? saved.resume.education  : base.resume.education,
      experience: saved.resume?.experience?.length ? saved.resume.experience : base.resume.experience,
      skills:     saved.resume?.skills             ?? base.resume.skills,
      awards:     saved.resume?.awards?.length     ? saved.resume.awards     : base.resume.awards,
      community:  saved.resume?.community?.length  ? saved.resume.community  : base.resume.community,
      leadership: saved.resume?.leadership?.length ? saved.resume.leadership : base.resume.leadership,
    },
  };
}

// Extract & save the fields to JSON
function serializeDraft(data: ApplicationData) {
  return {
    personalInfo: data.personalInfo,
    personalStatement: {
      valuesGoals: data.personalStatement.valuesGoals,
      whyMajor:    data.personalStatement.whyMajor,
      interests:   data.personalStatement.interests,
      summary:     data.personalStatement.summary,
    },
    resume: {
      education:  data.resume.education,
      experience: data.resume.experience,
      skills:     data.resume.skills,
      awards:     data.resume.awards,
      community:  data.resume.community,
      leadership: data.resume.leadership,
    },
  };
}

export default function ApplicantPortalPage() {
  // steps 
  const [step, setStep] = useState(1);
  // application status
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [finalDecision, setFinalDecision] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<string | null>(null);
  const [interviewAt, setInterviewAt] = useState<string | null>(null);
  const [interviewMessage, setInterviewMessage] = useState<string | null>(null);
  // draft saved 
  const [draftSaved, setDraftSaved] = useState(false);
  //entire form data 
  const [appData, setAppData] = useState<ApplicationData>(buildDefaultAppData);

  // not autosave until user does something
  const autoSaveEnabled = useRef(false);
  // to avoid multiple rapid saves 
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useNavigate();

  // gets the application status  
  useEffect(() => {
    async function checkStatus() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        autoSaveEnabled.current = true;
        return;
      }
      try {
        const res = await fetch(`${NODE_API}/applicants/${session.user.id}/application`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data) return;

        if (data.status === "Draft") {
          // Restore saved draft into the form
          const savedDraft = data.personalStatement?.input?._draft;
          if (savedDraft) {
            setAppData((prev) => applyDraft(savedDraft, prev));
          }
        } else if (data.status) {
          // Any no draft status means it has been submitted
          setIsSubmitted(true);
          if (data.decisionVisible && data.finalDecision && data.finalDecision !== "Pending") {
            setFinalDecision(data.finalDecision);
            if (data.decisionNotes) setDecisionNotes(data.decisionNotes);
          }
          if (data.interviewAt) {
            setInterviewAt(data.interviewAt);
            if (data.interviewMessage) setInterviewMessage(data.interviewMessage);
          }
        }
      } catch {
        //  fail
      } finally {
        // Enable auto-save now that the user filled in
        autoSaveEnabled.current = true;
      }
    }
    checkStatus();
  }, []);

  //  API call to save draft 
  // https://medium.com/@amattam427/http-patch-method-237f60662652
  async function saveDraftToDb(data: ApplicationData) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    try {
      await fetch(`${NODE_API}/applicants/${session.user.id}/draft`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ draftData: serializeDraft(data) }),
      });
    } catch {
      //fails, but shouldn't interrupt the user
    }
  }

  //  Manual save (shows confirmation banner) 
  const handleSaveDraft = () => {
    saveDraftToDb(appData);
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2500);
  };

  // logging out 
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  /* (Figma make, 2025), same as above lines 24-30 */

  // Rendering the form steps or status
  return (
    <div className="bg-shell">
      <div className="reviewer-layout">
        <div className="reviewer-body">

          <StepIndicator
            currentStep={isSubmitted ? 6 : step}
            onLogout={handleLogout}
            onNavigateToStep={isSubmitted ? undefined : (s) => { if (s < step) setStep(s); }}
          />

          {/* Draft saved banner */}
          {draftSaved && (
            <div style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 9000,
              padding: "12px 20px",
              background: "#16a34a",
              color: "white",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              boxShadow: "0 4px 20px rgba(22,163,74,0.35)",
            }}>
              Draft saved to your account.
            </div>
          )}

          {/* Main */}
          <main className="reviewer-main" role="main">
            <div className="card" style={{ width: "100%" }}>
              {/* SUBMITTED STATE */}
              {isSubmitted ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <div className="auth-tag" style={{ marginBottom: 10 }}>SUBMITTED</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "var(--navy)" }}>
                      Application received
                    </div>
                    <p style={{ color: "var(--muted)", lineHeight: 1.6, margin: "6px 0 0" }}>
                      Your application is locked and under review. We'll update this page once a decision is made.
                    </p>
                  </div>

                  {interviewAt && !finalDecision && (
                    <div style={{
                      padding: "14px 16px", borderRadius: 10,
                      background: "rgba(37,99,235,0.06)", border: "1.5px solid rgba(37,99,235,0.25)", color: "var(--navy)",
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Interview Scheduled</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {new Date(interviewAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                      </div>
                      {interviewMessage && (
                        <div style={{ fontSize: 13, marginTop: 4, color: "#374151", lineHeight: 1.6 }}>{interviewMessage}</div>
                      )}
                    </div>
                  )}

                  {finalDecision ? (
                    <div style={{
                      padding: "14px 16px", borderRadius: 10,
                      background: DECISION_STYLE[finalDecision]?.bg ?? "rgba(0,0,0,0.04)",
                      border: `1.5px solid ${DECISION_STYLE[finalDecision]?.border ?? "#e5e7eb"}`,
                      color: DECISION_STYLE[finalDecision]?.color ?? "var(--navy)",
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: decisionNotes ? 6 : 0 }}>
                        Decision: {finalDecision}
                      </div>
                      {decisionNotes && <div style={{ fontSize: 13, lineHeight: 1.6 }}>{decisionNotes}</div>}
                    </div>
                  ) : (
                    <div style={{
                      padding: "12px 14px", borderRadius: 10,
                      background: "rgba(29,161,242,0.08)", border: "1.5px solid rgba(29,161,242,0.20)",
                      color: "#1DA1F2", fontWeight: 700, fontSize: 13,
                    }}>
                      Under review — check back for updates.
                    </div>
                  )}

                  <div>
                    <button type="button" onClick={handleLogout} className="logout-btn">Log out</button>
                  </div>
                </div>
              ) : (
                <>
                  {step === 1 && (
                    <Step1PersonalInfo
                      data={appData.personalInfo}
                      onUpdate={(next) => setAppData((p) => ({ ...p, personalInfo: next }))}
                      onNext={() => setStep(2)}
                      onSaveDraft={handleSaveDraft}
                    />
                  )}
                  {step === 2 && (
                    <Step2PersonalStatement
                      data={appData.personalStatement}
                      onUpdate={(next) => setAppData((p) => ({ ...p, personalStatement: next }))}
                      onBack={() => setStep(1)}
                      onNext={() => setStep(3)}
                      onSaveDraft={handleSaveDraft}
                    />
                  )}
                  {step === 3 && (
                    <Step3Resume
                      data={appData.resume}
                      onUpdate={(next) => setAppData((p) => ({ ...p, resume: next }))}
                      onBack={() => setStep(2)}
                      onNext={() => setStep(4)}
                      onSaveDraft={handleSaveDraft}
                    />
                  )}
                  {step === 4 && (
                    <Step4Portfolio
                      data={appData.portfolio}
                      onUpdate={(next) => setAppData((p) => ({ ...p, portfolio: next }))}
                      onBack={() => setStep(3)}
                      onNext={() => setStep(5)}
                    />
                  )}
                  {step === 5 && (
                    <Step5OtherUploads
                      data={appData.documents}
                      onUpdate={(next) => setAppData((p) => ({ ...p, documents: next }))}
                      onBack={() => setStep(4)}
                      onNext={() => setStep(6)}
                    />
                  )}
                  {step === 6 && (
                    <Step6Review
                      data={appData}
                      onBack={() => setStep(5)}
                      onSubmitted={() => {
                        setIsSubmitted(true);
                        setStep(6);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
