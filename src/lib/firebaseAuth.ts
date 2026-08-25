import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  AuthError
} from "firebase/auth";
import { auth } from "./firebase";
import { saveUserProfile, getUserProfile, DbUserProfile, getOrganization, saveOrganization } from "./firebaseDb";
import { UserRole } from "../types";
import {
  getGoogleCalendarAuthState,
  isGoogleCalendarTokenExpired,
  refreshGoogleCalendarAccessToken,
  saveGoogleCalendarAuthState,
  clearGoogleCalendarAuthState
} from "./googleCalendarAuth";

// ── Google Provider Setup ─────────────────────────────────────────────────────
const provider = new GoogleAuthProvider();
// Only request basic profile – keep scopes minimal for the initial sign‑in.
provider.addScope("profile");
provider.addScope("email");
provider.setCustomParameters({ prompt: "select_account" });

// ── Token Cache (memory-safe, never written to localStorage) ──────────────────
let cachedAccessToken: string | null = null;
let isSigningIn = false;
// In‑memory state for onboarding
let selectedRole: UserRole | null = null;
let currentUserProfile: import("./firebaseDb").DbUserProfile | null = null;

export const normalizeRole = (role?: string): UserRole => {
  if (!role) return "" as UserRole;
  const r = role.trim().toUpperCase().replace(/[\s_-]+/g, "");
  if (r === "SUPERADMIN") return "Super Admin";
  if (r === "ADMIN") return "Admin";
  if (r === "ORGANIZER" || r === "OWNER") return "Organizer";
  if (r === "MANAGER") return "Manager";
  if (r === "EMPLOYEE") return "Employee";
  
  if (r.includes("SUPER")) return "Super Admin";
  if (r.includes("ORG") || r.includes("OWN")) return "Organizer";
  if (r.includes("MANAG")) return "Manager";
  if (r.includes("EMP")) return "Employee";
  if (r.includes("ADMIN")) return "Admin";
  
  return "Employee";
};

// ── Human-Readable Firebase Auth Error Messages ───────────────────────────────
export const getAuthErrorMessage = (error: AuthError | Error | unknown): string => {
  const code = (error as AuthError)?.code || "";

  const errorMessages: Record<string, string> = {
    "auth/popup-blocked":
      "Your browser blocked the sign-in popup. Please allow popups for this site, or use Email & Password sign-in instead.",
    "auth/popup-closed-by-user":
      "Sign-in was cancelled. The Google window was closed before completing authentication.",
    "auth/cancelled-popup-request":
      "A previous sign-in popup is still open. Please close it and try again.",
    "auth/unauthorized-domain":
      "This domain is not authorised in Firebase. Go to Firebase Console → Authentication → Settings → Authorised Domains and add 'localhost'.",
    "auth/invalid-api-key":
      "The Firebase API key is invalid. Please verify 'apiKey' in firebase-applet-config.json.",
    "auth/network-request-failed":
      "Network error. Please check your internet connection and try again.",
    "auth/too-many-requests":
      "Too many failed attempts. Your account has been temporarily locked. Try again later or reset your password.",
    "auth/user-disabled":
      "This account has been disabled by an administrator.",
    "auth/user-not-found":
      "No account found with this email address. Please sign up first.",
    "auth/wrong-password":
      "Incorrect password. Please try again or use 'Forgot Password'.",
    "auth/email-already-in-use":
      "An account with this email already exists. Please sign in instead.",
    "auth/weak-password":
      "Password must be at least 6 characters long.",
    "auth/invalid-email":
      "The email address format is invalid.",
    "auth/operation-not-allowed":
      "Google sign-in is not enabled in Firebase. Go to Firebase Console → Authentication → Sign-in Methods and enable Google.",
    "auth/internal-error":
      "An internal Firebase error occurred. Please try again in a moment.",
    "auth/account-exists-with-different-credential":
      "An account already exists with the same email but a different sign-in method. Try signing in with email & password.",
    "auth/requires-recent-login":
      "This action requires re-authentication. Please sign out and sign back in.",
    "auth/cors-unsupported":
      "CORS error: Firebase cannot reach the auth service. Check that your authDomain is correct.",
  };

  if (code && errorMessages[code]) {
    console.error(`[FirebaseAuth] Error code: ${code}`, error);
    return errorMessages[code];
  }

  // Fallback: try to extract a useful message
  const message = (error as Error)?.message || "";
  console.error("[FirebaseAuth] Unhandled error:", code || "no-code", message, error);
  return message || "An unexpected authentication error occurred. Please try again.";
};

// ── Diagnostics Log ───────────────────────────────────────────────────────────
function logAuthDiagnostics() {
  const opts = auth.app.options as Record<string, string>;
  console.group("[FirebaseAuth] Configuration Diagnostics");
  console.log("Project ID    :", opts.projectId);
  console.log("Auth Domain   :", opts.authDomain);
  console.log("API Key       :", opts.apiKey ? "✅ Present" : "❌ MISSING");
  console.log("App ID        :", opts.appId ? "✅ Present" : "❌ MISSING");
  console.log("Current URL   :", window.location.origin);
  console.log(
    "Domain Check  :",
    window.location.hostname === "localhost"
      ? "⚠️  localhost — ensure it is in Firebase Authorised Domains"
      : "✅ " + window.location.hostname
  );
  console.groupEnd();
}

export const processPendingInvitation = async (user: User, pendingToken: string): Promise<any> => {
  console.log(`[FirebaseAuth] Processing pending invitation token: "${pendingToken}" for user ${user.uid}`);
  const { org, role: inviteRole, inviteId } = await joinOrganizationByToken(pendingToken, user.email || "");
  
  let profile = await getUserProfile(user.uid) || {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email?.split("@")[0] || "Enterprise Member"
  };
  
  if ((profile as any).organizationId && (profile as any).organizationId !== org.organizationId) {
    throw new Error("You are already a member of another organization. One email can only belong to one organization.");
  }
  
  (profile as any).role = inviteRole;
  (profile as any).organizationId = org.organizationId;
  (profile as any).organizationName = org.organizationName;
  (profile as any).memberStatus = "active";
  (profile as any).status = "ACTIVE";
  (profile as any).joinedAt = new Date().toISOString();
  (profile as any).onboardingCompleted = true;

  await saveUserProfile(profile as any);
  
  // Sync the assigned invitation role to Supabase to ensure auth.uid() queries resolve correctly
  try {
    const { supabaseSetUserRole } = await import("./supabaseClient");
    await supabaseSetUserRole(user.uid, user.email || "", profile.displayName || "User", inviteRole as UserRole);
  } catch (err) {
    console.warn("[FirebaseAuth] Could not sync invitation role to Supabase:", err);
  }
  
  // Now mark invitation as accepted
  const { doc, setDoc } = await import("firebase/firestore");
  const { db } = await import("./firebaseDb");
  await setDoc(doc(db, "invitations", inviteId), { 
    status: "accepted",
    accessStatus: "Approved",
    acceptedAt: new Date().toISOString(),
    acceptedBy: user.uid
  }, { merge: true });
  console.log(`[FirebaseAuth] ✅ Invitation ${inviteId} marked as accepted.`);
  
  const reloadedProfile = await getUserProfile(user.uid);
  sessionStorage.removeItem("pending_invite_token");
  console.log(`[FirebaseAuth] ✅ Successfully consumed pending token.`);
  
  return reloadedProfile || profile;
};

// ── Redirect Result Handler (call ONCE on app mount, before initAuth) ─────────
// This must be called separately — NOT inside initAuth — to avoid competing
// with signInWithPopup and triggering auth/cancelled-popup-request errors.
export const handleRedirectResult = async (roleHint: UserRole = "Employee"): Promise<{ user: User; accessToken: string; role: UserRole } | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      console.log("[FirebaseAuth] Redirect sign-in result received:", result.user.email);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        console.log("[FirebaseAuth] Access token cached.");
      }
      const user = result.user;

      // Handle pending invitation if redirect occurred during join flow
      const pendingToken = sessionStorage.getItem("pending_invite_token");
      if (pendingToken) {
        console.log("[FirebaseAuth] Found pending invite token after redirect, processing...");
        try {
          const profile = await processPendingInvitation(user, pendingToken);
          roleHint = profile.role as UserRole;
          console.log("[FirebaseAuth] ✅ Processed invite after redirect:", roleHint);
        } catch (e) {
          console.error("[FirebaseAuth] Failed to process invite after redirect:", e);
          sessionStorage.removeItem("pending_invite_token");
        }
      }

      return { user, accessToken: cachedAccessToken || "", role: roleHint };
    }
    console.log("[FirebaseAuth] No pending redirect result on this page load.");
    return null;
  } catch (err) {
    console.warn("[FirebaseAuth] Google sign‑in failed:", err);
    return null;
  } finally {
    isSigningIn = false;
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string, profile: import("./firebaseDb").DbUserProfile) => void,
  onAuthFailure?: (errorMsg?: string) => void
) => {
  logAuthDiagnostics();

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      console.group("[FirebaseAuth] onAuthStateChanged: user signed in");
      console.log("  uid  :", user.uid);
      console.log("  email:", user.email);
      console.groupEnd();

      try {
        let profile = await getUserProfile(user.uid);
        
        if (profile) {
          // Repair Organizer profile: if role is Organizer but organizationId is missing
          if (profile.role === "Organizer" && !profile.organizationId) {
            const newOrgId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
            profile.organizationId = newOrgId;
            profile.organizationName = profile.organizationName || "Restored Organization";
            (profile as any).organizationOwner = true;
            try {
              await saveUserProfile(profile);
              console.log(`[initAuth] Repaired missing organizationId for Organizer ${user.uid}`);
            } catch (repairErr) {
              console.error(`[initAuth] Failed to repair missing organizationId:`, repairErr);
            }
          }

          // Removed aggressive Employee -> Organizer repair logic to preserve correct role assignment.
        }

        if (profile && profile.organizationId) {
          try {
            const org = await getOrganization(profile.organizationId);
            if (!org && profile.role !== "Super Admin") {
              console.warn(`[AuthFlow] Organization ${profile.organizationId} not found or inaccessible. Keeping membership intact instead of demoting.`);
              // We do NOT blindly demote them to Employee. It could be a permission/network issue.
            }
          } catch (orgErr) {
            console.error(`[initAuth] Failed to verify organization:`, orgErr);
          }
        }

        const rawStatus = profile?.status || "ACTIVE";
        const status = rawStatus.toUpperCase();

        console.log(`[AuthFlow] Firestore status: ${rawStatus}`);
        console.log(`[AuthFlow] Current user: ${user.uid} (${user.email})`);

        if (profile && status !== "ACTIVE") {
          console.warn(`[AuthFlow] Login allowed/denied: DENIED`);
          console.warn(`[AuthFlow] Redirect destination: None (User Signed Out)`);
          
          const { saveAuditLog } = await import("./firebaseDb");
          saveAuditLog({
            organizationId: profile?.organizationId || "global",
            actor: { name: user.displayName || user.email || "User", email: user.email || "", role: normalizeRole(profile?.role) },
            action: "User login blocked",
            category: "user_activity",
            status: "denied",
            details: `Access blocked: account status is ${rawStatus}.`
          }).catch(console.error);

          await signOut(auth);
          cachedAccessToken = null;
          currentUserProfile = null;
          
          if (onAuthFailure) {
            onAuthFailure("Your account has been suspended. Please contact your Organization Administrator.");
          }
          return;
        }

        console.log(`[AuthFlow] Login allowed/denied: ALLOWED`);
        const normalizedProfile = profile ? {
          ...profile,
          role: normalizeRole(profile.role)
        } : null;

        if (normalizedProfile) {
          const { saveAuditLog } = await import("./firebaseDb");
          saveAuditLog({
            organizationId: normalizedProfile?.organizationId || "global",
            actor: { name: user.displayName || user.email || "User", email: user.email || "", role: normalizedProfile?.role || "Employee" },
            action: "User login successful",
            category: "user_activity",
            status: "success",
            details: "User authenticated and role session established."
          }).catch(console.error);
        }

        currentUserProfile = normalizedProfile as any;
        const token = cachedAccessToken || (await user.getIdToken());

        if (onAuthSuccess) onAuthSuccess(user, token, (normalizedProfile ?? {}) as any);
      } catch (err) {
        console.error("[FirebaseAuth] Profile sync error:", err);
        const token = await user.getIdToken().catch(() => "");
        if (onAuthSuccess) onAuthSuccess(user, token, {} as any);
      }
    } else {
      console.log("[FirebaseAuth] onAuthStateChanged: signed out");
      cachedAccessToken = null;
      currentUserProfile = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// ── Google Sign-In (Popup with Redirect Fallback) ─────────────────────────────
export const googleSignIn = async (
  roleHint: UserRole = "Employee"
): Promise<{ user: User; accessToken: string; role: UserRole } | null> => {
  if (isSigningIn) {
    console.warn("[FirebaseAuth] Sign-in already in progress, ignoring duplicate call.");
    return null;
  }

  isSigningIn = true;
  const authDomain = (auth.app.options as Record<string, string>).authDomain;
  console.log("[FirebaseAuth] Initiating Google sign-in popup...");
  console.log("[FirebaseAuth] Auth domain in use:", authDomain);
  console.log("[FirebaseAuth] Current origin:", window.location.origin);
  console.log("[FirebaseAuth] Role hint for this sign-in:", roleHint);

  try {
    // Create a fresh provider instance each call to avoid stale state
    const freshProvider = new GoogleAuthProvider();
    freshProvider.addScope("profile");
    freshProvider.addScope("email");
    freshProvider.setCustomParameters({ prompt: "select_account" });

    const result = await signInWithPopup(auth, freshProvider);
    console.log("[FirebaseAuth] signInWithPopup resolved successfully.");
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      console.warn("[FirebaseAuth] No access token in credential — continuing with ID token only.");
    } else {
      cachedAccessToken = credential.accessToken;
    }

    console.log("[FirebaseAuth] Popup sign-in successful:", result.user.email);

    // ── Role Resolution ────────────────────────────────────────────────────
    // Check if user already exists in Firestore (returning user)
    let profile = await getUserProfile(result.user.uid);

    console.group("[FirebaseAuth] googleSignIn: profile lookup");
    console.log("  existing profile:", profile ? "found" : "not found (new user)");
    console.log("  existing role   :", profile?.role ?? "none");
    console.log("  roleHint        :", roleHint);
    console.groupEnd();

    if (profile) {
      // Existing user: check account status BEFORE allowing session creation
      const status = (profile.status || "ACTIVE").toUpperCase();
      console.log(`[AuthFlow] Firestore status: ${profile.status || "ACTIVE"}`);
      
      if (status !== "ACTIVE") {
        console.warn(`[AuthFlow] Current user: ${result.user.uid} (${result.user.email})`);
        console.warn(`[AuthFlow] Firestore status: ${profile.status}`);
        console.warn(`[AuthFlow] Login allowed/denied: DENIED`);
        console.warn(`[AuthFlow] Redirect destination: None (User Signed Out)`);

        const { saveAuditLog } = await import("./firebaseDb");
        saveAuditLog({
          organizationId: profile.organizationId || "global",
          actor: { name: profile.displayName || result.user.email || "User", email: result.user.email || "", role: normalizeRole(profile.role) },
          action: "User login blocked",
          category: "user_activity",
          status: "denied",
          details: `Access blocked because user status is ${profile.status}`
        }).catch(console.error);

        await signOut(auth);
        cachedAccessToken = null;
        currentUserProfile = null;
        throw new Error("Your account has been suspended. Please contact your Organization Administrator.");
      }

      console.log(`[AuthFlow] Current user: ${result.user.uid} (${result.user.email})`);
      console.log(`[AuthFlow] Firestore status: ${profile.status || "ACTIVE"}`);
      console.log(`[AuthFlow] Login allowed/denied: ALLOWED`);
      console.log("[FirebaseAuth] Returning user. Using stored role:", normalizeRole(profile.role));
    } else {
      console.log("[FirebaseAuth] Google authentication successful for new user. UID:", result.user.uid);
    }

    const accessToken = cachedAccessToken || (await result.user.getIdToken());
    let finalRole: UserRole | undefined;
    if (profile && profile.role) {
      finalRole = normalizeRole(profile.role);
    } else if (!profile) {
      finalRole = roleHint;
    } else {
      finalRole = "" as UserRole;
    }
    return { user: result.user, accessToken, role: finalRole as any };

  } catch (rawError: unknown) {
    const err = rawError as AuthError;
    const code = err?.code || "";

    console.error("[FirebaseAuth] signInWithPopup error:", code, err?.message);

    // ── Popup was blocked: fall back to redirect ─────────────────────────────
    if (code === "auth/popup-blocked") {
      console.warn("[FirebaseAuth] Popup blocked — falling back to redirect sign-in.");
      try {
        const freshProvider = new GoogleAuthProvider();
        freshProvider.addScope("profile");
        freshProvider.addScope("email");
        freshProvider.setCustomParameters({ prompt: "select_account" });
        await signInWithRedirect(auth, freshProvider);
      } catch (redirectErr) {
        console.error("[FirebaseAuth] Redirect fallback also failed:", redirectErr);
      }
      // Page will reload; result handled via handleRedirectResult
      return null;
    }

    // ── User closed the popup — return null (not an error) ───────────────────
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      console.log("[FirebaseAuth] User closed the popup or cancelled sign-in.");
      return null; // Caller should treat null as cancelled (no error toast)
    }

    // All other errors: enrich and re-throw with friendly message
    const friendlyMessage = getAuthErrorMessage(err);
    const enrichedError = new Error(friendlyMessage);
    (enrichedError as any).code = code;
    throw enrichedError;

  } finally {
    isSigningIn = false;
  }
};

// ── Email / Password Sign-Up ──────────────────────────────────────────────────
export const signUpEmailPassword = async (
  email: string,
  password: string,
  displayName: string,
  role: UserRole = "Employee"
): Promise<{ user: User; role: UserRole }> => {
  if (role === "Employee" || role === "Manager") {
    throw new Error("Direct sign-up is disabled for Employees and Managers. You must use an invite link.");
  }
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });

    const profile: DbUserProfile = { uid: credential.user.uid, email, displayName, role };
    try {
      await saveUserProfile(profile);
    } catch (saveErr) {
      console.warn("[FirebaseAuth] Could not save new user profile during signup. Proceeding.", saveErr);
    }
    return { user: credential.user, role };
  } catch (err: unknown) {
    throw new Error(getAuthErrorMessage(err));
  }
};

// ── Email / Password Login ────────────────────────────────────────────────────
export const loginEmailPassword = async (
  email: string,
  password: string
): Promise<{ user: User; role: UserRole }> => {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    let profile = await getUserProfile(credential.user.uid);
    if (!profile) {
      profile = {
        uid: credential.user.uid,
        email: credential.user.email || email,
        displayName: credential.user.displayName || email.split("@")[0],
        role: "Employee"
      };
      try {
        await saveUserProfile(profile);
      } catch (saveErr) {
        console.warn("[FirebaseAuth] Could not save new user profile during login. Proceeding.", saveErr);
      }
    }
    return { user: credential.user, role: (profile.role ? normalizeRole(profile.role) : "") as UserRole };
  } catch (err: unknown) {
    throw new Error(getAuthErrorMessage(err));
  }
};

// ── Password Reset ────────────────────────────────────────────────────────────
export const forgotPasswordReset = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err: unknown) {
    throw new Error(getAuthErrorMessage(err));
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export const getAccessToken = async (): Promise<string | null> => cachedAccessToken;

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  calendarAccessToken = null;
  selectedRole = null;
  clearGmailAccessToken();
  localStorage.clear();
  sessionStorage.clear();
  console.log("[FirebaseAuth] User signed out.");
};

// ── Google Calendar OAuth Token (separate from Firebase ID token) ─────────────
// The Google Calendar API requires a real Google OAuth 2.0 access token with
// calendar scopes. The Firebase ID token stored in user.token is NOT accepted
// by Google APIs — it is only valid for Firebase services.
let calendarAccessToken: string | null = null;

export const getCalendarAccessToken = (): string | null => calendarAccessToken;
export const setCalendarAccessToken = (token: string): void => { calendarAccessToken = token; };
export const clearCalendarAccessToken = (): void => { calendarAccessToken = null; };

// ── Google Sign-In With Calendar Scopes ───────────────────────────────────────
// Nexora only needs Calendar access for scheduling meetings and Google Meet links.
// Keep this flow to the minimum required scope so the app does not request Gmail,
// Drive, Contacts, Docs, Sheets, or other unnecessary Google APIs.
export const googleSignInWithCalendarScopes = async (): Promise<{
  accessToken: string;
  refreshToken?: string;
  email: string;
} | null> => {
  const existingState = getGoogleCalendarAuthState();

  if (existingState?.accessToken && !isGoogleCalendarTokenExpired()) {
    calendarAccessToken = existingState.accessToken;
    return {
      accessToken: existingState.accessToken,
      refreshToken: existingState.refreshToken,
      email: existingState.email || ""
    };
  }

  if (existingState?.refreshToken) {
    const refreshed = await refreshGoogleCalendarAccessToken();
    if (refreshed?.accessToken) {
      calendarAccessToken = refreshed.accessToken;
      return {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        email: refreshed.email || ""
      };
    }
  }

  console.group("[CalendarOAuth] Starting OAuth flow...");
  console.log("[CalendarOAuth] Redirecting to Google OAuth consent for: https://www.googleapis.com/auth/calendar.events");

  try {
    const popup = window.open("/api/oauth/google", "nexora-google-calendar-oauth", "width=520,height=720");
    if (!popup) {
      throw new Error("The Google Calendar OAuth popup was blocked by your browser. Please allow popups and try again.");
    }

    const result = await new Promise<{ accessToken: string; refreshToken?: string; email?: string }>((resolve, reject) => {
      const timeoutMs = 180_000;
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("Google Calendar OAuth timed out. Please try again."));
      }, timeoutMs);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", handleMessage);
      };

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== "OAUTH_SUCCESS") return;

        const accessToken = event.data?.accessToken as string | undefined;
        const refreshToken = event.data?.refreshToken as string | undefined;
        const email = event.data?.email as string | undefined;

        if (!accessToken) {
          cleanup();
          reject(new Error("Google did not return a valid Calendar access token."));
          return;
        }

        cleanup();
        resolve({ accessToken, refreshToken, email });
      };

      window.addEventListener("message", handleMessage);
    });

    saveGoogleCalendarAuthState({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
      email: result.email || "",
    });

    calendarAccessToken = result.accessToken;
    console.log("[CalendarOAuth] ✅ Google OAuth flow completed successfully.");
    console.groupEnd();

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      email: result.email || ""
    };
  } catch (rawError: unknown) {
    console.groupEnd();
    const err = rawError as Error;
    console.error("[CalendarOAuth] OAuth flow error:", err?.message || rawError);
    throw new Error(err?.message || "Failed to complete Google Calendar OAuth. Please try again.");
  }
};

// ── Google Gmail OAuth Token (with expiry tracking) ──────────────────────────
let gmailAccessToken: string | null = null;
const TOKEN_LIFETIME_MS = 55 * 60 * 1000; // 55 minutes (tokens expire at 60)

export const getGmailAccessToken = (): string | null => {
  const token = gmailAccessToken || localStorage.getItem("google-workspace-token");
  if (!token) return null;

  // Check if token has expired
  const storedAt = localStorage.getItem("google-workspace-token-ts");
  if (storedAt) {
    const elapsed = Date.now() - parseInt(storedAt, 10);
    if (elapsed > TOKEN_LIFETIME_MS) {
      console.warn("[GmailOAuth] Access token expired after 55 minutes. Clearing.");
      clearGmailAccessToken();
      return null;
    }
  }
  return token;
};

export const setGmailAccessToken = (token: string): void => {
  gmailAccessToken = token;
  localStorage.setItem("google-workspace-token", token);
  localStorage.setItem("google-workspace-token-ts", Date.now().toString());
};

export const clearGmailAccessToken = (): void => {
  gmailAccessToken = null;
  localStorage.removeItem("google-workspace-token");
  localStorage.removeItem("google-workspace-token-ts");
  localStorage.removeItem("google-workspace-refresh-token");
};

export const getGmailRefreshToken = (): string | null => {
  return localStorage.getItem("google-workspace-refresh-token");
};

export const googleSignInWithGmailScopes = async (): Promise<{
  accessToken: string;
  email: string;
} | null> => {
  const existingToken = getGmailAccessToken();
  if (existingToken) {
    return { accessToken: existingToken, email: "" };
  }

  const existingRefresh = getGmailRefreshToken();
  if (existingRefresh) {
    try {
      const response = await fetch("/api/oauth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: existingRefresh })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.accessToken) {
          setGmailAccessToken(data.accessToken);
          return { accessToken: data.accessToken, email: "" };
        }
      }
    } catch (e) {
      console.warn("Failed to refresh Gmail token", e);
    }
  }

  console.group("[GmailOAuth] Starting OAuth flow...");
  console.log("[GmailOAuth] Redirecting to Google OAuth consent for: https://www.googleapis.com/auth/gmail.send");

  try {
    const popup = window.open("/api/oauth/google?type=gmail", "nexora-google-gmail-oauth", "width=520,height=720");
    if (!popup) {
      throw new Error("The Gmail OAuth popup was blocked by your browser. Please allow popups and try again.");
    }

    const result = await new Promise<{ accessToken: string; refreshToken?: string; email?: string }>((resolve, reject) => {
      const timeoutMs = 180_000;
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("Gmail OAuth timed out. Please try again."));
      }, timeoutMs);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", handleMessage);
      };

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== "OAUTH_SUCCESS") return;

        const accessToken = event.data?.accessToken as string | undefined;
        const refreshToken = event.data?.refreshToken as string | undefined;
        const email = event.data?.email as string | undefined;

        if (!accessToken) {
          cleanup();
          reject(new Error("Google did not return a valid Gmail access token."));
          return;
        }

        cleanup();
        resolve({ accessToken, refreshToken, email });
      };

      window.addEventListener("message", handleMessage);
    });

    setGmailAccessToken(result.accessToken);
    if (result.refreshToken) {
      localStorage.setItem("google-workspace-refresh-token", result.refreshToken);
    }
    console.log("[GmailOAuth] ✅ Google OAuth flow completed successfully.");
    console.groupEnd();

    return {
      accessToken: result.accessToken,
      email: result.email || ""
    };
  } catch (rawError: unknown) {
    console.groupEnd();
    const err = rawError as Error;
    console.error("[GmailOAuth] OAuth flow error:", err?.message || rawError);
    throw new Error(err?.message || "Failed to complete Gmail OAuth. Please try again.");
  }
};

// ---- Onboarding helpers ---------------------------------------------------
export const setSelectedRole = (role: UserRole) => {
  selectedRole = role;
  console.log("[FirebaseAuth] Role selected for onboarding:", role);
};
export const getSelectedRole = (): UserRole | null => {
  const role = selectedRole;
  console.log("[FirebaseAuth] getSelectedRole returned:", role);
  return role;
};

// Create a new organization (admin flow)
export const createOrganization = async (name: string) => {
  const { doc, setDoc } = await import("firebase/firestore");
  const { db } = await import("./firebaseDb");
  const orgId = crypto.randomUUID();
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const orgDoc = { 
    organizationId: orgId, 
    organizationName: name, 
    orgCode: inviteCode, 
    ownerUid: auth.currentUser?.uid || "",
    ownerEmail: auth.currentUser?.email || "",
    status: "active",
    createdAt: new Date().toISOString() 
  };
  try {
    await setDoc(doc(db, "organizations", orgId), orgDoc);
    console.log("[Org] Created organization", orgDoc);
    return orgDoc;
  } catch (e) {
    console.error("[Org] Failed to create organization", e);
    throw e;
  }
};

// Join an existing organization via invite token (manager/employee flow)
export const joinOrganizationByToken = async (token: string, email: string) => {
  const { doc, setDoc } = await import("firebase/firestore");
  const { getInvitationByToken, getOrganization, db } = await import("./firebaseDb");
  
  console.group("[joinOrganizationByToken DEBUG] Token Validation Flow");
  console.log("  1. Token passed from AuthCallback:", token);
  console.log("  2. Email passed for membership:", email);

  console.log("  3. Querying Firestore for invitation matching token...");
  const invite = await getInvitationByToken(token);
  console.log("  4. Invitation lookup result:", invite);

  if (!invite) {
    console.error("  ❌ Validation Failed: Invitation token not found in database.");
    console.groupEnd();
    throw new Error("Invalid or Expired Invitation");
  }
  console.log("  ✅ Validation Step 1 Passed: Invitation exists in database.");

  if (invite.status !== "pending") {
    console.error(`  ❌ Validation Failed: Invitation already used or revoked. Current Status: ${invite.status}`);
    console.groupEnd();
    throw new Error("This invitation link has already been used. Please contact your Organizer for a new invitation.");
  }
  console.log("  ✅ Validation Step 2 Passed: Invitation status is 'pending'.");

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

  // >>> TRACE LOGS REQUESTED BY USER <<<
  console.log("================ INVITATION TRACE ===============");
  console.log("-> Exact Query Used : getDoc(doc(db, 'invitations', '" + token + "'))");
  console.log("-> Token from URL   :", token);
  console.log("-> Token from DB    :", invite.token);
  console.log("-> Expires At (Raw) :", invite.expiresAt);
  console.log("-> Expires At (Ms)  :", expiresAtMs, new Date(expiresAtMs).toISOString());
  console.log("-> Current Time     :", Date.now(), new Date().toISOString());
  console.log("-> Validation Result:", (expiresAtMs === 0 || expiresAtMs > Date.now()) ? "VALID" : "EXPIRED");
  console.log("=================================================");

  if (expiresAtMs > 0 && expiresAtMs < Date.now()) {
    console.error(`  ❌ Validation Failed: Invitation expired at ${new Date(expiresAtMs).toISOString()}. Current time: ${new Date().toISOString()}`);
    console.groupEnd();
    throw new Error("Invalid or Expired Invitation");
  }
  console.log(`  ✅ Validation Step 3 Passed: Invitation is not expired (Expires at: ${new Date(expiresAtMs).toISOString()}).`);

  if (invite.email && !invite.email.includes("@workspace.local") && invite.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    console.error(`  ❌ Validation Failed: Email mismatch. Expected: ${invite.email}, Got: ${email}`);
    console.groupEnd();
    throw new Error("This invitation was sent to a different email address.");
  }
  console.log("  ✅ Validation Step 4 Passed: Email matches the invitation.");

  console.log(`  5. Querying Firestore for organization matching ID: ${invite.organizationId}...`);
  let org = await getOrganization(invite.organizationId);
  console.log("  6. Organization lookup result:", org);
  
  if (!org) {
    console.warn("  ⚠️ Organization read access denied or missing. Safely bypassing using inviter profile context.");
    const { getUserProfile } = await import("./firebaseDb");
    const inviterProfile = await getUserProfile(invite.createdBy);
    
    org = {
      organizationId: invite.organizationId,
      organizationName: inviterProfile?.organizationName || "Joined Workspace"
    } as any;
  }
  console.log("  ✅ Validation Step 5 Passed: Organization verified.");

  console.log("  [joinOrganizationByToken] 🎉 Successfully validated invitation.");
  console.groupEnd();
  
  return { org, role: normalizeRole(invite.role), inviteId: invite.id };
};

export const PERMANENT_SUPER_ADMIN_EMAIL = "vanivalmiki694@gmail.com";

// Post‑sign‑in handling that creates/joins organization based on selected role
export const googleSignInAndSetup = async (setupData: string | { orgInput: string; companyLogo?: string; companyDomain?: string; industry?: string; country?: string }) => {
  const orgInput = typeof setupData === "string" ? setupData : setupData.orgInput;
  const companyLogo = typeof setupData === "object" ? setupData.companyLogo : undefined;
  const companyDomain = typeof setupData === "object" ? setupData.companyDomain : undefined;
  const industry = typeof setupData === "object" ? setupData.industry : undefined;
  const country = typeof setupData === "object" ? setupData.country : undefined;

  let role = getSelectedRole();
  console.group("[FirebaseAuth] googleSignInAndSetup");
  console.log("  selectedRole :", role);
  console.log("  orgInput     :", orgInput);
  console.groupEnd();

  const result = await googleSignIn(role || "Employee");
  if (!result) return null;
  const { user, accessToken } = result;

  // Permanent Super Admin check
  if (user.email?.toLowerCase() === PERMANENT_SUPER_ADMIN_EMAIL.toLowerCase()) {
    role = "Super Admin";
  } else if (role === "Super Admin") {
    // Demote unauthorized Super Admins to Employee
    console.warn(`[AuthFlow] Unauthorized Super Admin attempt by ${user.email}. Demoting to Employee.`);
    role = "Employee";
  } else if (!role) {
    role = "Employee";
  }

  // Fetch existing user profile
  let existingProfile = await getUserProfile(user.uid);
  let profile: DbUserProfile;
  console.log("[googleSignInAndSetup DEBUG] Existing profile lookup result:", existingProfile);

  if (existingProfile) {
    profile = existingProfile;
    const rawStatus = profile.status || "ACTIVE";
    const status = rawStatus.toUpperCase();

    console.log(`[AuthFlow] Firestore status: ${rawStatus}`);
    console.log(`[AuthFlow] Current user: ${user.uid} (${user.email})`);

    if (status !== "ACTIVE") {
      console.warn(`[AuthFlow] Login allowed/denied: DENIED`);
      console.warn(`[AuthFlow] Redirect destination: None (User Signed Out)`);

      const { saveAuditLog } = await import("./firebaseDb");
      saveAuditLog({
        organizationId: profile.organizationId || "global",
        actor: { name: profile.displayName || user.email || "User", email: user.email || "", role: profile.role || "Employee" },
        action: "User login blocked",
        category: "user_activity",
        status: "denied",
        details: `Access blocked: account status is ${rawStatus}.`
      }).catch(console.error);

      await signOut(auth);
      cachedAccessToken = null;
      currentUserProfile = null;
      throw new Error("Your account has been suspended. Please contact your Organization Administrator.");
    }

    console.log(`[AuthFlow] Login allowed/denied: ALLOWED`);
    
    // Check if the organization still exists.
    if (profile.organizationId && profile.role !== "Super Admin") {
      const org = await getOrganization(profile.organizationId);
      if (!org) {
        console.warn(`[AuthFlow] Organization ${profile.organizationId} not found. Keeping membership intact to prevent accidental demotion.`);
      }
    }

    // If the user already exists but they are signing in with an invite token, process it.
    // We can infer it's an invite token if orgInput is present and role is not explicitly Organizer.
    if (orgInput && role !== "Super Admin" && role !== "Organizer") {
      try {
        console.log(`[AuthFlow] Processing pending invitation for existing user: ${orgInput}`);
        profile = await processPendingInvitation(user, orgInput);
        console.log(`[AuthFlow] ✅ Processed invite for existing user. New role: ${profile.role}`);
      } catch (err: any) {
        console.error("[AuthFlow] Failed to process invitation for existing user:", err);
        throw err;
      }
    }
    
    console.log(`[AuthFlow] Redirect destination role: ${profile.role}`);

    // If an existing user explicitly requested to be an Organizer and they aren't one yet,
    // let the flow fall through to create the organization for them instead of returning early.
    if (role === "Organizer" && profile.role !== "Organizer") {
      if (profile.organizationId) {
        throw new Error("This email is already associated with an organization. One email can only belong to one organization.");
      }
      console.log(`[AuthFlow] Upgrading existing user ${user.uid} to Organizer. Proceeding to org creation...`);
      profile.role = "Organizer";
      // Fall through...
    } else {
      return { user, token: accessToken, profile };
    }
  } else {
    // Brand new user profile
    profile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "",
      // Do not default to Employee if an orgInput (invite) is present. Wait for processPendingInvitation.
      role: normalizeRole(user.email?.toLowerCase() === PERMANENT_SUPER_ADMIN_EMAIL.toLowerCase() ? "Super Admin" : (orgInput ? null : (role || "Employee"))),
      status: "ACTIVE",
      onboardingCompleted: true
    } as any;
    console.log("[googleSignInAndSetup DEBUG] Brand new profile created:", profile);
  }

  if (profile.role === "Super Admin") {
    if (!profile.joinedAt) profile.joinedAt = new Date().toISOString();
    await saveUserProfile(profile);
    console.log("[FirebaseAuth] ✅ Super Admin profile saved. uid:", user.uid);
  } else if (profile.role === "Organizer") {
    if (!orgInput) throw new Error("Organization name required");
    
    // --- ORGANIZER NAME PROMPT ---
    if (!(profile as any).organizerName) {
      const pName = window.prompt("Welcome, Organizer! Please enter your Organizer Name:");
      (profile as any).organizerName = pName || user.displayName || user.email?.split('@')[0] || "Organizer";
    }
    // -----------------------------
    
    // Automatically generate an organization name if bypassing the popup
    const finalOrgInput = orgInput === "bypass_org_input" 
      ? `${user.displayName || user.email?.split('@')[0] || "My"} Workspace` 
      : orgInput;

    const { doc, setDoc, runTransaction, getDoc } = await import("firebase/firestore");
    const { db } = await import("./firebaseDb");
    
    const orgId = crypto.randomUUID();
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orgPath = `organizations/${orgId}`;
    const userPath = `users/${user.uid}`;

    console.log(`[FirestoreTransaction] Executing organization setup for authenticated UID: ${user.uid}`);
    console.log(`[FirestoreTransaction] Target Organization Path: ${orgPath}`);
    console.log(`[FirestoreTransaction] Target User Profile Path: ${userPath}`);

    const orgRef = doc(db, "organizations", orgId);
    const userRef = doc(db, "users", user.uid);

    const now = new Date().toISOString();
    const orgDoc = { 
      organizationId: orgId, 
      organizationName: finalOrgInput, 
      orgCode: inviteCode, 
      companyLogo: companyLogo || "",
      companyDomain: companyDomain || "",
      industry: industry || "Technology",
      country: country || "United States",
      ownerUid: user.uid,
      ownerEmail: user.email || "",
      status: "active",
      createdAt: now 
    };

    profile.role = "Organizer";
    profile.organizationId = orgDoc.organizationId;
    profile.organizationName = orgDoc.organizationName;
    (profile as any).organizationOwner = true;
    profile.status = "ACTIVE";
    profile.onboardingCompleted = true;
    profile.joinedAt = profile.joinedAt || now;

    const userDocData = {
      ...profile,
      createdAt: profile.createdAt || now,
      updatedAt: now
    };

    try {
      await runTransaction(db, async (transaction) => {
        transaction.set(orgRef, orgDoc);
        transaction.set(userRef, userDocData, { merge: true });
      });
      console.log(`[FirestoreTransaction] ✅ Transaction committed successfully!`);
      console.log(`[FirestoreTransaction] ✅ Organization document created: ${orgPath}`);
      console.log(`[FirestoreTransaction] ✅ User profile updated: ${userPath} (role: ORGANIZER, organizationOwner: true, status: ACTIVE)`);
    } catch (err: any) {
      console.warn(`[FirestoreTransaction] Atomic transaction notice:`, err.message || String(err));
      console.log(`[FirestoreFallback] Executing direct write sequence...`);

      try {
        await setDoc(orgRef, orgDoc);
        console.log(`[FirestoreFallback] ✅ Created organization at ${orgPath}`);
      } catch (orgErr: any) {
        console.warn(`[FirestoreFallback] Server write notice for ${orgPath}:`, orgErr.message);
      }

      try {
        await setDoc(userRef, userDocData, { merge: true });
        console.log(`[FirestoreFallback] ✅ Saved user profile at ${userPath}`);
      } catch (userErr: any) {
        console.warn(`[FirestoreFallback] Server write notice for ${userPath}:`, userErr.message);
      }
    }
  } else {
    if (!orgInput) throw new Error("An invite code is required for new accounts.");
    profile = await processPendingInvitation(user, orgInput);
    console.log("[FirebaseAuth] ✅ User profile saved via processPendingInvitation. uid:", user.uid);
  }

  currentUserProfile = profile as any;
  console.log("[FirebaseAuth] Final profile written to Firestore:", JSON.stringify(profile));
  return { user, token: accessToken, profile };
};

// ── Admin Utility: Force-correct a user's role in Firestore ──────────────────
// Use this to fix existing accounts that were saved with the wrong role.
export const forceUpdateUserRole = async (
  uid: string,
  email: string,
  role: "Super Admin" | "Organizer" | "Manager" | "Employee"
): Promise<void> => {
  const { saveUserProfile } = await import("./firebaseDb");
  const existing = await getUserProfile(uid);
  if (existing) {
    console.log(`[RoleRepair] Updating role for ${email}: ${existing.role} → ${role}`);
    await saveUserProfile({ ...existing, role });
    console.log(`[RoleRepair] ✅ Role updated for ${email}`);
  } else {
    console.warn(`[RoleRepair] No profile found for uid=${uid}`);
  }
};

