// (Admin) to manage reviewers 
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/card";
import { Badge } from "../shared/badge";
import { Button } from "../shared/button";
import { Input } from "../shared/input";
import { adminFetch } from "../lib/api";

// reviewer data: id, name, email, active 
type Reviewer = { id: string; name: string; email: string; active: boolean };
// applicant data for counting assigned applicants to each reviewer
type ApplicantRow = { assignedReviewerIds: string[] };

export function ReviewerManagement() {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [assignedCounts, setAssignedCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Reviewer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Deactivate/reactivate state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // load reviewers and assigned counts 
  function load() {
    adminFetch(`/reviewers`).then((r) => r.json()).then(setReviewers).catch(() => {});
    adminFetch(`/admin/applicants`)
      .then((r) => r.json())
      .then((applicants: ApplicantRow[]) => {
        const counts: Record<string, number> = {};
        applicants.forEach((a) =>
          a.assignedReviewerIds.forEach((id) => {
            counts[id] = (counts[id] ?? 0) + 1;
          })
        );
        setAssignedCounts(counts);
      })
      .catch(() => {});
  }

  useEffect(() => { load(); }, []);

  // handle adding a new reviewer by validating the input and sending a POST request to the backend; on success, clear the form and reload the reviewer list
  async function addReviewer() {
    setError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Name, email and password are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setAdding(true);
    const res = await adminFetch(`/reviewers`, {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password: password.trim() }),
    });
    setAdding(false);
    if (res.ok) { setName(""); setEmail(""); setPassword(""); load(); }
    else { const d = await res.json(); setError(d.error ?? "Failed to add reviewer."); }
  }

  async function toggleActive(reviewer: Reviewer) {
    setTogglingId(reviewer.id);
    const action = reviewer.active ? "deactivate" : "reactivate";
    try {
      const res = await adminFetch(`/reviewers/${reviewer.id}/${action}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
      load();
    } catch {
      // silently reload to sync state
      load();
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDeleteReviewer() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await adminFetch(`/reviewers/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Removal failed");
      }
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Removal failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    /* (FigmaMake 2025) */
    
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-title">Reviewer Management</h1>
        <p className="admin-subtitle">Add reviewers, then assign them to applicants from the Applicants tab</p>
      </div>

      {/* Stats */}
      <div className="admin-grid admin-grid-4" style={{ marginBottom: 14 }}>
        <div className="admin-card">
          <div className="admin-card-body">
            <div className="muted stat-label">Total Reviewers</div>
            <div className="stat-num">{reviewers.length}</div>
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-body">
            <div className="muted stat-label">Total Assigned</div>
            <div className="stat-num">{Object.values(assignedCounts).reduce((a, b) => a + b, 0)}</div>
          </div>
        </div>
      </div>

      {/* Add reviewer form */}
      <Card className="admin-card" style={{ marginBottom: 14 }}>
        <CardHeader className="admin-card__header">
          <CardTitle className="admin-card__title">Add Reviewer</CardTitle>
        </CardHeader>
        <CardContent className="admin-card__content">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: 180 }}
            />
            <Input
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: 220 }}
            />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: 160 }}
            />
            <Button className="admin-primary-btn" onClick={addReviewer} disabled={adding}>
              {adding ? "Adding…" : "Add Reviewer"}
            </Button>
          </div>
          {error && <p style={{ color: "#ef4444", marginTop: 8, fontSize: 13 }}>{error}</p>}
        </CardContent>
      </Card>

      {/* Reviewers table */}
      <Card className="admin-card">
        <CardHeader className="admin-card__header">
          <CardTitle className="admin-card__title">Reviewers</CardTitle>
        </CardHeader>
        <CardContent className="admin-card__content">
          {reviewers.length === 0 ? (
            <p className="admin-empty">No reviewers yet. Add one above.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Assigned Applicants</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reviewers.map((r) => {
                    const assigned = assignedCounts[r.id] ?? 0;
                    const isActive = r.active !== false;
                    return (
                      <tr key={r.id} style={{ opacity: isActive ? 1 : 0.6 }}>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td className="muted">{r.email}</td>
                        <td>{assigned}</td>
                        <td>
                          <Badge
                            variant="outline"
                            className={
                              !isActive
                                ? "admin-badge admin-badge--muted"
                                : assigned > 0
                                ? "admin-badge admin-badge--info"
                                : "admin-badge admin-badge--muted"
                            }
                          >
                            {!isActive ? "Deactivated" : assigned > 0 ? "Active" : "Unassigned"}
                          </Badge>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Button
                              variant="outline"
                              onClick={() => toggleActive(r)}
                              disabled={togglingId === r.id}
                              style={{
                                color: isActive ? "#b45309" : "#166534",
                                borderColor: isActive ? "#fde68a" : "#bbf7d0",
                                fontSize: 12,
                                padding: "4px 10px",
                              }}
                            >
                              {togglingId === r.id ? "…" : isActive ? "Deactivate" : "Reactivate"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => { setDeleteTarget(r); setDeleteError(null); }}
                              style={{ color: "#ef4444", borderColor: "#fca5a5", fontSize: 12, padding: "4px 10px" }}
                            >
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
              Remove Reviewer?
            </div>
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 20 }}>
              You are about to permanently remove{" "}
              <strong>{deleteTarget.name}</strong> ({deleteTarget.email}) from the system.
              Their account will be deleted and they will lose access immediately.
              <br /><br />
              {assignedCounts[deleteTarget.id] > 0 && (
                <span style={{ color: "#b45309" }}>
                  ⚠ This reviewer is currently assigned to{" "}
                  <strong>{assignedCounts[deleteTarget.id]}</strong> applicant(s).
                  Existing evaluations will be preserved.
                  <br /><br />
                </span>
              )}
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
                onClick={confirmDeleteReviewer}
                disabled={deleting}
                style={{ background: "#dc2626", color: "white", border: "none" }}
              >
                {deleting ? "Removing…" : "Yes, Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
