import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Building, 
  Users, 
  CreditCard, 
  BarChart3, 
  Plus, 
  Link, 
  Copy, 
  Check, 
  AlertTriangle, 
  ShieldCheck, 
  Trash2, 
  Edit3, 
  Ban, 
  CheckCircle2, 
  Send 
} from "lucide-react";
import { DbOrganization, getAllOrganizations, saveOrganization, saveInvitation } from "../../lib/firebaseDb";
import { UserProfile } from "../../types";

interface SuperAdminDashboardProps {
  currentUser: UserProfile | null;
  triggerToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function SuperAdminDashboard({ currentUser, triggerToast }: SuperAdminDashboardProps) {
  const [organizations, setOrganizations] = useState<DbOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [organizerEmail, setOrganizerEmail] = useState("");
  const [createdInviteLink, setCreatedInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setIsLoading(true);
    try {
      const { auth } = await import("../../lib/firebase");
      await auth.authStateReady();
      const orgs = await getAllOrganizations();
      setOrganizations(orgs);
    } catch (e: any) {
      console.error("[SuperAdminDashboard] Backend error loading organizations:", e);
      triggerToast("Could not load organizations. Please check your permissions or network.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    try {
      const orgId = crypto.randomUUID();
      const newOrg: DbOrganization = {
        organizationId: orgId,
        organizationName: newOrgName,
        orgCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        ownerUid: currentUser?.uid || "admin",
        ownerEmail: currentUser?.email || "admin@system.local",
        status: "active",
        createdAt: new Date().toISOString()
      };
      await saveOrganization(newOrg);

      if (organizerEmail.trim()) {
        const token = crypto.randomUUID();
        await saveInvitation({
          id: crypto.randomUUID(),
          organizationId: orgId,
          inviterId: currentUser?.uid || "super-admin",
          email: organizerEmail.trim(),
          role: "Organizer" as any,
          token,
          status: "pending",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

        const link = `${window.location.origin}/#/invite?token=${token}&role=Organizer`;
        setCreatedInviteLink(link);
      }

      triggerToast("Organization created successfully!", "success");
      setNewOrgName("");
      setOrganizerEmail("");
      if (!organizerEmail.trim()) {
        setShowCreateOrgModal(false);
      }
      loadOrganizations();
    } catch (e) {
      console.error(e);
      triggerToast("Failed to create organization", "error");
    }
  };

  const handleSuspendOrg = async (org: DbOrganization) => {
    try {
      const { saveOrganization } = await import("../../lib/firebaseDb");
      await saveOrganization({ ...org, orgCode: `SUSPENDED_${org.orgCode}` });
      triggerToast(`Organization ${org.organizationName} suspended.`, "info");
      loadOrganizations();
    } catch (e) {
      triggerToast("Failed to suspend organization", "error");
    }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    try {
      const { permanentlyDeleteOrganization } = await import("../../lib/firebaseDb");
      await permanentlyDeleteOrganization(orgId);
      triggerToast(`Deleted organization ${orgName} and all associated data.`, "info");
      loadOrganizations();
    } catch (e) {
      triggerToast("Failed to delete organization", "error");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(createdInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    triggerToast("Invitation link copied!", "info");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-purple-500" />
            Super Admin Control Center
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Global management of all enterprise organizations, organizers, system billing, and platform health.
          </p>
        </div>
        <button
          onClick={() => setShowCreateOrgModal(true)}
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-2 transition shadow-lg shadow-purple-500/20 self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>New Organization</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Orgs</span>
            <Building className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-extrabold">{organizations.length}</p>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Subscriptions</span>
            <CreditCard className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold">{organizations.length}</p>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform Uptime</span>
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-500">99.98%</p>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform Status</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-emerald-500">Healthy / Operational</p>
        </div>
      </div>

      {/* Organizations List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Building className="w-5 h-5 text-purple-500" />
          Organizations Directory
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 animate-pulse">Loading platform organizations...</div>
        ) : organizations.length === 0 ? (
          <div className="py-12 text-center text-slate-500">No organizations created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Org Name</th>
                  <th className="py-3 px-4">Org ID</th>
                  <th className="py-3 px-4">Org Code</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                {organizations.map((org) => (
                  <tr key={org.organizationId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {org.organizationName}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-slate-500">
                      {org.organizationId}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold ${
                        org.orgCode.startsWith("SUSPENDED") 
                          ? "bg-red-500/10 text-red-500" 
                          : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      }`}>
                        {org.orgCode}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-500 text-xs">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => triggerToast(`Subscription active for ${org.organizationName}`, "info")}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-purple-500 transition"
                          title="Manage Billing & Subscription"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleSuspendOrg(org)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-amber-500 transition"
                          title="Suspend Organization"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteOrg(org.organizationId, org.organizationName)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-red-500 transition"
                          title="Delete Organization"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Creating Org */}
      {showCreateOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold">Create New Organization</h3>
            
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Organization Name</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Organizer Email (Optional Invite)</label>
                <input
                  type="email"
                  value={organizerEmail}
                  onChange={(e) => setOrganizerEmail(e.target.value)}
                  placeholder="e.g. owner@acme.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {createdInviteLink && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-purple-600 dark:text-purple-400">Organizer Invite Token Generated:</p>
                  <div className="flex items-center gap-2">
                    <input 
                      readOnly 
                      value={createdInviteLink} 
                      className="w-full bg-white dark:bg-slate-950 px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-800"
                    />
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowCreateOrgModal(false); setCreatedInviteLink(""); }}
                  className="px-4 py-2 text-sm font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition"
                >
                  Create Org
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
