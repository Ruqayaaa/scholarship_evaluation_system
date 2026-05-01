// (Reviewer) Applicant overall list view 
import type { Applicant } from "../types";

//status styles 
const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  Pending:    { background: "#f1f5f9", color: "#475569" },
  Incomplete: { background: "#fef3c7", color: "#92400e" },
  Evaluated:  { background: "#dcfce7", color: "#166534" },
  "In Review": { background: "#e0f2fe", color: "#0369a1" },
};

/* This component needs:
- a list of applicants to display (id, name, scholarship, status)
- the name of the current cycle (for the header)
- a function to call when an applicant is selected (telling it which applicant was clicked) */
interface ApplicantListProps {
  applicants: Applicant[];
  cycleName: string;
  onSelectApplicant: (applicant: Applicant) => void;
  onBack?: () => void;
}

export default function ApplicantList({
  applicants,
  cycleName,
  onSelectApplicant,
}: ApplicantListProps) {
   /* (FigmaMake 2025) */
  return (
    <div className="reviewer-page">
      <div className="reviewer-page-head">
        <h2 className="reviewer-page-title">{cycleName}</h2>
        <p className="reviewer-page-sub">
          Review and evaluate scholarship applications
        </p>
      </div>

      <div className="reviewer-list">
        {applicants.map((a) => (
          <div className="reviewer-card" key={a.id}>
            <div className="reviewer-card-main">
              <div className="reviewer-card-title">{a.name}</div>
              <div className="reviewer-card-sub">{a.scholarship}</div>
            </div>

            <div className="reviewer-card-actions">
              <span
                style={{
                  padding: "3px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  ...(STATUS_STYLE[a.status] ?? { background: "#f1f5f9", color: "#475569" }),
                }}
              >
                {a.status}
              </span>

              <button
                className="primary-btn"
                type="button"
                onClick={() => onSelectApplicant(a)}
              >
                Evaluate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
