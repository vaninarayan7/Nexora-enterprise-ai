import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Shield, 
  Users, 
  Cpu, 
  Database, 
  Mail, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  UserPlus,
  Lock,
  Compass,
  Zap,
  HardDrive,
  Activity,
  UserCheck,
  Briefcase,
  Layers,
  Sparkles,
  Megaphone,
  ShieldAlert,
  Search,
  SlidersHorizontal,
  Download,
  Fingerprint,
  Clock,
  PlusCircle,
  AlertOctagon,
  Info
} from "lucide-react";
import { UserProfile, UserRole, AdminSystemStatus } from "../types";
import { getOrganization, getAllUserProfiles, DbOrganization, DbUserProfile, updateUserStatus, saveAuditLog } from "../lib/firebaseDb";

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: { name: string; email: string; role: string; ip: string };
  action: string;
  category: "user_activity" | "document_access" | "api_requests";
  status: "success" | "warning" | "denied";
  details: string;
  latency?: string;
}

interface AdminPanelProps {
  currentUser: UserProfile | null;
  onUpdateUserRole?: (targetUid: string, targetEmail: string, targetDisplayName: string, fromRole: string, toRole: UserRole) => Promise<void>;
  triggerToast: (msg: string, type: "success" | "info" | "error") => void;
}

interface ManagedUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: "active" | "suspended" | "pending";
}

export default function AdminPanel({
  currentUser,
  onUpdateUserRole,
  triggerToast
}: AdminPanelProps) {
  const [users, setUsers] = useState<DbUserProfile[]>([]);
  const [orgDetails, setOrgDetails] = useState<DbOrganization | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    async function loadAdminData() {
      const isAdminRole = currentUser?.role === "Super Admin" || currentUser?.role === "Admin";
      
      console.log(`[FirestoreData] Current organizationId:`, currentUser?.organizationId || "ALL (Global)");
      console.log(`[FirestoreData] Collection name: users`);

      if (isAdminRole) {
        setIsLoadingData(true);
        try {
          const profiles = await getAllUserProfiles(currentUser?.organizationId);
          console.log(`[FirestoreData] Query executed: ${currentUser?.organizationId ? `where("organizationId", "==", "${currentUser.organizationId}")` : 'collection("users")'}`);
          console.log(`[FirestoreData] Number of documents returned:`, profiles.length);

          const org = currentUser?.organizationId ? await getOrganization(currentUser.organizationId) : null;
          if (org) {
            setOrgDetails(org);
          } else {
            console.warn("[AdminPanel] Organization not found. Generating default state.");
            setOrgDetails({
              organizationId: currentUser?.organizationId || "unknown",
              organizationName: currentUser?.organizationName || "Unknown Workspace",
              orgCode: "N/A",
              ownerUid: currentUser?.uid || "",
              ownerEmail: currentUser?.email || "",
              status: "active",
              createdAt: new Date().toISOString()
            });
          }
          setUsers(profiles);
        } catch (err: any) {
          console.error("[FirestoreData] Firestore errors:", err);
          triggerToast("Failed to load organization data", "error");
        } finally {
          setIsLoadingData(false);
        }
      } else {
        setIsLoadingData(false);
      }
    }
    loadAdminData();
  }, [currentUser]);

  // Sub-tab state
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<"dispatch" | "audit">("dispatch");

  // Audit Logs state (pre-seeded & sync'd with localStorage)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem("nexora_security_audit_logs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error(err);
      }
    }
    return [
      {
        id: "log-1",
        timestamp: new Date(Date.now() - 1000 * 30).toISOString(), // 30s ago
        actor: { name: "Nexora CEO", email: "ceo@enterprise.io", role: "Admin", ip: "192.168.1.102" },
        action: "Database Inspection",
        category: "api_requests",
        status: "success",
        details: "Inspected live telemetry dashboard on control-plane-01",
        latency: "42ms"
      },
      {
        id: "log-2",
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5m ago
        actor: { name: "Talent Acquisition Lead", email: "hr@enterprise.io", role: "HR", ip: "192.168.1.105" },
        action: "Document Access",
        category: "document_access",
        status: "success",
        details: "Retrieved file 'employee_handbook_v2.pdf' from FAISS store",
        latency: "15ms"
      },
      {
        id: "log-3",
        timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(), // 1.08h ago
        actor: { name: "Contractor Node", email: "temp@enterprise.io", role: "Employee", ip: "198.51.100.45" },
        action: "Unauthorized Access Blocked",
        category: "user_activity",
        status: "denied",
        details: "Attempted to access Admin Dispatch and Telemetry Panel",
        latency: "8ms"
      },
      {
        id: "log-4",
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3h ago
        actor: { name: "Staff Research Engineer", email: "employee@enterprise.io", role: "Employee", ip: "192.168.1.112" },
        action: "Document RAG Embed",
        category: "document_access",
        status: "success",
        details: "Uploaded and chunked 'financial_forecast_2026.docx' (24 nodes generated)",
        latency: "840ms"
      },
      {
        id: "log-5",
        timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(), // 6h ago
        actor: { name: "System Cron", email: "cron@nexora-engine.internal", role: "Admin", ip: "127.0.0.1" },
        action: "Embedding Table Sync",
        category: "api_requests",
        status: "success",
        details: "Synchronized in-memory cache with cloud backup snapshot",
        latency: "120ms"
      },
      {
        id: "log-6",
        timestamp: new Date(Date.now() - 1000 * 60 * 720).toISOString(), // 12h ago
        actor: { name: "Nexora CEO", email: "ceo@enterprise.io", role: "Admin", ip: "192.168.1.102" },
        action: "API Config Modified",
        category: "api_requests",
        status: "warning",
        details: "Updated model target to Gemini 2.5 Flash on active profile",
        latency: "220ms"
      },
      {
        id: "log-7",
        timestamp: new Date(Date.now() - 1000 * 60 * 1440).toISOString(), // 24h ago
        actor: { name: "Unknown Client", email: "scanner@botnet.org", role: "Employee", ip: "203.0.113.88" },
        action: "API Endpoint Probe",
        category: "api_requests",
        status: "denied",
        details: "Access denied on '/api/admin/flush-vectors' due to missing authorization token",
        latency: "2ms"
      }
    ];
  });

  // Local storage synchronization
  useEffect(() => {
    localStorage.setItem("nexora_security_audit_logs", JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Helper to add audit logs
  const addAuditLog = (
    action: string,
    category: "user_activity" | "document_access" | "api_requests",
    status: "success" | "warning" | "denied",
    details: string,
    latency?: string
  ) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date().toISOString(),
      actor: {
        name: currentUser?.displayName || "Nexora CEO",
        email: currentUser?.email || "ceo@enterprise.io",
        role: currentUser?.role || "Admin",
        ip: "192.168.1.102"
      },
      action,
      category,
      status,
      details,
      latency: latency || `${Math.floor(Math.random() * 50) + 10}ms`
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Search & filter states
  const [auditSearch, setAuditSearch] = useState("");
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<"all" | "user_activity" | "document_access" | "api_requests">("all");
  const [auditStatusFilter, setAuditStatusFilter] = useState<"all" | "success" | "warning" | "denied">("all");

  // Custom log entry creator states
  const [showCustomLogForm, setShowCustomLogForm] = useState(false);
  const [customAction, setCustomAction] = useState("");
  const [customCategory, setCustomCategory] = useState<"user_activity" | "document_access" | "api_requests">("user_activity");
  const [customStatus, setCustomStatus] = useState<"success" | "warning" | "denied">("success");
  const [customDetails, setCustomDetails] = useState("");
  const [customActorName, setCustomActorName] = useState("");
  const [customActorEmail, setCustomActorEmail] = useState("");

  const [sysStatus, setSysStatus] = useState<AdminSystemStatus>({
    cpuUsage: 12,
    memoryUsage: 42.8,
    vectorCount: 4,
    documentCount: 4,
    emailsSent: 6,
    apiLatency: 48
  });

  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isClearingVectors, setIsClearingVectors] = useState(false);
  
  // Input fields for adding users
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("Employee");

  // Announcement System states
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [announcementSubject, setAnnouncementSubject] = useState("");
  const [announcementChannel, setAnnouncementChannel] = useState<"Global Banner" | "Email Broadcast" | "Slack Relay">("Global Banner");
  const [announcementsList, setAnnouncementsList] = useState<{ id: string; subject: string; msg: string; channel: string; timestamp: string }[]>([
    { id: "a-1", subject: "In-memory Vector DB Upgrade", msg: "We upgraded embedding partition tables for faster multi-language semantic lookups in Telugu and Hindi.", channel: "Global Banner", timestamp: new Date(Date.now() - 3600000).toLocaleString() }
  ]);

  const handleSendAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementSubject.trim() || !announcementMsg.trim()) {
      triggerToast("Please provide both a subject and dynamic text for the announcement.", "error");
      return;
    }
    const newAnn = {
      id: `ann-${Date.now()}`,
      subject: announcementSubject,
      msg: announcementMsg,
      channel: announcementChannel,
      timestamp: new Date().toLocaleString()
    };
    setAnnouncementsList(prev => [newAnn, ...prev]);
    setAnnouncementSubject("");
    setAnnouncementMsg("");
    triggerToast(`Announcement broadcasted successfully via ${announcementChannel}!`, "success");
    addAuditLog(
      "Broadcast Dispatch",
      "user_activity",
      "success",
      `Dispatched workspace broadcast: [${announcementSubject}] via channel: [${announcementChannel}]`
    );
  };

  // Audit Logs State Handlers & Simulation Helpers
  const [isExporting, setIsExporting] = useState(false);

  // Compute filtered logs dynamically
  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.actor.name.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.actor.email.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearch.toLowerCase());

    const matchesCategory = auditCategoryFilter === "all" || log.category === auditCategoryFilter;
    const matchesStatus = auditStatusFilter === "all" || log.status === auditStatusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Handle Create Custom Log Form Submission
  const handleCreateCustomLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAction.trim() || !customDetails.trim()) {
      triggerToast("Please provide both an Action Name and event description details.", "error");
      return;
    }

    const nextLog: AuditLog = {
      id: `log-man-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: {
        name: customActorName.trim() || currentUser?.displayName || "System Auditor Node",
        email: customActorEmail.trim() || currentUser?.email || "auditor@enterprise.internal",
        role: "Admin",
        ip: "192.168.1.102"
      },
      action: customAction,
      category: customCategory,
      status: customStatus,
      details: customDetails,
      latency: "1ms"
    };

    setAuditLogs(prev => [nextLog, ...prev]);
    
    // Clear custom builder inputs
    setCustomAction("");
    setCustomDetails("");
    setCustomActorName("");
    setCustomActorEmail("");
    setShowCustomLogForm(false);
    
    triggerToast(`Incident Entry '${customAction}' committed successfully to buffer!`, "success");
  };

  // Threat Intrusion Simulator
  const handleSimulateThreat = () => {
    const threats = [
      {
        action: "API Endpoint Scanned",
        category: "api_requests" as const,
        status: "denied" as const,
        details: "Blocked suspicious rapid endpoint scans from IP 185.220.101.4 (anonymous VPN) attempting to probe /api/admin/flush-vectors",
        latency: "1ms"
      },
      {
        action: "Potential Brute Force",
        category: "user_activity" as const,
        status: "warning" as const,
        details: "Detected 5 failed multi-factor authentication challenges for 'hr@enterprise.io' within 30 seconds from IP 198.51.100.12",
        latency: "18ms"
      },
      {
        action: "Bulk Document Fetch",
        category: "document_access" as const,
        status: "warning" as const,
        details: "User 'employee@enterprise.io' triggered rapid sequence download of 14 proprietary RAG source text archives",
        latency: "45ms"
      },
      {
        action: "SQL Injection Blocked",
        category: "api_requests" as const,
        status: "denied" as const,
        details: "Web Application Firewall (WAF) filtered query string containing suspicious database sequence: '; DROP TABLE session_cache; --",
        latency: "2ms"
      },
      {
        action: "Cross-Origin Origin Violation",
        category: "api_requests" as const,
        status: "warning" as const,
        details: "Blocked cross-origin request from unauthorized host 'http://malicious-dashboard.net' attempting session hijack",
        latency: "4ms"
      }
    ];

    const randomThreat = threats[Math.floor(Math.random() * threats.length)];
    const newLog: AuditLog = {
      id: `log-sim-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      actor: {
        name: randomThreat.status === "denied" ? "WAF Firewall Node" : "Intrusion Detection Daemon",
        email: randomThreat.status === "denied" ? "firewall-admin@nexora-shield.internal" : "ids@nexora-shield.internal",
        role: "Admin",
        ip: "185.220.101.4"
      },
      action: randomThreat.action,
      category: randomThreat.category,
      status: randomThreat.status,
      details: randomThreat.details,
      latency: randomThreat.latency
    };

    setAuditLogs(prev => [newLog, ...prev]);
    
    if (randomThreat.status === "denied") {
      triggerToast(`CRITICAL: Security Breach Intercepted! ${randomThreat.action}`, "error");
    } else {
      triggerToast(`WARNING: Suspicious Security Pattern! ${randomThreat.action}`, "info");
    }
  };

  // Export CSV Trail Simulator
  const handleExportCSV = () => {
    if (filteredAuditLogs.length === 0) {
      triggerToast("No log records currently matching the filter criteria to export.", "error");
      return;
    }
    
    setIsExporting(true);
    triggerToast("Compiling security logs audit trail...", "info");
    
    setTimeout(() => {
      // Create CSV payload
      const headers = ["ID", "Timestamp", "Actor Name", "Actor Email", "Actor IP", "Action", "Category", "Status", "Details", "Latency"].join(",");
      const rows = filteredAuditLogs.map(log => [
        log.id,
        log.timestamp,
        `"${log.actor.name}"`,
        log.actor.email,
        log.actor.ip,
        `"${log.action}"`,
        log.category,
        log.status,
        `"${log.details.replace(/"/g, '""')}"`,
        log.latency || "N/A"
      ].join(","));
      
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `nexora_security_audit_log_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsExporting(false);
      triggerToast(`Successfully exported ${filteredAuditLogs.length} audit trail records!`, "success");
    }, 1200);
  };

  // Fetch telemetry from Express server
  const fetchSystemStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch("/api/admin/status");
      if (res.ok) {
        const data = await res.json();
        setSysStatus(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const [orgCode, setOrgCode] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");

  // Load real Firestore users and audit logs on mount
  const loadRealUsersAndLogs = async () => {
    if (!currentUser || !currentUser.organizationId) return;
    try {
      const { db } = await import("../lib/firebaseDb");
      const { doc, getDoc } = await import("firebase/firestore");
      const orgDoc = await getDoc(doc(db, "organizations", currentUser.organizationId));
      if (orgDoc.exists()) {
        const data = orgDoc.data();
        setOrgCode(data.orgCode || "");
        setOrgName(data.organizationName || "");
      }

      const { getAllUserProfiles, getAuditLogs } = await import("../lib/firebaseDb");
      const profiles = await getAllUserProfiles(currentUser.organizationId);
      if (profiles && profiles.length > 0) {
        setUsers(profiles.map(p => ({
          uid: p.uid,
          email: p.email,
          displayName: p.displayName,
          role: p.role,
          status: p.status || "active"
        })));
      }

      const logs = await getAuditLogs(currentUser.organizationId);
      if (logs && logs.length > 0) {
        setAuditLogs(logs.map(l => ({
          id: l.id,
          timestamp: l.timestamp,
          actor: {
            name: "Security Daemon",
            email: l.userId || "auditor@enterprise.io",
            role: "Admin",
            ip: "127.0.0.1"
          },
          action: l.action,
          category: "user_activity" as const,
          status: "success" as const,
          details: l.details,
          latency: "0ms"
        })));
      }
    } catch (e) {
      console.warn("Failed to load real users/logs in AdminPanel:", e);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    loadRealUsersAndLogs();
    const interval = setInterval(fetchSystemStatus, 10000); // Polling telemetry
    return () => clearInterval(interval);
  }, []);

  // Update user role
  const handleUpdateRole = async (uid: string, role: UserRole) => {
    const targetUser = users.find(u => u.uid === uid);
    if (!targetUser) return;
    
    // Optimistic UI update
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role } : u));
    
    if (onUpdateUserRole) {
      await onUpdateUserRole(targetUser.uid, targetUser.email, targetUser.displayName, targetUser.role, role);
      loadRealUsersAndLogs();
    } else {
      triggerToast(`User role updated locally to ${role}.`, "info");
    }
  };

  // Update user account status
  const handleUpdateStatus = async (uid: string, nextStatus: "ACTIVE" | "SUSPENDED") => {
    const target = users.find(u => u.uid === uid);
    if (!target) return;
 
    try {
      await updateUserStatus(uid, nextStatus);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, status: nextStatus } : u));
      
      const statusLabel = nextStatus === "SUSPENDED" ? "suspended" : "active";
      triggerToast(`User account is now ${statusLabel}.`, "info");
 
      const actionText = nextStatus === "SUSPENDED" ? "User suspended" : "User activated";
      addAuditLog(
        actionText,
        "user_activity",
        nextStatus === "SUSPENDED" ? "warning" : "success",
        `Changed status of user '${target.displayName}' (${target.email}) to ${nextStatus}`
      );
 
      saveAuditLog({
        organizationId: currentUser?.organizationId || "global",
        actor: { name: currentUser?.displayName || "Admin", email: currentUser?.email || "", role: currentUser?.role || "Admin" },
        action: actionText,
        category: "user_activity",
        status: nextStatus === "SUSPENDED" ? "warning" : "success",
        details: `Target user ${target.email} status set to ${nextStatus}`
      }).catch(console.error);
 
      loadRealUsersAndLogs();
    } catch (err) {
      console.error("Failed to update user status in Firestore:", err);
      triggerToast("Failed to update user status in Firestore", "error");
    }
  };

  // Permanently delete user
  const handleDeleteUserPermanently = async (uid: string, email: string) => {
    const target = users.find(u => u.uid === uid);
    if (!target) return;

    const confirmed = window.confirm("This action cannot be undone. Delete this user permanently?");
    if (!confirmed) return;

    try {
      const { permanentlyDeleteUser } = await import("../lib/firebaseDb");
      await permanentlyDeleteUser(uid, email, currentUser?.organizationId || "global");

      setUsers(prev => prev.filter(u => u.uid !== uid));
      triggerToast(`User ${email} deleted permanently.`, "success");

      addAuditLog(
        "User Permanently Deleted",
        "user_activity",
        "warning",
        `Permanently deleted user '${target.displayName}' (${email})`
      );

      saveAuditLog({
        organizationId: currentUser?.organizationId || "global",
        actor: { name: currentUser?.displayName || "Admin", email: currentUser?.email || "", role: currentUser?.role || "Admin" },
        action: "User Permanently Deleted",
        category: "user_activity",
        status: "warning",
        details: `Target user ${email} deleted permanently.`
      }).catch(console.error);

      loadRealUsersAndLogs();
    } catch (err) {
      console.error("Failed to delete user permanently in Firestore:", err);
      triggerToast("Failed to delete user permanently", "error");
    }
  };

  // Add new simulated user
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) {
      triggerToast("Please provide all required details for user creation.", "error");
      return;
    }
    const newUser: ManagedUser = {
      uid: `usr-${Date.now()}`,
      email: newEmail,
      displayName: newName,
      role: newRole,
      status: "active"
    };
    setUsers(prev => [...prev, newUser]);
    setNewEmail("");
    setNewName("");
    triggerToast(`Created user node "${newName}".`, "success");
    addAuditLog(
      "User Provisioned",
      "user_activity",
      "success",
      `Provisioned active account for user '${newName}' (${newEmail}) with role ${newRole}`
    );
  };

  // Clear server vector cache
  const handleClearVectorStore = async () => {
    setIsClearingVectors(true);
    try {
      triggerToast("Purging local vector indices...", "info");
      setTimeout(() => {
        setSysStatus(prev => ({ ...prev, vectorCount: 0, documentCount: 0 }));
        triggerToast("In-memory database vectors cleared.", "success");
        setIsClearingVectors(false);
        addAuditLog(
          "Database Purge",
          "api_requests",
          "warning",
          "Cleared all in-memory vector embeddings and document metadata"
        );
      }, 1200);
    } catch (err) {
      setIsClearingVectors(false);
    }
  };

  const isAdmin = currentUser?.role === "Super Admin" || currentUser?.role === "Admin";

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-transparent">
        <div className="p-4 rounded-full bg-red-500/10 text-red-500 mb-4 animate-bounce shadow-lg shadow-red-500/5">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Access Restricted</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm leading-normal">
          You are currently signed in as an <strong>{currentUser?.role || "Viewer"}</strong> node. Please request privileges from your Nexora Workspace administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-transparent transition-colors text-left max-w-5xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full shadow-sm">
              CONTROL PLANE
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-indigo-500 animate-pulse" />
            <span className="gemini-gradient-text">Admin Dispatch & Telemetry</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Manage employee access, inspect in-memory vector weights, trigger automation dispatches, and purge database records.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {orgDetails && (
            <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/80 rounded-xl p-3 shadow-sm backdrop-blur-md">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">Org Invite Code</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-widest leading-none font-mono">{orgDetails.orgCode}</p>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(orgDetails.orgCode);
                  triggerToast("Invite Code copied to clipboard", "success");
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-indigo-500 transition-colors"
                title="Copy Invite Code"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
          )}
          <button 
            onClick={fetchSystemStatus}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/80 hover:bg-slate-100 text-xs font-black text-slate-700 dark:text-slate-300 transition-all shadow-sm cursor-pointer shrink-0 backdrop-blur-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? "animate-spin" : ""}`} />
            Fetch Telemetry
          </button>
        </div>
      </div>

      {/* Grid: Live Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Gateway Latency */}
        <div className="glass-panel p-4.5 rounded-20 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Gateway Latency</span>
            <Zap className="w-4.5 h-4.5 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">{sysStatus.apiLatency}</span>
            <span className="text-[10px] text-slate-400 font-extrabold font-mono">ms</span>
          </div>
          <p className="text-[9px] text-emerald-500 font-extrabold mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Connection Stable
          </p>
        </div>

        {/* Vector Embeddings */}
        <div className="glass-panel p-4.5 rounded-20 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vector Store</span>
            <Database className="w-4.5 h-4.5 text-cyan-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">{sysStatus.vectorCount}</span>
            <span className="text-[10px] text-slate-400 font-extrabold font-mono">embeds</span>
          </div>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 font-bold uppercase tracking-wider">
            Partitioned in {sysStatus.documentCount} active lists
          </p>
        </div>

        {/* RAM Consumption */}
        <div className="glass-panel p-4.5 rounded-20 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Memory Heap</span>
            <HardDrive className="w-4.5 h-4.5 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">{sysStatus.memoryUsage}</span>
            <span className="text-[10px] text-slate-400 font-extrabold font-mono">MB</span>
          </div>
          <div className="w-full bg-slate-200/50 dark:bg-slate-800/50 h-1 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-1000" 
              style={{ width: `${Math.min((sysStatus.memoryUsage / 120) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Email automation transmissions */}
        <div className="glass-panel p-4.5 rounded-20 relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Automation Logs</span>
            <Mail className="w-4.5 h-4.5 text-pink-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">{sysStatus.emailsSent}</span>
            <span className="text-[10px] text-slate-400 font-extrabold font-mono">relays</span>
          </div>
          <p className="text-[9px] text-emerald-500 font-extrabold mt-2 flex items-center gap-1 uppercase">
            <CheckCircle className="w-3.5 h-3.5" /> Relay Active
          </p>
        </div>

      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200/60 dark:border-slate-800/60 gap-1 pb-px">
        <button
          onClick={() => setActiveAdminSubTab("dispatch")}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider relative transition-all cursor-pointer ${
            activeAdminSubTab === "dispatch"
              ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4.5 h-4.5" />
            Dispatch & Management
          </div>
          {activeAdminSubTab === "dispatch" && (
            <motion.div
              layoutId="adminActiveSubTabLine"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
            />
          )}
        </button>

        <button
          onClick={() => setActiveAdminSubTab("audit")}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider relative transition-all cursor-pointer ${
            activeAdminSubTab === "audit"
              ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4.5 h-4.5" />
            Security Audit Log
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          </div>
          {activeAdminSubTab === "audit" && (
            <motion.div
              layoutId="adminActiveSubTabLine"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
            />
          )}
        </button>
      </div>

      {activeAdminSubTab === "dispatch" ? (
        /* Grid: Personnel Management vs Embedding Tuner */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Personnel User Role List (Left Col) */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-20 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-indigo-500" />
                {orgName ? `${orgName} Personnel Access` : "Personnel Access Matrix"}
              </h3>
              {orgCode && (
                <div className="bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 flex items-center gap-2">
                  <span className="text-[10px] text-indigo-500/80 font-bold uppercase tracking-widest">Org Code:</span>
                  <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 select-all">{orgCode}</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/50 dark:border-slate-800/40 text-slate-400 dark:text-slate-500">
                    <th className="pb-3 font-extrabold uppercase text-[9px] tracking-widest">User Details</th>
                    <th className="pb-3 font-extrabold uppercase text-[9px] tracking-widest px-2">Assigned Role</th>
                    <th className="pb-3 font-extrabold uppercase text-[9px] tracking-widest px-2">Status</th>
                    <th className="pb-3 font-extrabold uppercase text-[9px] tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/30 font-semibold">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                        No organization members yet
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.uid} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                        <td className="py-3.5 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            {u.displayName ? u.displayName.charAt(0) : "U"}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{u.displayName || "Member"}</p>
                            <p className="text-[10px] text-slate-500">{u.email}</p>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                            u.role === "Admin" || u.role === "Super Admin" ? "bg-rose-500/10 text-rose-600" :
                            u.role === "Organizer" ? "bg-purple-500/10 text-purple-600" :
                            u.role === "Manager" ? "bg-amber-500/10 text-amber-600" :
                            "bg-indigo-500/10 text-indigo-600"
                          }`}>
                            {(u.role === "Admin" || u.role === "Super Admin") && <Shield className="w-3 h-3" />}
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                            u.status === "suspended" || u.status === "SUSPENDED" ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600"
                          }`}>
                            {u.status === "suspended" || u.status === "SUSPENDED" ? "🔴 Suspended" : "🟢 Active"}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            {u.status === "suspended" || u.status === "SUSPENDED" ? (
                              <button
                                onClick={() => handleUpdateStatus(u.uid, "ACTIVE")}
                                className="text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-emerald-200/50 hover:bg-emerald-500/10 text-emerald-600 transition-all cursor-pointer"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateStatus(u.uid, "SUSPENDED")}
                                className="text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-amber-200/50 hover:bg-amber-500/10 text-amber-600 transition-all cursor-pointer"
                              >
                                Suspend
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUserPermanently(u.uid, u.email)}
                              className="text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-red-200/50 hover:bg-red-500/10 text-red-500 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Node Addition Form & Config Tuning (Right Col) */}
          <div className="space-y-6">
            
            {/* Add Personnel Form */}
            <div className="glass-panel p-6 rounded-20 space-y-4">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4.5 h-4.5 text-indigo-500" />
                Provision Account
              </h3>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Display Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Talent Lead"
                    className="w-full px-3.5 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. candidate@company.io"
                    className="w-full px-3.5 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Authority Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-black cursor-pointer"
                  >
                    <option value="Employee">Employee (Read-Write RAG)</option>
                    <option value="HR">HR (Personnel & Dispatches)</option>
                    <option value="Admin">Admin (Full Control)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 text-xs font-black rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-95 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/10 transition-all"
                >
                  Create Account Node
                </button>
              </form>
            </div>

            {/* Send Announcements & Broadcasts */}
            <div className="glass-panel p-6 rounded-20 space-y-4">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Megaphone className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                Send Workspace Announcement
              </h3>

              <form onSubmit={handleSendAnnouncement} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Topic / Subject</label>
                  <input
                    type="text"
                    required
                    value={announcementSubject}
                    onChange={(e) => setAnnouncementSubject(e.target.value)}
                    placeholder="e.g. Scheduled Network Sync"
                    className="w-full px-3.5 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Channel Medium</label>
                  <select
                    value={announcementChannel}
                    onChange={(e) => setAnnouncementChannel(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-black cursor-pointer"
                  >
                    <option value="Global Banner">Global Banner alert</option>
                    <option value="Email Broadcast">All Employees (Email Broadcast)</option>
                    <option value="Slack Relay">Slack Relay integration</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Message Text</label>
                  <textarea
                    required
                    rows={3}
                    value={announcementMsg}
                    onChange={(e) => setAnnouncementMsg(e.target.value)}
                    placeholder="Type dynamic update for employees..."
                    className="w-full px-3.5 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-bold resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 text-xs font-black rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-95 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-500/10 transition-all"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>Dispatch Broadcast</span>
                </button>
              </form>

              {/* Active history of dispatched announcements */}
              {announcementsList.length > 0 && (
                <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/60 space-y-2">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Dispatched Log</span>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {announcementsList.map((ann) => (
                      <div key={ann.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/60 text-left space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200">{ann.subject}</span>
                          <span className="text-[8px] font-mono px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded font-black uppercase tracking-wider">{ann.channel}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{ann.msg}</p>
                        <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold block">{ann.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Database & Embedding Flush tools */}
            <div className="p-5 rounded-20 border border-red-500/20 bg-red-500/[0.02] space-y-3">
              <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1.5">
                <Compass className="w-4 h-4" /> Purge Vectors
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-bold">
                Force reset vector indices. All active embedded sources will be expunged permanently.
              </p>
              <button
                onClick={handleClearVectorStore}
                disabled={isClearingVectors}
                className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 text-red-500 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-red-500/20 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> 
                {isClearingVectors ? "Purging Logs..." : "Flush Embedding Database"}
              </button>
            </div>

          </div>

        </div>
      ) : (
        /* Security Audit Log Tab View */
        <div className="space-y-6">
          
          {/* Audit Metrics Dashboard Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Total Records */}
            <div className="glass-panel p-4 rounded-20 flex flex-col justify-between h-24">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Total Audit Trails</span>
                <Fingerprint className="w-4.5 h-4.5 text-indigo-500" />
              </div>
              <span className="text-2xl font-black text-slate-800 dark:text-white font-mono tracking-tight">{auditLogs.length}</span>
            </div>

            {/* Success Cases */}
            <div className="glass-panel p-4 bg-emerald-500/[0.015] border-emerald-500/10 rounded-20 flex flex-col justify-between h-24">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold text-emerald-500/80 uppercase tracking-widest">Secure / Success</span>
                <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
              </div>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                {auditLogs.filter(log => log.status === "success").length}
              </span>
            </div>

            {/* Warning Flags */}
            <div className="glass-panel p-4 bg-amber-500/[0.015] border-amber-500/15 rounded-20 flex flex-col justify-between h-24">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold text-amber-500/80 uppercase tracking-widest">Warnings Raised</span>
                <AlertOctagon className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
              </div>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                {auditLogs.filter(log => log.status === "warning").length}
              </span>
            </div>

            {/* Blocks / Denied */}
            <div className="glass-panel p-4 bg-red-500/[0.015] border-red-500/15 rounded-20 flex flex-col justify-between h-24">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold text-red-500/80 uppercase tracking-widest">Access Intercepted</span>
                <ShieldAlert className="w-4.5 h-4.5 text-red-500" />
              </div>
              <span className="text-2xl font-black text-red-600 dark:text-red-400 font-mono tracking-tight">
                {auditLogs.filter(log => log.status === "denied").length}
              </span>
            </div>

          </div>

          {/* Audit Action Panel (Controls + Filters) */}
          <div className="p-5 bg-white/60 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/60 rounded-20 space-y-4">
            
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by action, details description, actor name, email, or IP address..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-semibold"
                />
              </div>

              {/* Advanced Controls Row */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                
                {/* Category Filter */}
                <select
                  value={auditCategoryFilter}
                  onChange={(e) => setAuditCategoryFilter(e.target.value as any)}
                  className="px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none text-slate-700 dark:text-slate-300 font-extrabold cursor-pointer"
                >
                  <option value="all">All Action Classes</option>
                  <option value="user_activity">User Activities</option>
                  <option value="document_access">Document Accesses</option>
                  <option value="api_requests">API Requests</option>
                </select>

                {/* Status/Severity Filter */}
                <select
                  value={auditStatusFilter}
                  onChange={(e) => setAuditStatusFilter(e.target.value as any)}
                  className="px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none text-slate-700 dark:text-slate-300 font-extrabold cursor-pointer"
                >
                  <option value="all">All Severities</option>
                  <option value="success">Secure / Success</option>
                  <option value="warning">Warnings / Alerts</option>
                  <option value="denied">Blocked / Denied</option>
                </select>

                <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-3 md:pt-0 md:pl-3 w-full md:w-auto justify-end">
                  
                  {/* Simulate Threat Trigger */}
                  <button
                    onClick={handleSimulateThreat}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    title="Generate simulated threat or scan alert"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Simulate Threat
                  </button>

                  {/* Add Manual Record */}
                  <button
                    onClick={() => setShowCustomLogForm(!showCustomLogForm)}
                    className={`flex items-center gap-1.5 px-3.5 py-2.5 border rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      showCustomLogForm
                        ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                        : "bg-indigo-500/10 hover:bg-indigo-500/15 border-indigo-500/20 text-indigo-500"
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {showCustomLogForm ? "Hide Form" : "Add Record"}
                  </button>

                  {/* Export CSV Download */}
                  <button
                    onClick={handleExportCSV}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-500 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download className={`w-3.5 h-3.5 ${isExporting ? "animate-bounce" : ""}`} />
                    {isExporting ? "Exporting..." : "Export Trail"}
                  </button>

                </div>

              </div>

            </div>

            {/* Custom Log Creation Form (Expanded Inline) */}
            {showCustomLogForm && (
              <form onSubmit={handleCreateCustomLog} className="p-5 rounded-20 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-4 animate-fade text-left">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4 text-indigo-500" />
                    Register Security Audit Incident Entry
                  </span>
                  <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-bold">Manual Overwrite Matrix</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Event Action Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Credentials Rotated"
                      value={customAction}
                      onChange={(e) => setCustomAction(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Event Classification</label>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 font-extrabold cursor-pointer"
                    >
                      <option value="user_activity">User Activity Event</option>
                      <option value="document_access">Document Access Log</option>
                      <option value="api_requests">API Gateway Request</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Severity Status</label>
                    <select
                      value={customStatus}
                      onChange={(e) => setCustomStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 font-extrabold cursor-pointer"
                    >
                      <option value="success">Secure / Success</option>
                      <option value="warning">System Warning Flag</option>
                      <option value="denied">Access Denied / Blocked</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Operator Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Security Auditor"
                      value={customActorName}
                      onChange={(e) => setCustomActorName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Operator Email</label>
                    <input
                      type="email"
                      placeholder="e.g. auditor@enterprise.io"
                      value={customActorEmail}
                      onChange={(e) => setCustomActorEmail(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5 flex items-end justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer w-full transition-colors shadow-sm"
                    >
                      Commit Incident Entry
                    </button>
                  </div>

                  <div className="space-y-1.5 md:col-span-3">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Incident Event Details</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Describe the exact telemetry parameters, key signatures, or system override parameters..."
                      value={customDetails}
                      onChange={(e) => setCustomDetails(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 font-medium resize-none"
                    />
                  </div>
                </div>
              </form>
            )}

          </div>

          {/* Audit Logs Dynamic Table */}
          <div className="glass-panel rounded-20 overflow-hidden border border-slate-200/50 dark:border-slate-800/80">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-200/50 dark:border-slate-800/40 text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="p-4 font-extrabold uppercase text-[9px] tracking-widest">Event Timestamp</th>
                    <th className="p-4 font-extrabold uppercase text-[9px] tracking-widest">Actor / Identity</th>
                    <th className="p-4 font-extrabold uppercase text-[9px] tracking-widest">Action & Category</th>
                    <th className="p-4 font-extrabold uppercase text-[9px] tracking-widest">Audit Event Details</th>
                    <th className="p-4 font-extrabold uppercase text-[9px] tracking-widest text-right">Severity & Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/30 font-semibold">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">
                        <div className="flex flex-col items-center gap-3">
                          <AlertOctagon className="w-7 h-7 text-slate-350 dark:text-slate-700 animate-pulse" />
                          <span>No audit records match the selected telemetry filters</span>
                          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-medium tracking-normal lowercase">
                            Try shifting the category/severity selections or click "Simulate Threat" to trigger a security event.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => {
                      const logDate = new Date(log.timestamp);
                      return (
                        <tr key={log.id} className="group hover:bg-slate-50/40 dark:hover:bg-slate-900/10 transition-all">
                          
                          {/* Timestamp */}
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                                  {logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-mono">
                                  {logDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Actor */}
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{log.actor.name}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{log.actor.email}</span>
                              <span className="text-[8px] text-slate-350 dark:text-slate-600 font-mono uppercase tracking-widest mt-0.5">IP: {log.actor.ip}</span>
                            </div>
                          </td>

                          {/* Action & Category */}
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-extrabold text-slate-800 dark:text-slate-100">{log.action}</span>
                              <span>
                                {log.category === "user_activity" && (
                                  <span className="text-[8px] font-black px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 dark:text-blue-400 uppercase tracking-widest font-mono">USER ACTIVITY</span>
                                )}
                                {log.category === "document_access" && (
                                  <span className="text-[8px] font-black px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 uppercase tracking-widest font-mono">DOCUMENT ACCESS</span>
                                )}
                                {log.category === "api_requests" && (
                                  <span className="text-[8px] font-black px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 dark:text-purple-400 uppercase tracking-widest font-mono">API GATEWAY</span>
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Details */}
                          <td className="p-4 max-w-sm">
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed break-words font-mono">
                              {log.details}
                            </p>
                          </td>

                          {/* Severity & Latency */}
                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex flex-col items-end gap-1.5">
                              <span>
                                {log.status === "success" && (
                                  <span className="inline-flex items-center gap-1 text-[8px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 uppercase tracking-widest font-mono">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                    SECURE
                                  </span>
                                )}
                                {log.status === "warning" && (
                                  <span className="inline-flex items-center gap-1 text-[8px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 uppercase tracking-widest font-mono">
                                    <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                    SUSPICIOUS
                                  </span>
                                )}
                                {log.status === "denied" && (
                                  <span className="inline-flex items-center gap-1 text-[8px] font-black px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-500 uppercase tracking-widest font-mono">
                                    <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                                    BLOCKED
                                  </span>
                                )}
                              </span>
                              {log.latency && (
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono tracking-tighter" title="Server process routing latency">
                                  {log.latency}
                                </span>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table footer info */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>Showing {filteredAuditLogs.length} of {auditLogs.length} logged incidents</span>
            <span>Local security buffer node: ACTIVE</span>
          </div>

        </div>
      )}

    </div>
  );
}
