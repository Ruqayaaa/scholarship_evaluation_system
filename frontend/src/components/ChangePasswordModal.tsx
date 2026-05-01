// (Login) Allows the user to change their password 
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { KeyRound } from "lucide-react";

// function to call when it should be closed (after successful change or when user clicks outside)
interface Props {
  onClose: () => void; 
}

export default function ChangePasswordModal({ onClose }: Props) {
  // new password input
  const [newPassword, setNewPassword] = useState(""); 
  // confirm password input
  const [confirm, setConfirm] = useState(""); 
  // loading state for save operation
  const [saving, setSaving] = useState(false); 
  // feedback message after save attempt
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null); 

  // handling save also displays error messages based on violations 
  // https://medium.com/@AbuBakarHasan/implementing-a-secure-forgot-password-feature-with-typescript-express-mongoose-and-nodemailer-881e6c38c7fb
  async function handleSave() {
    setMsg(null);
    if (newPassword.length < 6) {
      setMsg({ text: "Password must be at least 6 characters.", ok: false });
      return;
    }
    if (newPassword !== confirm) {
      setMsg({ text: "Passwords do not match.", ok: false });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      setMsg({ text: error.message, ok: false });
    } else {
      setMsg({ text: "Password updated successfully!", ok: true });
      setTimeout(onClose, 1500);
    }
  }

  /* (FigmaMake 2025) */
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400,
        boxShadow: "0 20px 60px rgba(15,23,42,0.22)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(37,99,235,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <KeyRound size={18} color="var(--blue)" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--navy)" }}>Change Password</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Update your account password</div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              New Password
            </label>
            <input
              type="password"
              className="auth-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
              autoFocus
              style={{ width: "100%", boxSizing: "border-box", color: "#0f172a" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Confirm Password
            </label>
            <input
              type="password"
              className="auth-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              style={{ width: "100%", boxSizing: "border-box", color: "#0f172a" }}
            />
          </div>

          {msg && (
            <div style={{
              fontSize: 13, fontWeight: 600, padding: "10px 14px", borderRadius: 8,
              background: msg.ok ? "rgba(22,163,74,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${msg.ok ? "rgba(22,163,74,0.25)" : "rgba(239,68,68,0.25)"}`,
              color: msg.ok ? "#16a34a" : "#dc2626",
            }}>
              {msg.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px 16px",
          borderTop: "1px solid var(--border)",
          display: "flex", gap: 8, justifyContent: "flex-end",
        }}>
          <button
            className="ghost-btn"
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ padding: "7px 18px", fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            className="primary-btn"
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: "7px 18px", fontSize: 13 }}
          >
            {saving ? "Saving…" : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
