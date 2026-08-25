import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { googleSignInAndSetup, getSelectedRole, normalizeRole } from "../lib/firebaseAuth";
import { Loader2, ArrowRight } from "lucide-react";
import { getDashboardRouteForRole } from "../lib/roleHelper";

export default function AuthCallback({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const navigate = useNavigate();
  const [orgInput, setOrgInput] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [industry, setIndustry] = useState("Technology");
  const [country, setCountry] = useState("United States");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const role = getSelectedRole();

  useEffect(() => {
    // Extract token from URL hash or search params if present
    const hash = window.location.hash || window.location.search;
    if (hash.includes("token=")) {
      const match = hash.match(/token=([^&]+)/);
      if (match && match[1]) {
        setOrgInput(match[1]);
      }
    }
  }, []);

  const handleProceed = async () => {
    const cleanOrgInput = orgInput.trim();
    if (!cleanOrgInput && role !== "Super Admin") {
      setError(role === "Organizer" ? "Please enter an organization name" : "Please enter an invite token");
      return;
    }
    setIsProcessing(true);
    setError("");
    
    // Store token before authentication to survive OAuth redirects
    if (cleanOrgInput) {
      sessionStorage.setItem("pending_invite_token", cleanOrgInput);
    }
    
    try {
      const result = await googleSignInAndSetup({
        orgInput: cleanOrgInput,
        companyLogo,
        companyDomain,
        industry,
        country
      } as any);
      if (result) {
        const role = normalizeRole(result.profile.role);
        onLoginSuccess({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.profile.displayName,
          role: role,
          token: result.token,
          organizationId: result.profile.organizationId,
          organizationName: result.profile.organizationName,
          onboardingCompleted: result.profile.onboardingCompleted ?? true
        });
        const targetRoute = getDashboardRouteForRole(role);

        console.log("[AuthFlow] Current User:", result.user.uid, result.user.email);
        console.log("[AuthFlow] Firestore Role:", role);
        console.log("[AuthFlow] Organization ID:", result.profile.organizationId);
        console.log("[AuthFlow] Redirect Destination:", targetRoute);

        navigate(targetRoute);
      } else {
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error("Auth setup error:", err);
      setError(err.message || "Failed to complete setup.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] flex flex-col items-center justify-center p-6 text-slate-900 dark:text-slate-100 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-2xl font-bold text-center">
          {role === "Super Admin" ? "Welcome, Super Admin" : role === "Organizer" ? "Create Your Organization" : "Join Workspace"}
        </h2>
        <p className="text-xs text-slate-500 text-center">
          {role === "Super Admin"
            ? "Permanent Super Admin account resolution."
            : role === "Organizer" 
              ? "Fill out your company details to set up your dedicated multi-tenant workspace." 
              : "Enter or verify the one-time secure invitation token provided by your organizer."}
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs font-semibold border border-red-200">
            {error}
          </div>
        )}

        {role === "Organizer" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Organization Name *</label>
              <input
                type="text"
                required
                value={orgInput}
                onChange={(e) => setOrgInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Acme Corporation"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Company Domain</label>
              <input
                type="text"
                value={companyDomain}
                onChange={(e) => setCompanyDomain(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. acme.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Industry</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Tech"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. USA"
                />
              </div>
            </div>
          </div>
        )}

        {(role === "Manager" || role === "Employee") && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Invite Token *</label>
            <input
              type="text"
              value={orgInput}
              onChange={(e) => setOrgInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="Enter secure invite token"
            />
          </div>
        )}

        <button
          onClick={handleProceed}
          disabled={isProcessing}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer text-sm"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Verifying & Setting Up...</span>
            </>
          ) : (
            <>
              <span>Continue with Google</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
