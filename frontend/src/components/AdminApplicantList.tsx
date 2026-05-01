// (Admin) Applicants list view 
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/card";
import { Button } from "../shared/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../shared/select";
import { adminFetch } from "../lib/api";

/* This component needs:
- a function to call when an applicant is selected (telling it which applicant was clicked)
- (optional) may be filtered by a cycle
*/

interface ApplicantsListProps {
  onViewApplicant: (id: string) => void;
  cycleId?: string;
}

// Returned applicant data includes: id, name, submission date, status, assigned reviewers count, whether they're a returning applicant, and more details for the applicant detail view.
type BackendApplicant = {
  id: string;
  name: string;
  submittedAt: string;
  status: string;
  finalDecision: string;
  assignedReviewerIds: string[];
  returning?: boolean;
  personalStatement: { input: Record<string, unknown>; score: Record<string, unknown> } | null;
  resume: { input: Record<string, unknown>; score: Record<string, unknown> } | null;
};

// Row: displays simplified version of applicant data for the table 
type Row = {
  id: string;
  name: string;
  submittedAt: string;
  status: string;
  assignedCount: number;
  returning: boolean;
};


// status styles
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  "Submitted":     { bg: "#f1f5f9", color: "#475569" },
  "Under Review":  { bg: "#e0f2fe", color: "#0369a1" },
  "Evaluated":     { bg: "#ede9fe", color: "#6d28d9" },
  "Accepted":      { bg: "#dcfce7", color: "#166534" },
  "Waitlisted":    { bg: "#fef3c7", color: "#92400e" },
  "Rejected":      { bg: "#fee2e2", color: "#991b1b" },
};

function statusStyle(status: string) {
  return STATUS_BADGE[status] ?? { bg: "#f1f5f9", color: "#475569" };
}

export function ApplicantsList({ onViewApplicant, cycleId }: ApplicantsListProps) {

  // applicant rows
  const [rows, setRows] = useState<Row[]>([]); 
  // loading state for data fetching
  const [loading, setLoading] = useState(true); 
  // filter for applicant status
  const [statusFilter, setStatusFilter] = useState("all"); 
  
  // Fetch applicants from the backend, can be filtered by cycleId
  useEffect(() => {
    setLoading(true);
    const qs = cycleId ? `?cycleId=${cycleId}` : "";
    adminFetch(`/admin/applicants${qs}`)
      .then((r) => r.json())
      .then((data: BackendApplicant[]) => {
        setRows(
          data.map((a) => ({
            id: a.id,
            name: a.name,
            submittedAt: new Date(a.submittedAt).toLocaleString(),
            status: (a.finalDecision && a.finalDecision !== "Pending") ? a.finalDecision : a.status,
            assignedCount: a.assignedReviewerIds.length,
            returning: a.returning ?? false,
          }))
        );
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [cycleId]);

  // filter applicants based on status 
  const filtered = useMemo(
    () => rows.filter((r) => statusFilter === "all" || r.status === statusFilter),
    [rows, statusFilter]
  );

  /* (FigmaMake 2025) */
  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-title">Applicants</h1>
        <p className="admin-subtitle">View and manage all scholarship applicants</p>
      </div>

      <Card className="admin-card admin-card--filters">
        <CardHeader className="admin-card__header">
          <CardTitle className="admin-card__title">Filters</CardTitle>
        </CardHeader>
        <CardContent className="admin-card__content">
          <div className="admin-filters">
            <div className="admin-filters__row">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="admin-select">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="Under Review">Under Review</SelectItem>
                  <SelectItem value="Evaluated">Evaluated</SelectItem>
                  <SelectItem value="Accepted">Accepted</SelectItem>
                  <SelectItem value="Waitlisted">Waitlisted</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="admin-card">
        <CardContent className="admin-card__content admin-table-wrap">
          {loading ? (
            <p className="admin-empty">Loading applicants…</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th className="admin-td--center">Reviewers Assigned</th>
                  <th className="admin-td--right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="admin-td--name">
                      {a.name}
                      {a.returning && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#fef3c7", color: "#92400e" }}>
                          Returning
                        </span>
                      )}
                    </td>
                    <td className="admin-td--muted">{a.submittedAt}</td>
                    <td>
                      <span style={{
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        background: statusStyle(a.status).bg,
                        color: statusStyle(a.status).color,
                      }}>
                        {a.status}
                      </span>
                    </td>
                    <td className="admin-td--center">
                      <span className="admin-pill admin-pill--outline">{a.assignedCount}</span>
                    </td>
                    <td className="admin-td--right">
                      <Button className="admin-primary-btn" onClick={() => onViewApplicant(a.id)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      {rows.length === 0
                        ? "No submissions yet. Applicants will appear here after submitting a form."
                        : "No applicants match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          <div className="admin-table-footer">
            <p className="admin-table-footer__text">
              Showing {filtered.length} of {rows.length} applicants
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
