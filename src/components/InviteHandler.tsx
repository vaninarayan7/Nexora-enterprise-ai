import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getInvitationByToken, getOrganization } from "../lib/firebaseDb";
import { googleSignInAndSetup, normalizeRole } from "../lib/firebaseAuth";
import { Loader2, ArrowRight, AlertTriangle, ArrowLeft } from "lucide-react";

export default function InviteHandler({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const location = useLocation();
  
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<{ message: string; type: "invalid" | "expired" | "general" } | null>(null);
  
  const [inviteDetails, setInviteDetails] = useState<{ role: string; orgName: string } | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      console.group("[InviteHandler DEBUG] Pre-login Token Validation");
      try {
        const hash = window.location.hash || window.location.search;
        let extractedToken = "";
        
        if (hash.includes("?")) {
          const queryPart = hash.split("?")[1];
          const params = new URLSearchParams(queryPart);
          extractedToken = params.get("token") || "";
        } else {
          const match = hash.match(/token=([^&]+)/);
          extractedToken = match ? match[1] : "";
        }

        extractedToken = decodeURIComponent(extractedToken).trim();
        console.log("[InviteHandler DEBUG] Extracted Token:", extractedToken);
        console.log("[InviteHandler DEBUG] Current Route:", window.location.href);

        if (!extractedToken) {
          throw new Error("No invitation token found in the URL.");
        }
        
        setToken(extractedToken);

        console.log("  2. Querying Firestore for token ID:", extractedToken);
        const invite = await getInvitationByToken(extractedToken);
        
        if (!invite) {
          setError({ message: "Invitation not found.", type: "invalid" });
          console.groupEnd();
          return;
        }

        if (invite.status !== "pending") {
          setError({ message: "This invitation link has already been used. Please contact your Organizer for a new invitation.", type: "invalid" });
          console.groupEnd();
          return;
        }

        let expiresAtMs = 0;
        if (invite.expiresAt) {
          if (typeof (invite.expiresAt as any).toDate === "function") {
            expiresAtMs = (invite.expiresAt as any).toDate().getTime();
          } else if (typeof (invite.expiresAt as any).toMillis === "function") {
            expiresAtMs = (invite.expiresAt as any).toMillis();
          } else {
            expiresAtMs = new Date(invite.expiresAt).getTime();
          }
        }

        if (expiresAtMs > 0 && expiresAtMs < Date.now()) {
          setError({ message: "Invitation expired", type: "expired" });
          console.groupEnd();
          return;
        }

        // >>> TRACE LOGS REQUESTED BY USER <<<
        console.log("================ INVITATION TRACE (UI) ===============");
        console.log("-> Exact Query Used : getDoc(doc(db, 'invitations', '" + extractedToken + "'))");
        console.log("-> Token from URL   :", extractedToken);
        console.log("-> Token from DB    :", invite.token);
        console.log("-> Expires At (Raw) :", invite.expiresAt);
        console.log("-> Expires At (Ms)  :", expiresAtMs, new Date(expiresAtMs).toISOString());
        console.log("-> Current Time     :", Date.now(), new Date().toISOString());
        console.log("-> Validation Result:", (expiresAtMs === 0 || expiresAtMs > Date.now()) ? "VALID" : "EXPIRED");
        console.log("======================================================");

        const org = await getOrganization(invite.organizationId);
        
        setInviteDetails({
          role: invite.role,
          orgName: org ? org.organizationName : "Unknown Organization"
        });
        
        console.log("[InviteHandler DEBUG] Token is valid! Ready for Google Sign In.");
        console.log("[InviteHandler DEBUG] Selected role for invite:", invite.role);
        console.log("[InviteHandler DEBUG] Organization:", org ? org.organizationName : "Unknown");
      } catch (err: any) {
        console.error("  ❌ Validation error:", err);
        setError({ message: err.message || "An unknown error occurred.", type: "general" });
      } finally {
        setLoading(false);
        console.groupEnd();
      }
    };

    validateToken();
  }, []);

  const handleAccept = async () => {
    setIsProcessing(true);
    
    // Set sessionStorage just in case OAuth redirect triggers instead of popup
    sessionStorage.setItem("pending_invite_token", token);
    
    console.log("[InviteHandler DEBUG] Starting Google Sign-in flow for token:", token);
    try {
      const result = await googleSignInAndSetup({ orgInput: token } as any);
      if (result) {
        const role = normalizeRole(result.profile.role);
        console.log("[InviteHandler DEBUG] Auth state successfully established. Session active for uid:", result.user.uid);
        console.log("[InviteHandler DEBUG] Role saved:", role);
        console.log("[InviteHandler DEBUG] Organization membership verified:", result.profile.organizationId);
        
        // Pass to App.tsx to update global state.
        // DO NOT forcefully navigate here. Let App.tsx initAuth handle the redirect safely.
        onLoginSuccess({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.profile.displayName,
          role: role,
          token: result.token,
          organizationId: result.profile.organizationId,
          organizationName: result.profile.organizationName,
          status: "ACTIVE",
          onboardingCompleted: true
        });
        console.log("[InviteHandler DEBUG] Global state update dispatched. Waiting for App.tsx redirect.");
      }
    } catch (err: any) {
      console.error("[InviteHandler DEBUG] Auth setup error:", err);
      setError({ message: err.message || "Failed to complete setup.", type: "general" });
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex flex-col items-center justify-center p-6 text-slate-900 dark:text-slate-100">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-medium">Validating invitation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex flex-col items-center justify-center p-6 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-6">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">{error.type === "expired" ? "Invitation Expired" : error.type === "invalid" ? "Invitation Not Found" : "Error"}</h2>
          <p className="text-sm text-slate-500">{error.message}</p>
          
          {error.type === "expired" ? (
            <button
              onClick={() => window.location.href = "mailto:?subject=Please resend invitation"}
              className="w-full py-3 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            >
              Contact Organizer to Resend
            </button>
          ) : (
            <button
              onClick={() => window.location.href = "/"}
              className="w-full py-3 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to Homepage
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex flex-col items-center justify-center p-6 text-slate-900 dark:text-slate-100 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">You've Been Invited!</h2>
          <p className="text-sm text-slate-500">
            Join <strong>{inviteDetails?.orgName}</strong> as a <strong>{inviteDetails?.role}</strong>.
          </p>
        </div>

        <button
          onClick={handleAccept}
          disabled={isProcessing}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer text-sm shadow-lg shadow-indigo-500/30"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Joining Workspace...</span>
            </>
          ) : (
            <>
              <span>Continue with Google to Accept</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
