// (Admin) Cycles management and archive download page
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/card";
import { Button } from "../shared/button";
import { supabase } from "../lib/supabase";
import { adminFetch, NODE_API } from "../lib/api";

// Cycle includes: ID, name, status, start date, and an end date that might not exist yet if it's still active.
type Cycle = { id: string; name: string; status: string; created_at: string; ended_at: string | null };

/* This component needs: 
- a list of cycles, 
- a function to call when any cycle changes, 
- and a function to call when a specific cycle is selected (telling it which one by id).
*/
interface Props { 
  cycles: Cycle[];
  onCycleChange: () => void;
  onSelectCycle: (id: string) => void;
}

export function CyclesArchive({ cycles, onCycleChange, onSelectCycle }: Props) {

  const [isCreateOpen, setIsCreateOpen] = useState(false); 
  const [newName, setNewName] = useState(""); 
  const [creating, setCreating] = useState(false); 
  const [createError, setCreateError] = useState<string | null>(null); 
  const [downloading, setDownloading] = useState<string | null>(null);
  const [ending, setEnding] = useState<string | null>(null);

  // count of active and archived cycles 
  const activeCount   = cycles.filter((c) => c.status === "active").length; 
  const archivedCount = cycles.filter((c) => c.status === "archived").length; 

  // create cycle with API call, with error handling and loading state
  async function createCycle() {
    // validation
    if (!newName.trim()) { setCreateError("Cycle name is required."); return; }
    setCreating(true);
    setCreateError(null);
    // API call to create cycle, then refresh list on success
    try {
      const res = await adminFetch("/admin/cycles", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      // handle errors from API
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      setNewName("");
      setIsCreateOpen(false);
      onCycleChange();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create cycle.");
    } finally {
      setCreating(false);
    }
  }

  // end cycle API call with confirmation, loading state, and error handling
  async function endCycle(id: string) {
    if (!window.confirm("End this cycle? It will be archived and no new applications will be assigned to it.")) return;
    setEnding(id);
    // API call to end cycle, then refresh list on success
    try {
      await adminFetch(`/admin/cycles/${id}/end`, { method: "PATCH" });
      onCycleChange();
    } finally {
      setEnding(null);
    }
  }

  // download cycle data as ZIP, with loading state and error handling
  async function downloadCycle(id: string, name: string) {
    setDownloading(id);
    try {
      // token authorizaion 
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${NODE_API}/admin/cycles/${id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { window.alert("Download failed."); return; }

      /* (Claude Code, 2026)
        I have a function that I want to allow admin to download all the data for a specific cycle as a ZIP file.
        Token authorization and endboint are handled, 
        I want to be able to trigger the download and show loading state while it's being prepared, and handle errors if the download fails, 
        ensuring it is saved on the users local device and includes the necessary information
      */

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  /* (FigmaMake 2025) */
  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h1 className="admin-title">Cycles & Archive</h1>
        <p className="admin-subtitle">Manage application cycles and download archived data</p>
      </div>

      {/* Stats */}
      <div className="admin-grid admin-grid-4" style={{ marginBottom: 16 }}>
        <div className="admin-card">
          <div className="admin-card-body">
            <div className="muted" style={{ fontWeight: 800 }}>Total Cycles</div>
            <div className="stat-num">{cycles.length}</div>
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-body">
            <div className="muted" style={{ fontWeight: 800 }}>Active</div>
            <div className="stat-num">{activeCount}</div>
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-body">
            <div className="muted" style={{ fontWeight: 800 }}>Archived</div>
            <div className="stat-num">{archivedCount}</div>
          </div>
        </div>
      </div>

      {/* Cycles table */}
      <Card className="admin-card">
        <CardHeader className="admin-card__header">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <CardTitle className="admin-card__title">All Cycles</CardTitle>
            <Button className="admin-primary-btn" onClick={() => { setCreateError(null); setIsCreateOpen(true); }}>
              + New Cycle
            </Button>
          </div>
        </CardHeader>

        <CardContent className="admin-card__content">
          {cycles.length === 0 ? (
            <p className="admin-empty">No cycles yet. Create one to start tracking applications.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Created</th>
                    <th>Ended</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700, color: "var(--navy)" }}>{c.name}</td>
                      <td className="muted">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="muted">{c.ended_at ? new Date(c.ended_at).toLocaleDateString() : "—"}</td>
                      <td>
                        <span style={{
                          padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                          background: c.status === "active" ? "#dcfce7" : "#f1f5f9",
                          color:      c.status === "active" ? "#166534" : "#475569",
                        }}>
                          {c.status === "active" ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => onSelectCycle(c.id)}
                            style={{ fontSize: 13, padding: "4px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}
                          >
                            View
                          </button>
                          {c.status === "active" && (
                            <button
                              type="button"
                              onClick={() => endCycle(c.id)}
                              disabled={ending === c.id}
                              style={{ fontSize: 13, padding: "4px 12px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff1f2", color: "#b91c1c", cursor: "pointer" }}
                            >
                              {ending === c.id ? "Ending…" : "End Cycle"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadCycle(c.id, c.name)}
                            disabled={downloading === c.id}
                            style={{ fontSize: 13, padding: "4px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#f8fafc", cursor: "pointer" }}
                          >
                            {downloading === c.id ? "Preparing…" : "⬇ Download"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
            Download exports a ZIP with <strong>applications.csv</strong> (full text) and <strong>scores.csv</strong> (AI + reviewer scores).
          </p>
        </CardContent>
      </Card>

      {/* Create cycle */}
      {isCreateOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-wide">
            <div className="modal-title">Create New Cycle</div>
            <div className="modal-text">Give the cycle a name, e.g. "Spring 2026 Scholarship".</div>
            <div style={{ height: 14 }} />
            <div>
              <label className="form-label">Cycle Name</label>
              <input
                className="field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Spring 2026 Scholarship"
                onKeyDown={(e) => e.key === "Enter" && createCycle()}
                autoFocus
              />
              {createError && (
                <p style={{ color: "#ef4444", fontSize: 13, marginTop: 6 }}>{createError}</p>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={createCycle}
                disabled={creating}
              >
                {creating ? "Creating…" : "Create Cycle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
