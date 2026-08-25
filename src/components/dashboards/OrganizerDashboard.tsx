import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Building2, 
  UserPlus, 
  Link as LinkIcon, 
  Copy, 
  Check, 
  Mail, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Users, 
  FileText, 
  FolderKanban, 
  Calendar,
  Send
} from "lucide-react";
import { DbInvitation, getInvitations, saveInvitation, getAllUserProfiles, DbUserProfile, getUserProfile, getOrganization, permanentlyDeleteInvitation } from "../../lib/firebaseDb";
import { googleSignInWithGmailScopes, getGmailAccessToken } from "../../lib/firebaseAuth";
import { UserProfile } from "../../types";

interface OrganizerDashboardProps {
  currentUser: UserProfile | null;
  triggerToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function OrganizerDashboard({ currentUser, triggerToast }: OrganizerDashboardProps) {
  const [invitations, setInvitations] = useState<DbInvitation[]>([]);
  const [members, setMembers] = useState<DbUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Manager" | "Employee">("Employee");
  const [generatedCode, setGeneratedCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let unsubscribeInvs: (() => void) | undefined;
    let unsubscribeUsers: (() => void) | undefined;

    const initLoad = async () => {
      if (!currentUser) return;
      let orgId = currentUser.organizationId;
      if (!orgId) {
        const freshProfile = await getUserProfile(currentUser.uid);
        if (freshProfile?.organizationId) {
          orgId = freshProfile.organizationId;
        }
      }
      if (orgId) {
        loadData(orgId);
        
        // Setup real-time listeners for synchronization
        try {
          const { collection, query, where, onSnapshot } = await import("firebase/firestore");
          const { db } = await import("../../lib/firebaseDb");

          const invsQuery = query(collection(db, "invitations"), where("organizationId", "==", orgId));
          unsubscribeInvs = onSnapshot(invsQuery, (snapshot) => {
            const invs = snapshot.docs.map(d => d.data() as DbInvitation);
            setInvitations(invs);
          });

          const usersQuery = query(collection(db, "users"), where("organizationId", "==", orgId));
          unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
            const users = snapshot.docs.map(d => d.data() as DbUserProfile);
            setMembers(users);
          });
        } catch (err) {
          console.error("Failed to setup real-time synchronization:", err);
        }
      } else {
        setIsLoading(false);
        // Silently fail to show friendly empty state
      }
    };
    initLoad();
    
    return () => {
      if (unsubscribeInvs) unsubscribeInvs();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, [currentUser]);

  const loadData = async (targetOrgId?: string) => {
    let orgId = targetOrgId || currentUser?.organizationId;
    if (!orgId && currentUser) {
      console.log("[OrganizerDashboard DEBUG] organizationId missing in currentUser. Querying getUserProfile for uid:", currentUser.uid);
      const freshProfile = await getUserProfile(currentUser.uid);
      orgId = freshProfile?.organizationId;
    }
    
    console.log("[OrganizerDashboard DEBUG] loadData starting with parameters:", {
      "currentUser.uid": currentUser?.uid,
      "currentUser.email": currentUser?.email,
      "currentUser.role": currentUser?.role,
      "resolvedOrganizationId": orgId
    });

    if (!orgId) {
      console.warn("[OrganizerDashboard DEBUG] Load aborted: Missing organizationId.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log("[OrganizerDashboard DEBUG] Executing getInvitations query for path: [invitations] where organizationId == ", orgId);
      console.log("[OrganizerDashboard DEBUG] Executing getAllUserProfiles query for path: [users] where organizationId == ", orgId);
      const [invs, users] = await Promise.all([
        getInvitations(orgId),
        getAllUserProfiles(orgId)
      ]);
      console.log("[OrganizerDashboard DEBUG] Firestore load successful. Data size:", {
        invitationsCount: invs.length,
        membersCount: users.length
      });
      setInvitations(invs);
      setMembers(users);
      
      const org = await getOrganization(orgId);
      if (!org) {
        console.warn("[OrganizerDashboard DEBUG] ⚠️ Organization data not found. Proceeding with limited context.");
      }
    } catch (e: any) {
      console.error("[OrganizerDashboard DEBUG] ❌ Failed to load organization data!");
      console.error("[OrganizerDashboard DEBUG] Error Object:", e);
      console.error("[OrganizerDashboard DEBUG] Error Message:", e?.message);
      console.error("[OrganizerDashboard DEBUG] Stack Trace:\n", e?.stack || new Error().stack);
      console.error("[OrganizerDashboard DEBUG] Failed Paths: [invitations] or [users] with organizationId:", orgId);
      triggerToast(`Failed to load organization data: ${e.message || e}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateInvite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!currentUser) {
      triggerToast("Cannot generate invitation: Not logged in.", "error");
      return;
    }

    if (currentUser.role !== "Organizer") {
      const authRoleErr = `Unauthorized operation: User role is [${currentUser.role}]. Only Organizer accounts are allowed to generate invitations.`;
      console.error("[OrganizerDashboard DEBUG] ❌ Role Validation Failed:", authRoleErr);
      triggerToast(authRoleErr, "error");
      return;
    }

    let orgId = currentUser?.organizationId;
    if (!orgId && currentUser) {
      const freshProfile = await getUserProfile(currentUser.uid);
      orgId = freshProfile?.organizationId;
    }

    console.log("[OrganizerDashboard DEBUG] handleGenerateInvite triggered:", {
      "currentUser.uid": currentUser?.uid,
      "currentUser.email": currentUser?.email,
      "currentUser.role": currentUser?.role,
      "organizationId": orgId,
      "inviteRole": inviteRole,
      "inviteEmail": inviteEmail
    });

    if (!orgId) {
      triggerToast("Cannot generate invitation: Missing organization ID.", "error");
      return;
    }

    const emailToUse = inviteEmail.trim() || `invitee-${Date.now().toString(36)}@workspace.local`;
    
    // Generate secure code: EMP-XXXXXX or MGR-XXXXXX
    const prefix = inviteRole === "Employee" ? "EMP" : "MGR";
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const token = `${prefix}-${randomHex}`;
    
    const inviteId = token; // Use token directly as the document ID for unauthenticated lookups
    
    const newInv: DbInvitation = {
      id: inviteId,
      organizationId: orgId,
      inviterId: currentUser.uid,
      createdBy: currentUser.uid,
      email: emailToUse,
      role: inviteRole,
      token,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };

    try {
      console.log(`[OrganizerDashboard DEBUG] Triggering setDoc() on path: [invitations/${inviteId}] with payload:`, newInv);
      await saveInvitation(newInv);
      console.log(`[OrganizerDashboard DEBUG] setDoc() on invitations/${inviteId} completed successfully.`);

      setGeneratedCode(token);
      
      try {
        await navigator.clipboard.writeText(token);
        triggerToast(`Invitation code generated and copied to clipboard!`, "success");
      } catch (clipErr) {
        console.warn("Clipboard copy blocked or failed:", clipErr);
        triggerToast(`Invitation code generated!`, "success");
      }
      
      await loadData(orgId);
    } catch (e: any) {
      console.error("[OrganizerDashboard DEBUG] ❌ Invitation generation failed!");
      console.error("[OrganizerDashboard DEBUG] Operation: setDoc()");
      console.error("[OrganizerDashboard DEBUG] Target Path: invitations/" + inviteId);
      console.error("[OrganizerDashboard DEBUG] Error Object:", e);
      console.error("[OrganizerDashboard DEBUG] Error Message:", e?.message);
      console.error("[OrganizerDashboard DEBUG] Stack Trace:\n", e?.stack || new Error().stack);
      const errorDetail = e?.message || String(e);
      triggerToast(`Failed to generate link: ${errorDetail}`, "error");
    }
  };

  const handleRevokeInvite = async (inv: DbInvitation) => {
    try {
      await saveInvitation({ ...inv, status: "revoked" });
      triggerToast(`Invitation for ${inv.email} revoked`, "info");
      loadData();
    } catch (e) {
      console.error(e);
      triggerToast("Failed to revoke invitation", "error");
    }
  };

  const handleDeleteInvite = async (inv: DbInvitation) => {
    if (!window.confirm("Permanently delete this invitation?")) return;
    try {
      await permanentlyDeleteInvitation(inv.id);
      triggerToast("Invitation deleted", "info");
      loadData();
    } catch (e) {
      triggerToast("Failed to delete invitation", "error");
    }
  };

  const handleReactivateInvite = async (inv: DbInvitation) => {
    try {
      // Create a fresh code
      const prefix = inv.role === "Employee" ? "EMP" : "MGR";
      const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newCode = `${prefix}-${randomHex}`;
      
      const newInv: DbInvitation = {
        ...inv,
        id: newCode,
        token: newCode,
        status: "pending",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      await saveInvitation(newInv);
      // Delete the old one
      await permanentlyDeleteInvitation(inv.id);
      
      triggerToast(`Invitation reactivated with new code: ${newCode}`, "success");
      loadData();
    } catch (e) {
      triggerToast("Failed to reactivate invitation", "error");
    }
  };

  const handleSendEmailInvite = async (inv: DbInvitation) => {
    try {
      let activeToken = getGmailAccessToken();
      if (!activeToken) {
        triggerToast("Please authorize Gmail to send emails.", "info");
        const res = await googleSignInWithGmailScopes();
        if (res && res.accessToken) {
          activeToken = res.accessToken;
        } else {
          throw new Error("Gmail authorization failed or was cancelled.");
        }
      }

      const { saveEmailRecord } = await import("../../lib/firebaseDb");
      
      const emailResponse = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: inv.email,
          subject: `You've been invited to join ${currentUser?.organizationName || "Enterprise Workspace"}`,
          body: `Hello,<br/><br/>You have been invited as a ${inv.role} to join ${currentUser?.organizationName || "our organization"}.<br/><br/>Go to the login page, select "Join Organization" and enter your secure invitation code:<br/><br/><strong>${inv.token}</strong><br/><br/>This code is single-use.`,
          token: activeToken,
          type: "manual"
        })
      });

      const emailData = await emailResponse.json();

      if (!emailResponse.ok) {
        if (currentUser && emailData.log) {
          try {
            await saveEmailRecord({
              ...emailData.log,
              userId: currentUser.uid,
              organizationId: currentUser.organizationId
            });
          } catch (fErr) {
            console.error("Failed saving email failure log:", fErr);
          }
        }
        throw new Error(emailData.error || emailData.details || "Failed to dispatch through Gmail API.");
      }

      if (currentUser && emailData.log) {
        try {
          await saveEmailRecord({
            ...emailData.log,
            userId: currentUser.uid,
            organizationId: currentUser.organizationId
          });
        } catch (fErr) {
          console.error("Failed saving email success log:", fErr);
        }
      }

      triggerToast(`Invitation email dispatched to ${inv.email}!`, "success");
    } catch (e) {
      console.error(e);
      triggerToast("Failed to dispatch email", "error");
    }
  };

  const handleSuspendMember = async (member: DbUserProfile) => {
    try {
      const { updateUserStatus } = await import("../../lib/firebaseDb");
      await updateUserStatus(member.uid, "SUSPENDED");
      triggerToast(`Access suspended for ${member.displayName}`, "info");
    } catch (e) {
      triggerToast("Failed to suspend member", "error");
    }
  };

  const handleReactivateMember = async (member: DbUserProfile) => {
    try {
      const { updateUserStatus } = await import("../../lib/firebaseDb");
      await updateUserStatus(member.uid, "ACTIVE");
      triggerToast(`Access reactivated for ${member.displayName}`, "success");
    } catch (e) {
      triggerToast("Failed to reactivate member", "error");
    }
  };

  const handleChangeRole = async (member: DbUserProfile) => {
    const newRole = member.role === "Manager" ? "Employee" : "Manager";
    try {
      const { saveUserProfile } = await import("../../lib/firebaseDb");
      await saveUserProfile({ ...member, role: newRole });
      triggerToast(`Role updated to ${newRole} for ${member.displayName}`, "success");
    } catch (e) {
      triggerToast("Failed to change role", "error");
    }
  };

  const handleDeleteMember = async (member: DbUserProfile) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${member.email} from the organization?`)) return;
    try {
      const { permanentlyDeleteUser } = await import("../../lib/firebaseDb");
      await permanentlyDeleteUser(member.uid, member.email, member.organizationId);
      triggerToast(`${member.displayName} removed from organization`, "info");
    } catch (e) {
      triggerToast("Failed to remove member", "error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    triggerToast("Invitation link copied to clipboard!", "info");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-500" />
            {currentUser?.organizationName || "Organization"} Owner Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage organization members, approve/reject employee requests, generate secure single-use invites, and track team analytics.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => { setInviteRole("Manager"); setShowInviteModal(true); }}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 cursor-pointer text-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Manager</span>
          </button>
          <button
            onClick={() => { setInviteRole("Employee"); setShowInviteModal(true); }}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-500/20 cursor-pointer text-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Employee</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Members</span>
            <Users className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-3xl font-extrabold">{members.filter(m => m.status !== "SUSPENDED" && m.status !== "PENDING").length}</p>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Invites</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-extrabold text-amber-500">
            {invitations.filter(i => i.status === "pending").length}
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Managers</span>
            <Building2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-500">
            {members.filter(m => m.role === "Manager" && m.status !== "SUSPENDED" && m.status !== "PENDING").length}
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Employees</span>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-extrabold text-blue-500">
            {members.filter(m => m.role === "Employee" && m.status !== "SUSPENDED" && m.status !== "PENDING").length}
          </p>
        </div>
      </div>

      {/* Employee Approval Requests Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-500" />
          Organization Member Roster & Approval Management
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Name / Email</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4">Access Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
              {members.map((m) => (
                <tr key={m.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <td className="py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">
                    <div>{m.displayName}</div>
                    <div className="text-xs text-slate-400 font-normal">{m.email}</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                      m.role === "Organizer" 
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" 
                        : m.role === "Manager"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    }`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-xs text-slate-500">
                    {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "Active"}
                  </td>
                  <td className="py-4 px-4">
                    {m.status === "SUSPENDED" ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1 w-fit">
                        <Clock className="w-3.5 h-3.5" /> Suspended
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {(m.uid !== currentUser?.uid && (m.role === "Manager" || m.role === "Employee")) && (
                      <div className="flex items-center gap-2">
                        {m.status !== "SUSPENDED" ? (
                          <button
                            onClick={() => handleSuspendMember(m)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition flex items-center gap-1"
                            title="Suspend Access"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivateMember(m)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition flex items-center gap-1"
                            title="Reactivate Access"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Reactivate
                          </button>
                        )}
                        <button
                          onClick={() => handleChangeRole(m)}
                          className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-bold transition flex items-center gap-1"
                          title="Change Role"
                        >
                          <Users className="w-3.5 h-3.5" />
                          {m.role === "Manager" ? "Demote" : "Promote"}
                        </button>
                        <button
                          onClick={() => handleDeleteMember(m)}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-xs font-bold transition flex items-center gap-1"
                          title="Remove Member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invitations Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-500" />
          Pending & Historical Invitation Directory
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 animate-pulse">Loading invitations...</div>
        ) : invitations.length === 0 ? (
          <div className="py-12 text-center text-slate-500">No active or historical invitations.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Recipient Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Expires At</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                {invitations.map((inv) => {
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {inv.email}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          inv.role === "Manager" 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}>
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {inv.status === "pending" && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1 w-fit">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </span>
                        )}
                        {inv.status === "accepted" && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                          </span>
                        )}
                        {inv.status === "revoked" && (
                          <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1 w-fit">
                            <XCircle className="w-3.5 h-3.5" /> Revoked
                          </span>
                        )}
                        {inv.status === "expired" && (
                          <span className="px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 text-xs font-bold flex items-center gap-1 w-fit">
                            <Clock className="w-3.5 h-3.5" /> Expired
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500 text-xs">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        {inv.status === "pending" ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(inv.token)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-500 transition flex items-center gap-1 text-xs font-semibold"
                              title="Copy Code"
                            >
                              <Copy className="w-4 h-4" /> Copy Code
                            </button>
                            <button
                              onClick={() => handleSendEmailInvite(inv)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-500 transition flex items-center gap-1 text-xs font-semibold"
                              title="Send Email"
                            >
                              <Send className="w-4 h-4" /> Send Email
                            </button>
                            <button
                              onClick={() => handleRevokeInvite(inv)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-red-500 transition flex items-center gap-1 text-xs font-semibold"
                              title="Revoke Invitation"
                            >
                              <Trash2 className="w-4 h-4" /> Revoke
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReactivateInvite(inv)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-500 transition flex items-center gap-1 text-xs font-semibold"
                              title="Reactivate Invitation"
                            >
                              <Clock className="w-4 h-4" /> Reactivate
                            </button>
                            <button
                              onClick={() => handleDeleteInvite(inv)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-red-500 transition flex items-center gap-1 text-xs font-semibold"
                              title="Permanently Delete"
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold">Generate Secure Invitation</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Recipient Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. employee@company.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Assign Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Employee">Employee (Workspace Access)</option>
                  <option value="Manager">Manager (Team Management)</option>
                </select>
              </div>

              {generatedCode && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Secure Invitation Code:</p>
                  <div className="flex items-center gap-2">
                    <input 
                      readOnly 
                      value={generatedCode} 
                      className="w-full bg-white dark:bg-slate-950 px-3 py-1.5 rounded-lg text-lg text-center font-black tracking-[0.2em] font-mono border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedCode)}
                      className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowInviteModal(false); setGeneratedCode(""); setInviteEmail(""); }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleGenerateInvite}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  Generate Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
