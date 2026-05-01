import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "../components/AdminSidebar";
import { Overview } from "../components/Overview";
import { ApplicantsList } from "../components/AdminApplicantList";
import { ApplicantDetail } from "../components/ApplicantDetail";
import { ReviewerManagement } from "../components/ReviewerManagement";
import { CyclesArchive } from "../components/CyclesArchive";
import { adminFetch } from "../lib/api";

/*
(Figma Make, 2025) I want to create an admin portal with the following views:
- Overview: Key metrics and stats about the application cycles, recent activity, and quick links to manage applicants.
- Applicants: A searchable and filterable list of all applicants, with the ability to view details, change application status, and assign reviewers.
- Reviewers: A management interface for reviewers, including adding/removing reviewers, assigning them to applications, and tracking their review progress.
- Cycles: An archive of past application cycles with details on each cycle's timeline, number of applicants, and outcomes.

*/
export type AdminView = "overview" | "applicants" | "reviewers" | "cycles";
type Cycle = { id: string; name: string; status: string; created_at: string; ended_at: string | null };

export default function AdminPortal() {
  const [view, setView] = useState<AdminView>("overview");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);
  const [overviewKey, setOverviewKey] = useState(0);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");

  // Load cycles from the server, set it as an active cycle if it's active
  function loadCycles(setActive = false) {
    adminFetch("/admin/cycles")
      .then((r) => r.json())
      .then((data: Cycle[]) => {
        if (!Array.isArray(data)) return;
        setCycles(data);
        const active = data.find((c) => c.status === "active");
        if (active && (setActive || !selectedCycleId)) setSelectedCycleId(active.id);
      })
      .catch(() => {});
  }

  // auto select admin portal to active cycle on load
  useEffect(() => { loadCycles(true); }, []);
  // reload cycles after changes in the CyclesArchive view
  function reloadCycles() { loadCycles(); }
  // find the active cycle object based on the selectedCycleId
  const activeCycle = Array.isArray(cycles) ? cycles.find((c) => c.id === selectedCycleId) : undefined;

  /* (Figma Make, 2025) Same as previous lines 10-17 */
  const content = useMemo(() => {
    if (view === "applicants" && selectedApplicantId) {
      return (
        <ApplicantDetail applicantId={selectedApplicantId} onBack={() => { setSelectedApplicantId(null); setListKey((k) => k + 1); }} />
      );
    }

    switch (view) {
      case "overview":
        return <Overview key={overviewKey} onViewApplicants={() => { setListKey((k) => k + 1); setView("applicants"); }} cycleId={selectedCycleId} />;

      case "applicants":
        return (
          <ApplicantsList
            key={listKey}
            cycleId={selectedCycleId}
            onViewApplicant={(id) => {
              setSelectedApplicantId(id);
              setView("applicants");
            }}
          />
        );

      case "reviewers":
        return <ReviewerManagement />;

      case "cycles":
        return <CyclesArchive
          cycles={Array.isArray(cycles) ? cycles : []}
          onCycleChange={reloadCycles}
          onSelectCycle={(id) => { setSelectedCycleId(id); setView("overview"); }}
        />;

      default:
        return <Overview key={overviewKey} onViewApplicants={() => { setListKey((k) => k + 1); setView("applicants"); }} cycleId={selectedCycleId} />;
    }
  }, [view, selectedApplicantId, listKey, overviewKey, selectedCycleId, cycles]);

  /* (Figma Make, 2025) Same as previous lines 10-17 */
  return (
    <div className="bg-shell">
      <div className="admin-shell">
        <div className="admin-layout">
          <Sidebar
            currentView={view}
            onNavigate={(v) => {
              setSelectedApplicantId(null);
              if (v === "applicants") setListKey((k) => k + 1);
              if (v === "overview") setOverviewKey((k) => k + 1);
              setView(v);
            }}
          />

          <main className="admin-main" role="main">
            {/* Cycle switcher bar — hidden on reviewers tab (reviewers are global, not per-cycle) */}
            {view !== "cycles" && view !== "reviewers" && Array.isArray(cycles) && cycles.length > 0 && (
              <div className="ds-cycle-bar">
                <span className="ds-cycle-label">Viewing cycle:</span>
                <select
                  className="ds-cycle-select"
                  value={selectedCycleId}
                  onChange={(e) => {
                    setSelectedCycleId(e.target.value);
                    if (view === "applicants") setListKey((k) => k + 1);
                  }}
                >
                  <option value="">All cycles</option>
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.status === "active" ? " (Active)" : " (Archived)"}
                    </option>
                  ))}
                </select>
                {activeCycle && (
                  <span className={`ds-cycle-pill ${activeCycle.status === "active" ? "active" : "archived"}`}>
                    {activeCycle.status === "active" ? "Active" : "Archived"}
                  </span>
                )}
              </div>
            )}

            <div className="admin-main-inner">{content}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
