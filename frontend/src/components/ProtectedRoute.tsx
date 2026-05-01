// Route protection checks authentication & role-based authorization 
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

/* This component needs:
- to check if the user is authenticated using Supabase auth
- to fetch the user's role 
- to direct users 
*/
interface Props {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

// AuthState can be loading, authenticated, unauthenticated, or unauthorized based on the user's session and role
type AuthState = "loading" | "authenticated" | "unauthenticated" | "unauthorized";


export function ProtectedRoute({ children, allowedRoles, redirectTo = "/applicant/auth" }: Props) {
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    let cancelled = false;
    
    // checks the user's session and role to determine the appropriate auth state for route protection
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      
      // if no session or user, set to unauthenticated and redirect to login  
      if (!session?.user) {
        if (!cancelled) setAuthState("unauthenticated");
        return;
      }

      // if no specific roles are required, consider authenticated
      if (!allowedRoles || allowedRoles.length === 0) {
        if (!cancelled) setAuthState("authenticated");
        return;
      }

      // fetch the user's profile to check their role for authorization
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      // if the user's role is in the allowedRoles, set to authenticated; otherwise, set to unauthorized
      if (!cancelled) {
        if (profile && allowedRoles.includes(profile.role)) {
          setAuthState("authenticated");
        } else {
          setAuthState("unauthorized");
        }
      }
    }

    check();
    return () => { cancelled = true; };
  }, [allowedRoles]);

  if (authState === "loading") {
    return (

      /* FigmaMake 2025 */
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "var(--bg, #f8fafc)",
      }}>
        <div style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>Loading…</div>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <Navigate to={redirectTo} replace />;
  }

  if (authState === "unauthorized") {
    return <Navigate to="/applicant/auth" replace />;
  }

  return <>{children}</>;
}
