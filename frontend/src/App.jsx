// app root
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import { ApplicantAuth } from "./pages/ApplicantAuth";
import ApplicantPortalPage from "./pages/ApplicantPortalPage";
import ReviewerPortalPage from "./pages/ReviewerPortalPage";
import AdminPortal from "./pages/AdminPortal";
import PersonalStatementForm from "./components/PersonalStatementForm";
import ResumeForm from "./components/ResumeForm";
import { ProtectedRoute } from "./components/ProtectedRoute";
import "./styles.css";

/* (FigmaMake, 2025) */

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* Auth */}
        <Route path="/applicant/auth" element={<ApplicantAuth />} />
        <Route path="/admin/login" element={<Navigate to="/applicant/auth" replace />} />

        {/* Applicant — must be logged in */}
        <Route
          path="/app"
          element={
            <ProtectedRoute allowedRoles={["applicant"]}>
              <ApplicantPortalPage />
            </ProtectedRoute>
          }
        />

        {/* Reviewer — must be logged in as reviewer (or admin) */}
        <Route
          path="/reviewer"
          element={
            <ProtectedRoute allowedRoles={["reviewer", "admin", "superadmin"]}>
              <ReviewerPortalPage />
            </ProtectedRoute>
          }
        />

        {/* Admin — must be logged in as admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
              <AdminPortal />
            </ProtectedRoute>
          }
        />

        {/* Standalone scoring tools */}
        <Route path="/ps" element={<PersonalStatementForm />} />
        <Route path="/resume" element={<ResumeForm />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
