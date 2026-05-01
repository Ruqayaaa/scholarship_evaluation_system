// (Admin) dashboard overview component showing stats and recent applicants
import { useEffect, useState } from "react";
import { Button } from "../shared/button";
import { adminFetch } from "../lib/api";

/* This component needs:
- view all applicant 
- can be filtered by cycle 
*/
interface OverviewProps {
  onViewApplicants: () => void; 
  cycleId?: string;
}

// Stats: total applicants, submitted, under review, accepted, rejected, waitlisted, active reviewers
type Stats = { total: number; submitted: number; underReview: number; evaluated: number; accepted: number; waitlisted: number; rejected: number; reviewers: number };
// Recent applicants table: id, name, submitted date, status (with color coding), and a delete button for each row
type Row   = { id: string; name: string; submittedAt: string; status: string };
// Applicant data: id, name, submission date, status, final decision, personal statement score (if evaluated), resume score (if evaluated)
type BackendApplicant = {
  id: string;
  name: string;
  submittedAt: string;
  status: string;
  finalDecision: string;
  personalStatement: { score: Record<string, number> } | null;
  resume: { score: Record<string, number> } | null;
};

// cards for the stats at the top of the overview page
const STATS_CONFIG = [
  { key: "total",       label: "Total Applicants", sub: "All submissions"   },
  { key: "submitted",   label: "Submitted",         sub: "Awaiting review"  },
  { key: "underReview", label: "Under Review",      sub: "Reviewer assigned" },
  { key: "reviewers",   label: "Active Reviewers",  sub: "Total registered"  },
] as const;

export function Overview({ onViewApplicants, cycleId }: OverviewProps) {
  const [stats, setStats] = useState<Stats>({ total: 0, submitted: 0, underReview: 0, evaluated: 0, accepted: 0, waitlisted: 0, rejected: 0, reviewers: 0 });
  const [latest, setLatest] = useState<Row[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function loadData() {
    setLoadingStats(true);
    // checks if cycle is selected 
    const qs = cycleId ? `?cycleId=${cycleId}` : "";

    // fetch stats and latest applicants 
    adminFetch(`/admin/stats${qs}`)
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoadingStats(false); })
      .catch(() => { setLoadingStats(false); });

    // fetches the 5 most recent applicants for the recent submissions table, with an option to filter by cycle if cycleId is provided
    adminFetch(`/admin/applicants${qs}`)
      .then((r) => r.json())
      .then((data: BackendApplicant[]) => {
        const rows: Row[] = data
          .slice(-5)
          .reverse()
          .map((a) => ({
            id: a.id,
            name: a.name,
            submittedAt: new Date(a.submittedAt).toLocaleDateString(),
            status: (a.finalDecision && a.finalDecision !== "Pending") ? a.finalDecision : a.status,
          }));
        setLatest(rows);
      })
      .catch(() => {});
  }

  useEffect(() => { loadData(); }, [cycleId]);

  // applicant deletions and ensures its irreversible 
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await adminFetch(`/admin/applicants/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Deletion failed");
      }
      setDeleteTarget(null);
      loadData();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Deletion failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    /* (FigmaMake 2025) */
    
    <div className="admin-page">
      <div className="admin-page-head">
        <h1 className="admin-page-title">Overview</h1>
        <p className="admin-page-sub">Monitor applications and evaluation progress</p>
      </div>

      {/* Stat cards */}
      <div className="ds-stat-grid">
        {STATS_CONFIG.map(({ key, label, sub }) => (
          <div key={key} className="ds-stat-card">
            <div className="ds-stat-label">{label}</div>
            <div className="ds-stat-num">{loadingStats ? "…" : stats[key]}</div>
            <div className="ds-stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Recent submissions table */}
      <div className="ds-table-card">
        <div className="ds-table-head">
          <h2 className="ds-table-title">Recent Submissions</h2>
          <Button variant="outline" size="sm" onClick={onViewApplicants}>
            View All
          </Button>
        </div>

        {latest.length === 0 ? (
          <p className="admin-empty" style={{ padding: "20px 18px" }}>
            No submissions yet.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {latest.map((a) => (
                  <tr key={a.id}>
                    <td className="admin-td--name">{a.name}</td>
                    <td className="admin-td--muted">{a.submittedAt}</td>
                    <td>
                      {(() => {
                        const S: Record<string, { bg: string; color: string }> = {
                          "Submitted":    { bg: "#f1f5f9", color: "#475569" },
                          "Under Review": { bg: "#e0f2fe", color: "#0369a1" },
                          "Evaluated":    { bg: "#ede9fe", color: "#6d28d9" },
                          "Accepted":     { bg: "#dcfce7", color: "#166534" },
                          "Waitlisted":   { bg: "#fef3c7", color: "#92400e" },
                          "Rejected":     { bg: "#fee2e2", color: "#991b1b" },
                        };
                        const s = S[a.status] ?? { bg: "#f1f5f9", color: "#475569" };
                        return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color }}>{a.status}</span>;
                      })()}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setDeleteTarget(a); setDeleteError(null); }}
                        style={{ color: "#ef4444", borderColor: "#fca5a5", fontSize: 12 }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(15,23,42,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
          onClick={() => { if (!deleting) setDeleteTarget(null); }}
        >
          <div
            style={{
              background: "white", borderRadius: 14, padding: "28px 32px",
              maxWidth: 420, width: "90%", boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 10 }}>
              Delete Applicant?
            </div>
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 20 }}>
              You are about to permanently delete the application for{" "}
              <strong>{deleteTarget.name}</strong>. This will also remove all
              reviewer assignments and evaluations for this application.
              <br /><br />
              <strong style={{ color: "#dc2626" }}>This action cannot be undone.</strong>
            </p>
            {deleteError && (
              <p style={{ fontSize: 13, color: "#dc2626", fontWeight: 600, marginBottom: 12 }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleting}
                style={{ background: "#dc2626", color: "white", border: "none" }}
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
