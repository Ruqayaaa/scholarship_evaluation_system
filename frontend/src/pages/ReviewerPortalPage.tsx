import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/ReviewerSidebar";
import ApplicantList from "../components/ReviewerApplicantList";
import EvaluationScreen from "../components/EvaluationScreen";
import ChangePasswordModal from "../components/ChangePasswordModal";
import type { Applicant } from "../types";
import type { PsScores, ResumeScores } from "../lib/scores";
import { supabase } from "../lib/supabase";
import { NODE_API } from "../lib/api";

// This file contains the main reviewer portal page, which includes:
type BackendApplicant = {
  id: string;
  name: string;
  submittedAt: string;
  status: string;
  assignedReviewerIds: string[];
  reviewerEvaluations?: { status: string; recommendation: string }[];
  personalStatement: {
    input: Record<string, string>;
    score: Record<string, number | string[]>;
  } | null;
  resume: {
    input: Record<string, string>;
    score: Record<string, number | string>;
  } | null;
  portfolio: {
    summary: string;
    items: { title: string; description: string; url: string }[];
  } | null;
};

//converts backend applicant format to frontend format, including AI score calculations and formatting for the review panel
function toApplicant(a: BackendApplicant): Applicant {
  const ps = a.personalStatement;
  const re = a.resume;

  const psScore = ps?.score as Record<string, number | string[]> | undefined;
  const reScore = re?.score as Record<string, number | string> | undefined;

  // Overall AI score: average PS (0–100) and resume (0–180 → 0–100), display 0–100
  const aiScores: number[] = [];
  if (psScore?.overall_score) aiScores.push(psScore.overall_score as number);
  if (reScore?.overall_score) aiScores.push(((reScore.overall_score as number) / 180) * 100);
  const aiScore = aiScores.length
    ? Math.round(aiScores.reduce((x, y) => x + y, 0) / aiScores.length)
    : 0;

  // All personal info fields for the review panel
  const formFields = [
    { label: "Submitted", value: new Date(a.submittedAt).toLocaleDateString() },
    { label: "Status", value: a.status },
  ].filter((f) => f.value);

  // Full text answers shown in the review panel
  const answers = [
    { question: "Interests & Values", answer: ps?.input?.academic_goals ?? "" },
    { question: "Academic Commitment", answer: ps?.input?.career_goals ?? "" },
    { question: "Clarity of Vision", answer: ps?.input?.leadership_experience ?? "" },
    { question: "Closing Summary", answer: ps?.input?.personal_statement ?? "" },
    { question: "Resume Text", answer: re?.input?.resume_text ?? "" },
  ].filter((q) => q.answer);

  const strengths = Array.isArray(psScore?.strengths) ? (psScore!.strengths as string[]) : [];
  const improvements = Array.isArray(psScore?.improvements) ? (psScore!.improvements as string[]) : [];

  // Per-criterion scores (0–20 each, max 100)
  const psScores: PsScores | undefined = psScore
    ? {
        interests_and_values: (psScore.interests_and_values as number) || 0,
        academic_commitment: (psScore.academic_commitment as number) || 0,
        clarity_of_vision: (psScore.clarity_of_vision as number) || 0,
        organization: (psScore.organization as number) || 0,
        language_quality: (psScore.language_quality as number) || 0,
        overall_score: (psScore.overall_score as number) || 0,
        grade_pct: (psScore.grade_pct as number) || 0,
        strengths,
        improvements,
      }
    : undefined;

  // Per-criterion resume scores (0–30 each, max 180)
  const resumeStrengths = Array.isArray(reScore?.strengths) ? (reScore!.strengths as string[]) : [];
  const resumeImprovements = Array.isArray(reScore?.improvements) ? (reScore!.improvements as string[]) : [];
  const resumeScores: ResumeScores | undefined = reScore
    ? {
        academic_achievement: (reScore.academic_achievement as number) || 0,
        leadership_and_extracurriculars: (reScore.leadership_and_extracurriculars as number) || 0,
        community_service: (reScore.community_service as number) || 0,
        research_and_work_experience: (reScore.research_and_work_experience as number) || 0,
        skills_and_certifications: (reScore.skills_and_certifications as number) || 0,
        awards_and_recognition: (reScore.awards_and_recognition as number) || 0,
        overall_score: (reScore.overall_score as number) || 0,
        justification: (reScore.justification as string) || "",
        strengths: resumeStrengths,
        improvements: resumeImprovements,
      }
    : undefined;

  // Summarised breakdown for the bar chart (each 0–10)
  const norm20 = (v: number) => Math.round((v / 20) * 10);
  const norm30 = (v: number) => Math.round((v / 30) * 10);

  return {
    id: a.id,
    name: a.name,
    // Derive status from the reviewer's own evaluation (RLS means they only see their own)
    status: (a.reviewerEvaluations?.[0]?.status === "submitted"
      ? "Evaluated"
      : a.reviewerEvaluations?.[0]?.status === "draft"
      ? "Incomplete"
      : "Pending"),
    scholarship: "Scholarship Application",
    formFields,
    answers,
    documents: [],
    aiScore,
    aiBreakdown: {
      academic: norm20(psScores?.academic_commitment ?? 0) || norm30(resumeScores?.academic_achievement ?? 0),
      leadership: norm20(psScores?.interests_and_values ?? 0) || norm30(resumeScores?.leadership_and_extracurriculars ?? 0),
      financial: 0,
      statement: norm20(psScores?.clarity_of_vision ?? 0),
    },
    aiFeedback: strengths.join(" ") || "No AI feedback yet.",
    aiSummary: {
      strengths: strengths.length ? strengths : ["Awaiting AI analysis"],
      weaknesses: improvements.length ? improvements : [],
    },
    psScores,
    resumeScores,
    portfolio: a.portfolio ?? undefined,
  };
}

/* (Figma Make, 2025) This is the main reviewer portal page component, includes: 
- Fetching the list of applicants assigned to the logged-in reviewer from the backend, including their personal statement and resume scores and feedback
- Displaying the list of applicants in a sidebar, showing their name, submission date, status, and AI score summary
- When an applicant is selected, showing the detailed evaluation screen with all their answers, documents, AI feedback, and allowing the reviewer to submit their evaluation
*/

export default function ReviewerPortalPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch(`${NODE_API}/reviewer/${user.id}/applicants`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data: BackendApplicant[] = await res.json();
        setApplicants(data.map(toApplicant));
      } catch {
        // silently fail — reviewer just sees empty list
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div className="bg-shell"><p style={{ padding: 24 }}>Loading…</p></div>;
  }

  return (
    <div className="bg-shell">
      {showSettings && <ChangePasswordModal onClose={() => setShowSettings(false)} />}
      <div className="reviewer-layout">
        <div className="reviewer-body">
          <Sidebar
            onNavigateApplicants={() => setSelectedApplicant(null)}
            onSettings={() => setShowSettings(true)}
            onLogout={handleLogout}
          />
          <main className="reviewer-main">
            {!selectedApplicant ? (
              <ApplicantList
                applicants={applicants}
                cycleName="Current Cycle"
                onSelectApplicant={setSelectedApplicant}
                onBack={() => {}}
              />
            ) : (
              <EvaluationScreen
                applicant={selectedApplicant}
                onBack={() => setSelectedApplicant(null)}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
