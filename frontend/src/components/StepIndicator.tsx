// (Applicant) Progress Tracker to show which step they are on 
import { useEffect, useState } from "react";
import {
  Sparkles,
  User,
  FileText,
  ScrollText,
  Upload,
  ClipboardCheck,
} from "lucide-react";
import { supabase } from "../lib/supabase";

/* This component includes: 
- current step number 
- a function to call when a step is clicked (to allow navigation between steps)
- user info and logout button in the footer 
*/
type StepIndicatorProps = {
  currentStep: number;
  onLogout?: () => void;
  onNavigateToStep?: (step: number) => void;
};

const STEPS = [
  { id: 1, label: "Personal Info",      icon: <User size={16} /> },
  { id: 2, label: "Personal Statement", icon: <ScrollText size={16} /> },
  { id: 3, label: "Resume / CV",        icon: <FileText size={16} /> },
  { id: 4, label: "Portfolio",          icon: <Upload size={16} /> },
  { id: 5, label: "Other Uploads",      icon: <Upload size={16} /> },
  { id: 6, label: "Review & Submit",    icon: <ClipboardCheck size={16} /> },
];

export default function StepIndicator({
  currentStep,
  onLogout,
  onNavigateToStep,
}: StepIndicatorProps) {
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("Applicant");

  // fetching data from Supabase auth to display user info in the footer also used for logout 
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? "");
        const name = user.user_metadata?.name ?? user.user_metadata?.full_name;
        setUserName(name || user.email?.split("@")[0] || "Applicant");
      }
    });
  }, []);

  return (
    /* (FigmaMake 2025) */
    <aside className="reviewer-sidebar applicant-sidebar">
      {/* Brand */}
      <div className="reviewer-brand">
        <div className="reviewer-logo" aria-hidden="true">
          <Sparkles size={16} />
        </div>
        <div>
          <div className="reviewer-brand-title">Scholarship System</div>
          <div className="reviewer-brand-sub">Applicant Portal</div>
        </div>
      </div>

      {/* Steps */}
      <nav className="reviewer-nav" aria-label="Application steps">
        {STEPS.map((s) => {
          const isActive = s.id === currentStep;
          const isDone   = s.id < currentStep;
          const canClick = isDone && !!onNavigateToStep;
          return (
            <div
              key={s.id}
              role={canClick ? "button" : undefined}
              tabIndex={canClick ? 0 : undefined}
              className={`reviewer-nav-item ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`}
              style={{
                cursor: canClick ? "pointer" : "default",
                opacity: !isActive && !isDone ? 0.5 : 1,
              }}
              onClick={() => canClick && onNavigateToStep(s.id)}
              onKeyDown={(e) => e.key === "Enter" && canClick && onNavigateToStep(s.id)}
            >
              {s.icon}
              <span>{s.label}</span>
              {isDone && (
                <span style={{
                  marginLeft: "auto", fontSize: 10, fontWeight: 800,
                  background: "rgba(37,99,235,0.12)", color: "var(--blue)",
                  borderRadius: 6, padding: "2px 6px", letterSpacing: "0.04em",
                }}>
                  DONE
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="reviewer-footer-card">
        <div className="reviewer-footer-avatar">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="reviewer-footer-meta">
          <div className="reviewer-footer-title">{userName}</div>
          <div className="reviewer-footer-text">{userEmail}</div>
          {onLogout && (
            <button
              type="button"
              className="reviewer-logout-inline"
              onClick={onLogout}
            >
              Log out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
