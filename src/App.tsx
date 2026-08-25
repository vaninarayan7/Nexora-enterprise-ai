import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Menu, 
  X, 
  Cpu,
  User,
  Mail,
  Shield,
  Lock,
  LogOut,
  Chrome,
  Bell,
  BellRing,
  Keyboard,
  Activity
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import ChatWorkspace from "./components/ChatWorkspace";
import Dashboard from "./components/Dashboard";
import KnowledgeBase from "./components/KnowledgeBase";
import Analytics from "./components/Analytics";
import SettingsTab from "./components/SettingsTab";
import EmailAutomation from "./components/EmailAutomation";
import EmailAssistant from "./components/EmailAssistant";
import AdminPanel from "./components/AdminPanel";
import PromptLibrary from "./components/PromptLibrary";
import CommandPalette from "./components/CommandPalette";
import LandingPage from "./components/LandingPage";
import TaskWorkspace from "./components/TaskWorkspace";
import MeetingAssistant from "./components/MeetingAssistant";
import ArchitectureCenter from "./components/ArchitectureCenter";
import WelcomeScreen from "./components/WelcomeScreen";
import AuthCallback from "./components/AuthCallback";
import SuperAdminDashboard from "./components/dashboards/SuperAdminDashboard";
import OrganizerDashboard from "./components/dashboards/OrganizerDashboard";
import ManagerDashboard from "./components/dashboards/ManagerDashboard";
import EmployeeDashboard from "./components/dashboards/EmployeeDashboard";
import { ChatSession, KnowledgeDoc, WorkspaceSettings, Message, UserProfile, PromptTemplate, SmartNotification, WorkspacePersona } from "./types";
import { WORKSPACE_PERSONAS } from "./components/personas";
import { initAuth, googleSignIn, logout, handleRedirectResult } from "./lib/firebaseAuth";
import {
  getDocuments,
  saveDocument,
  deleteDocumentDb,
  getNotifications,
  saveNotification,
  saveConversation,
  getConversations,
  saveChatMessage,
  getChatMessages,
  saveUserProfile,
  updateUserRole,
  getOrganization, 
  getAllUserProfiles, 
  DbOrganization, 
  DbUserProfile, 
  updateUserStatus, 
  saveAuditLog
} from "./lib/firebaseDb";
import { auth } from "./lib/firebase";
import { UserRole } from "./types";
import { getDashboardRouteForRole } from "./lib/roleHelper";
import AccessDenied from "./components/AccessDenied";
import { THEMES } from "./lib/theme";
import { INITIAL_PROMPT_TEMPLATES } from "./components/promptSeeds";



// Sample Initial Workspace state
const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: "session-1",
    title: "Strategic SaaS Position Analysis",
    createdAt: new Date().toISOString(),
    messages: [
      { 
        id: "m1", 
        role: "user", 
        content: "Can you analyze our SaaS unit economics based on our standard benchmarks and suggest how to optimize our retention loops?", 
        timestamp: new Date(Date.now() - 3600000).toISOString() 
      },
      { 
        id: "m2", 
        role: "assistant", 
        content: "Based on our active benchmarks in the Knowledge Base (e.g., `saas_retention_metrics.txt`), our average churn rate is sitting at **3.2% monthly**, while our target target is **<1.5%**.\n\nTo bridge this gap, I recommend targeting the following vectors immediately:\n\n1. **High-Value onboarding triggers**: Since users who configure reports in the first 48 hours exhibit a **75% lower churn rate**, we should build structured product-led guides guiding new users to index documents and view metrics instantly.\n2. **Expansion pricing**: Leverage the **+18% expansion growth** from Q1 by implementing usage-based billing boundaries.\n\nWould you like to compose a customized strategic draft for your marketing or development teams?", 
        timestamp: new Date(Date.now() - 3500000).toISOString(),
        modelUsed: "gemini-3.6-flash",
        citations: []
      }
    ]
  }
];

const INITIAL_DOCS: KnowledgeDoc[] = [
  {
    id: "doc-1",
    name: "saas_retention_metrics.txt",
    size: "1.2 KB",
    type: "text/plain",
    content: "Nexora Workspace retention KPIs:\n- Average churn rate: 3.2% monthly\n- Target churn rate: <1.5% monthly\n- Expansion revenue vector: +18% growth Q1\n- High retention cohorts: Users who index/run system analyses within 48 hours of onboarding (churn is 75% lower for this segment).\n- Customer Acquisition Cost (CAC): $240 average\n- Customer Lifetime Value (LTV): $1,450 average\n- LTV-to-CAC Ratio: 6:1 (Strong system unit economics)",
    addedAt: new Date(Date.now() - 7200000).toISOString(),
    status: "indexed"
  },
  {
    id: "doc-2",
    name: "nexora_workspace_handbook.md",
    size: "0.8 KB",
    type: "text/markdown",
    content: "# Nexora AI Workspace handbook\n1. Respect user data privacy at all times. All parsing occurs strictly within secure cloud environments.\n2. Leverage detailed structured Markdown formatting (tables, lists, and code blocks).\n3. Keep system responses professional, strategic, concise, and focused on user intent.\n4. When referencing attached knowledge documents, always cite the file name clearly.",
    addedAt: new Date(Date.now() - 3600000).toISOString(),
    status: "indexed"
  }
];

interface AppLayoutProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  activeTab: "landing" | "dashboard" | "chat" | "docs" | "tasks" | "meetings" | "analytics" | "email" | "prompts" | "admin" | "settings" | "architecture";
  onChangeTab: (tab: any) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  user: UserProfile | null;
  onLogin: () => void;
  onLogout: () => void;
  activeThemeId: string;
  onChangeTheme: (themeId: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  showNotificationsDropdown: boolean;
  setShowNotificationsDropdown: (open: boolean) => void;
  notifications: SmartNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<SmartNotification[]>>;
  triggerToast: (msg: string, type?: "success" | "error" | "info") => void;
  settings: WorkspaceSettings;
  setShowCommandPalette: (open: boolean) => void;
  activePersona: WorkspacePersona;
  onChangeRole?: (role: UserRole) => void;
}

function AppLayout({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  activeTab,
  onChangeTab,
  isDarkMode,
  onToggleDarkMode,
  user,
  onLogin,
  onLogout,
  activeThemeId,
  onChangeTheme,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  showNotificationsDropdown,
  setShowNotificationsDropdown,
  notifications,
  setNotifications,
  triggerToast,
  settings,
  setShowCommandPalette,
  activePersona,
  onChangeRole
}: AppLayoutProps) {
  return (
    <>
      {/* Desktop Navigation Sidebar */}
      <div className="hidden md:block h-full shrink-0">
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={onSelectSession}
          onCreateSession={onCreateSession}
          onDeleteSession={onDeleteSession}
          activeTab={activeTab}
          onChangeTab={onChangeTab}
          isDarkMode={isDarkMode}
          onToggleDarkMode={onToggleDarkMode}
          user={user}
          onLogin={onLogin}
          onLogout={onLogout}
          activeThemeId={activeThemeId}
          onChangeTheme={onChangeTheme}
          onChangeRole={onChangeRole}
        />
      </div>

      {/* Mobile Drawer Overlay and trigger */}
      <div className="md:hidden">
        <div className="absolute top-4 left-4 z-40">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </button>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Overlay backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black z-30"
              />
              {/* Drawer Container */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-[#111318] z-40 flex shadow-2xl"
              >
                <div className="flex-1 flex flex-col animate-fade" onClick={() => setIsMobileMenuOpen(false)}>
                  <Sidebar
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    onSelectSession={onSelectSession}
                    onCreateSession={onCreateSession}
                    onDeleteSession={onDeleteSession}
                    activeTab={activeTab}
                    onChangeTab={onChangeTab}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={onToggleDarkMode}
                    user={user}
                    onLogin={onLogin}
                    onLogout={onLogout}
                    activeThemeId={activeThemeId}
                    onChangeTheme={onChangeTheme}
                    onChangeRole={onChangeRole}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Active core system views */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        
        {/* Global Nexora Header Bar */}
        <div className="h-14 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/25 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-3">
            {/* Left margin spacing on mobile to make room for absolute menu trigger button */}
            <div className="md:hidden w-8" />
            <div className="text-left">
              <h2 className="text-xs font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                {activeTab === "landing" && "Nexora AI Workspace Showcase"}
                {activeTab === "dashboard" && "Nexora Enterprise Dashboard"}
                {activeTab === "chat" && "Workspace Chat"}
                {activeTab === "docs" && "Knowledge Base & Grounding"}
                {activeTab === "tasks" && "Collaborative Team Space"}
                {activeTab === "meetings" && "Audio Minutes & Voice Assistant"}
                {activeTab === "analytics" && "Workspace Analytics"}
                {activeTab === "email" && "Email Assistant"}
                {activeTab === "admin" && "Admin Control Center"}
                {activeTab === "prompts" && "AI Prompt Library"}
                {activeTab === "architecture" && "System Architecture Workspace"}
                {activeTab === "settings" && "System Config & Engines"}
              </h2>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest hidden sm:block truncate max-w-[250px] sm:max-w-[400px]">
                {activeTab === "chat" ? activePersona.description : "Nexora Enterprise Node - Real-time Processing"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Ctrl+K Search Pill */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 bg-slate-100/40 dark:bg-slate-950/20 rounded-xl border border-slate-200/40 dark:border-slate-800/40 cursor-pointer transition-all"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Ctrl + K</span>
            </button>

            {/* Model Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/40 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800/40 rounded-xl text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 font-mono tracking-wider">
              <Activity className="w-3.5 h-3.5" />
              <span>{settings.modelName}</span>
            </div>

            {/* Notification Bell Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="p-2 text-slate-500 hover:text-indigo-500 rounded-xl bg-slate-100/40 dark:bg-slate-950/20 border border-slate-200/20 dark:border-slate-800/20 relative cursor-pointer transition-all hover:scale-105"
              >
                {notifications.filter(n => !n.isRead).length > 0 ? (
                  <BellRing className="w-4 h-4 text-indigo-500 animate-pulse" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full" />
                )}
              </button>

              {/* Notification Dropdown Portal List */}
              <AnimatePresence>
                {showNotificationsDropdown && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowNotificationsDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2.5 w-80 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-xl z-40 overflow-hidden text-left"
                    >
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider">
                          Smart Alerts ({notifications.filter(n => !n.isRead).length})
                        </span>
                        {notifications.length > 0 && (
                          <button
                            onClick={() => {
                              setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                              triggerToast("All alerts marked as read.", "success");
                            }}
                            className="text-[9px] font-black text-indigo-500 uppercase tracking-wider hover:underline cursor-pointer"
                          >
                            Read All
                          </button>
                        )}
                      </div>

                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40">
                        {notifications.length > 0 ? (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, isRead: true } : notif));
                              }}
                              className={`p-3.5 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850/40 flex items-start gap-3 relative ${
                                !n.isRead ? "bg-indigo-500/[0.01]" : ""
                              }`}
                            >
                              {!n.isRead && (
                                <span className="absolute top-4 left-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                              )}
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                n.type === "success" 
                                  ? "bg-emerald-500" 
                                  : n.type === "alert" 
                                    ? "bg-amber-500" 
                                    : "bg-blue-500"
                              }`} />
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 block truncate">
                                  {n.title}
                                </span>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal font-bold uppercase tracking-wider mt-0.5">
                                  {n.message}
                                </p>
                                <span className="text-[8px] font-mono text-slate-400 dark:text-slate-600 block mt-1 uppercase">
                                  {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-10 text-center opacity-65 flex flex-col items-center justify-center">
                            <Bell className="w-6 h-6 text-slate-300 dark:text-slate-700 mb-1.5" />
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Active Alerts</span>
                          </div>
                        )}
                      </div>

                      {notifications.length > 0 && (
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/60 flex justify-center">
                          <button
                            onClick={() => {
                              setNotifications([]);
                              triggerToast("Cleared alert logs history.", "info");
                            }}
                            className="text-[9px] font-black text-red-500 hover:text-red-600 uppercase tracking-widest"
                          >
                            Wipe Alert History Log
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Outlet />
        </div>

        {/* Persistent Footer */}
        <footer className="h-10 border-t border-slate-200/40 dark:border-slate-850/40 bg-white/20 dark:bg-slate-900/10 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 z-10">
          <div>Nexora Enterprise Node • Online</div>
          <div>© 2026 Nexora AI Inc. • Secured Sandbox</div>
        </footer>
      </div>
    </>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = (): any => {
    const path = location.pathname;
    if (path === "/super-admin") return "super-admin";
    if (path === "/organizer") return "organizer";
    if (path === "/manager") return "manager";
    if (path === "/employee") return "employee";
    if (path === "/dashboard") return "dashboard";
    if (path === "/chat") return "chat";
    if (path === "/docs") return "docs";
    if (path === "/tasks") return "tasks";
    if (path === "/meetings") return "meetings";
    if (path === "/analytics") return "analytics";
    if (path === "/email") return "email";
    if (path === "/prompts") return "prompts";
    if (path === "/architecture") return "architecture";
    if (path === "/admin") return "admin";
    if (path === "/settings") return "settings";
    if (path === "/" || path === "/landing") return "landing";
    return "dashboard";
  };

  const activeTab = getActiveTab();

  const handleTabChange = (tabId: string) => {
    // Explicit conditional check and redirection logic for the 'Workspace' navigation button,
    // ensuring it redirects to '/dashboard' consistently.
    if (tabId === "workspace") {
      navigate("/dashboard");
      return;
    }

    if (tabId === "landing") {
      navigate("/");
    } else {
      navigate(`/${tabId}`);
    }
  };

  const setActiveTab = (tabId: any) => {
    handleTabChange(tabId);
  };
  const [sessions, setSessions] = useState<ChatSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>("session-1");
  const [docs, setDocs] = useState<KnowledgeDoc[]>(INITIAL_DOCS);
  
  // Workspace user profiles
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Prompt templates library state
  const [templates, setTemplates] = useState<PromptTemplate[]>(() => {
    const saved = localStorage.getItem("nexora_prompt_templates");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_PROMPT_TEMPLATES;
      }
    }
    return INITIAL_PROMPT_TEMPLATES;
  });

  const [chatDraft, setChatDraft] = useState("");

  const [settings, setSettings] = useState<WorkspaceSettings>({
    systemInstruction: WORKSPACE_PERSONAS[0].systemPrompt,
    modelName: "gemini-3.6-flash",
    temperature: 0.7,
    activePersonaId: "core",
    maxTokens: 4000,
    activeThemeId: "emerald",
    language: "en",
    enableSoundNotifications: true,
    enableEmailAlerts: true,
    enableWorkspaceAlerts: true
  });

  const [customPersonas, setCustomPersonas] = useState<WorkspacePersona[]>(() => {
    const saved = localStorage.getItem("nexora_custom_personas");
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  // Sync templates updates with LocalStorage
  useEffect(() => {
    localStorage.setItem("nexora_prompt_templates", JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem("nexora_custom_personas", JSON.stringify(customPersonas));
  }, [customPersonas]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  const [notifications, setNotifications] = useState<SmartNotification[]>([
    {
      id: "n-1",
      title: "Security Node Sync",
      message: "Nexora secure guest node synchronized successfully.",
      type: "success",
      timestamp: new Date().toISOString(),
      isRead: false
    },
    {
      id: "n-2",
      title: "Semantic Vector Store Pre-seed",
      message: "Pre-seeded documents parsed and fully indexed into the vector model.",
      type: "info",
      timestamp: new Date(Date.now() - 60000).toISOString(),
      isRead: false
    },
    {
      id: "n-3",
      title: "Factual Reliability Check Active",
      message: "Factual self-evaluation shield armed and auditing live prompts.",
      type: "alert",
      timestamp: new Date(Date.now() - 120000).toISOString(),
      isRead: true
    }
  ]);
  
  // Custom interactive toasts state
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "info" | "error" }[]>([]);

  // Initialize Firebase session on startup
  useEffect(() => {
    // Step 1: Check for any pending redirect sign-in result FIRST.
    // This must happen before initAuth to avoid race conditions with signInWithPopup.
    handleRedirectResult().then(() => {
      // Step 2: Subscribe to auth state changes
      initAuth(
        (fbUser, token, profile) => {
          const userExists = !!profile;
          const onboardingCompleted = profile?.onboardingCompleted ?? userExists;
          const resolvedRole = profile?.role;
          const orgId = profile?.organizationId || "none";

          console.log("[AuthFlow] User authenticated:", fbUser.uid, fbUser.email);
          console.log("[AuthFlow] User exists:", userExists);
          console.log("[AuthFlow] onboardingCompleted:", onboardingCompleted);
          console.log("[AuthFlow] Firestore role:", resolvedRole || "MISSING");
          console.log("[AuthFlow] Organization ID:", orgId);

          if (!userExists || !resolvedRole) {
            console.log("[AuthFlow] User does NOT exist in Firestore or missing role.");
            
            // CRITICAL FIX: If we have a pending invite token, DO NOT redirect to welcome.
            // Let the AuthCallback or handleRedirectResult finish processing the invitation.
            const hasPendingInvite = !!sessionStorage.getItem("pending_invite_token");
            if (hasPendingInvite) {
              console.log("[AuthFlow] Pending invite token detected. Suspending redirect to allow invitation processing.");
              return;
            }

            setIsAuthLoading(false);
            if (location.pathname !== "/welcome" && location.pathname !== "/auth-callback" && location.pathname !== "/join") {
              console.log("[AuthFlow] Navigating to onboarding (/welcome).");
              navigate("/welcome");
            }
            return;
          }

          const targetRoute = getDashboardRouteForRole(resolvedRole);

          console.log("[AuthFlow] Redirect Target:", targetRoute);

          setUser({
            uid: fbUser.uid,
            email: fbUser.email || "",
            displayName: fbUser.displayName || "Enterprise Member",
            photoURL: fbUser.photoURL || undefined,
            role: resolvedRole,
            token,
            organizationId: profile.organizationId,
            organizationName: profile.organizationName,
            status: profile.status || "ACTIVE",
            onboardingCompleted: true
          });
          setIsAuthLoading(false);

          // On future logins: if onboardingCompleted is true, completely skip onboarding and redirect directly to role dashboard
          if (location.pathname === "/" || location.pathname === "/landing" || location.pathname === "/welcome" || location.pathname === "/auth-callback" || location.pathname === "/join") {
            navigate(targetRoute);
          }
        },
        () => {
          console.log("[AuthFlow] No authenticated user found.");
          setUser(null);
          setIsAuthLoading(false);
        }
      );
    });
  }, []);

  // Load user data from Firestore on mount/user change
  useEffect(() => {
    const loadUserData = async () => {
      if (user) {
        try {
          if (!user.organizationId) {
            console.warn("User has no organizationId. Skipping fetches.");
            setDocs(INITIAL_DOCS);
            setSessions(INITIAL_SESSIONS);
            return;
          }
          
          const dbDocs = await getDocuments(user.organizationId);
          if (dbDocs && dbDocs.length > 0) {
            setDocs(dbDocs.map(d => ({
              id: d.id,
              name: d.name,
              type: d.type,
              size: d.size,
              content: d.content,
              addedAt: d.createdAt,
              status: "indexed" as const,
              summary: d.summary
            })));
          }

          const dbNotifs = await getNotifications(user.uid, user.organizationId);
          if (dbNotifs && dbNotifs.length > 0) {
            setNotifications(dbNotifs.map(n => ({
              id: n.id,
              title: n.title,
              message: n.message,
              type: n.type,
              timestamp: n.timestamp,
              isRead: n.isRead
            })));
          }

          const dbConvs = await getConversations(user.uid, user.organizationId);
          if (dbConvs && dbConvs.length > 0) {
            const loadedSessions: ChatSession[] = [];
            for (const conv of dbConvs) {
              const msgs = await getChatMessages(conv.id);
              loadedSessions.push({
                id: conv.id,
                title: conv.title,
                createdAt: conv.createdAt,
                messages: msgs.map(m => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  timestamp: m.createdAt,
                  citations: []
                }))
              });
            }
            loadedSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setSessions(loadedSessions);
            if (loadedSessions.length > 0) {
              setActiveSessionId(loadedSessions[0].id);
            }
          } else {
            setSessions(INITIAL_SESSIONS);
          }
        } catch (err) {
          console.error("Failed loading data from Firestore:", err);
        }
      } else {
        setDocs(INITIAL_DOCS);
        setSessions(INITIAL_SESSIONS);
      }
    };
    loadUserData();
  }, [user]);

  // Sync index documents with express backend on mount
  useEffect(() => {
    // Proactively index initial docs in server-side vector DB so they are instantly searchable
    const indexInitialDocs = async () => {
      try {
        for (const doc of docs) {
          await fetch("/api/documents/index", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              docId: doc.id,
              name: doc.name,
              content: doc.content
            })
          });
        }
      } catch (err) {
        console.warn("Failed initializing server-side indices:", err);
      }
    };
    indexInitialDocs();
  }, []);

  // Toggle Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Ctrl+K Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Trigger brief alert toasts
  const triggerToast = (message: string, type: "success" | "info" | "error" = "success") => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const allPersonas = [...WORKSPACE_PERSONAS, ...customPersonas];
  const activePersona = allPersonas.find(p => p.id === settings.activePersonaId) || WORKSPACE_PERSONAS[0];

  // Google OAuth Login Trigger
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        console.group("[App] handleGoogleLogin: success");
        console.log("  uid  :", result.user.uid);
        console.log("  email:", result.user.email);
        console.log("  role :", result.role ?? "⚠️ MISSING");
        console.groupEnd();

        setShowLoginModal(false);
        setLoginError(null);
      } else {
        // null = popup was cancelled or blocked (redirect initiated)
        // Don't show an error — just silently close
        console.log("[App] Google sign-in returned null (popup cancelled or redirect initiated).");
      }
    } catch (err: any) {
      console.error("[App] Google sign-in error:", err);
      const msg = err.message || "Google Workspace authentication failed.";
      setLoginError(msg);
      triggerToast(msg, "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    triggerToast("Signed out of Google Workspace.", "info");
    navigate("/welcome");
  };

  // Update own role (for dev/testing via sidebar) — persists to Firestore
  const handleChangeRole = async (newRole: UserRole) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, role: newRole } : null);
    try {
      await saveUserProfile({ uid: user.uid, email: user.email, displayName: user.displayName, role: newRole, photoURL: user.photoURL });
      triggerToast(`Session role updated to: ${newRole}`, "success");
    } catch (err) {
      console.error("Error updating role in Firestore:", err);
      triggerToast("Role updated in session, but Firestore sync failed.", "info");
    }
  };

  // Admin action: change another user's role and write audit log to Firestore
  const handleAdminUpdateUserRole = async (targetUid: string, targetEmail: string, targetDisplayName: string, fromRole: string, toRole: UserRole) => {
    if (!user || (user.role !== "Super Admin" && user.role !== "Organizer")) return;
    try {
      await updateUserRole(targetUid, toRole);
      await saveAuditLog({
        id: `audit-${Date.now()}`,
        userId: user.uid,
        action: "Role Modification",
        details: `Changed role of user ${targetDisplayName} (${targetEmail}) from ${fromRole} to ${toRole}. Performed by Admin (${user.email}).`,
        timestamp: new Date().toISOString()
      });
      triggerToast(`${targetEmail} role updated to ${toRole}.`, "success");
    } catch (err) {
      console.error("Admin role update error:", err);
      triggerToast("Role update failed. Check Firestore permissions.", "error");
    }
  };

  // Create new session
  const handleCreateSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: "New Discussion",
      createdAt: new Date().toISOString(),
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setActiveTab("chat");
    triggerToast("Created new chat workspace.", "success");
  };

  // Delete session
  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) {
      triggerToast("Cannot delete the only remaining session.", "error");
      return;
    }
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveSessionId(remaining[0].id);
    }
    triggerToast("Archived chat session.", "info");
  };

  // Clear active session messages
  const handleClearSession = () => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: [] };
      }
      return s;
    }));
    triggerToast("Cleared discussion timeline.", "info");
  };

  // Add document to knowledge base with real-time vectoring
  const handleAddDoc = async (name: string, content: string) => {
    const normalizedContent = typeof content === "string" ? content : "";
    const docId = `doc-${Date.now()}`;
    const newDoc: KnowledgeDoc = {
      id: docId,
      name,
      size: `${(normalizedContent.length / 1024).toFixed(1)} KB`,
      type: name.split(".").pop() || "txt",
      content: normalizedContent,
      addedAt: new Date().toISOString(),
      status: "uploading"
    };

    setDocs(prev => [newDoc, ...prev]);

    try {
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: "indexing" } : d));

      const res = await fetch("/api/documents/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId,
          name,
          content: normalizedContent,
          fileType: (name.split(".").pop() || "txt").toLowerCase()
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data?.error || data?.message || "Failed to index vectors on server.";
        throw new Error(message);
      }

      setDocs(prev => prev.map(d => 
        d.id === docId 
          ? { ...d, status: "indexed" as const, chunksCount: Number(data.chunksCount || 0), errorMessage: undefined } 
          : d
      ));

      if (user) {
        try {
          await saveDocument({
            id: docId,
            name: newDoc.name,
            type: newDoc.type,
            size: newDoc.size,
            content: newDoc.content,
            uploadedBy: user.uid,
            createdAt: newDoc.addedAt,
            updatedAt: newDoc.addedAt,
            summary: data.summary || ""
          });
        } catch (fErr) {
          console.error("Firestore save document error:", fErr);
        }
      }

      triggerToast(`Document indexed: "${name}" (${data.chunksCount || 0} chunks)`, "success");
    } catch (err: any) {
      const message = err?.message || "Vector indexing failed.";
      console.error("[App] Document indexing failed:", message, err);
      setDocs(prev => prev.map(d => 
        d.id === docId 
          ? { ...d, status: "failed" as const, errorMessage: message } 
          : d
      ));

      const isDevMode = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const toastMessage = isDevMode ? `${message}` : `Vector indexing failed for "${name}".`;
      triggerToast(toastMessage, "error");
      throw err;
    }
  };

  // Remove document
  const handleDeleteDoc = async (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id));
    if (user) {
      try {
        await deleteDocumentDb(id);
      } catch (err) {
        console.error("Firestore delete document error:", err);
      }
    }
    triggerToast("Removed document from workspace grounding index.", "info");
  };

  const handleClearDocs = () => {
    setDocs([]);
    triggerToast("Cleared knowledge base cache.", "info");
  };

  // Send message and trigger real Server-Sent Events (SSE) streaming Gemini call
  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const targetSessionId = activeSessionId;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString()
    };

    // Prepare assistant message block placeholder
    const aiMsgId = `ai-${Date.now()}`;
    const assistantMsg: Message = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      modelUsed: settings.modelName,
      citations: []
    };

    const sessionExists = sessions.some(s => s.id === targetSessionId);

    // Update sessions to append user message and empty assistant message atomically
    let updatedSessions;
    const conversationTitle = sessionExists 
      ? (sessions.find(s => s.id === targetSessionId)?.title || content)
      : (content.length > 30 ? `${content.substring(0, 30)}...` : content);

    if (!sessionExists) {
      const newSession: ChatSession = {
        id: targetSessionId,
        title: conversationTitle,
        createdAt: new Date().toISOString(),
        messages: [userMsg, assistantMsg]
      };
      updatedSessions = [newSession, ...sessions];
    } else {
      updatedSessions = sessions.map(s => {
        if (s.id === targetSessionId) {
          const updatedMsgs = [...s.messages, userMsg, assistantMsg];
          const title = s.title === "New Discussion" && s.messages.length === 0
            ? conversationTitle
            : s.title;
          return { ...s, title, messages: updatedMsgs };
        }
        return s;
      });
    }

    setSessions(updatedSessions);
    setIsGenerating(true);

    if (user) {
      try {
        await saveConversation({
          id: targetSessionId,
          title: conversationTitle,
          userId: user.uid,
          personaId: settings.activePersonaId,
          modelName: settings.modelName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await saveChatMessage({
          id: userMsg.id,
          conversationId: targetSessionId,
          role: "user",
          content: userMsg.content,
          createdAt: userMsg.timestamp
        });
      } catch (err) {
        console.error("Firestore save conversation/userMsg error:", err);
      }
    }

    try {
      const currentSession = sessions.find(s => s.id === targetSessionId);
      const previousMessages = currentSession ? currentSession.messages : [];
      const chatHistory = [...previousMessages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      // Call streaming SSE endpoint
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory,
          systemInstruction: settings.systemInstruction,
          modelName: settings.modelName,
          temperature: settings.temperature,
          activeDocIds: docs.map(d => d.id),
          enableQueryExpansion: settings.enableQueryExpansion || false,
          enableGroundingEvaluation: settings.enableGroundingEvaluation || false,
          enablePromptCompression: settings.enablePromptCompression || false
        })
      });

      if (!response.ok) {
        throw new Error("Failed to initialize server streaming channel.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to read response stream.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const rawData = trimmed.substring(6);
          if (rawData === "[DONE]") continue;

          let parsed = null;
          try {
            parsed = JSON.parse(rawData);
          } catch (pErr) {
            console.warn("Failed parsing streaming event line:", pErr);
            continue;
          }
          
          if (parsed.type === "citations") {
            setSessions(prev => prev.map(s => {
              if (s.id === targetSessionId) {
                return {
                  ...s,
                  messages: s.messages.map(m => 
                    m.id === aiMsgId 
                      ? { 
                          ...m, 
                          citations: parsed.citations,
                          originalTokenCount: parsed.originalTokenCount,
                          compressedTokenCount: parsed.compressedTokenCount,
                          expandedQueries: parsed.expandedQueries
                        } 
                      : m
                  )
                };
              }
              return s;
            }));
          } else if (parsed.type === "text") {
            setSessions(prev => prev.map(s => {
              if (s.id === targetSessionId) {
                return {
                  ...s,
                  messages: s.messages.map(m => 
                    m.id === aiMsgId 
                      ? { ...m, content: m.content + parsed.text } 
                      : m
                  )
                };
              }
              return s;
            }));
          } else if (parsed.type === "evaluation") {
            setSessions(prev => prev.map(s => {
              if (s.id === targetSessionId) {
                return {
                  ...s,
                  messages: s.messages.map(m => 
                    m.id === aiMsgId 
                      ? { 
                          ...m, 
                          groundingScore: parsed.groundingScore,
                          relevanceScore: parsed.relevanceScore,
                          evaluationReport: parsed.evaluationReport,
                          expandedQueries: parsed.expandedQueries
                        } 
                      : m
                  )
                };
              }
              return s;
            }));
          } else if (parsed.type === "error") {
            throw new Error(parsed.error);
          }
        }
      }

      // Save successful AI message to Firestore
      if (user) {
        try {
          const latestSessions = await new Promise<ChatSession[]>(resolve => {
            setSessions(prev => {
              resolve(prev);
              return prev;
            });
          });
          const targetSession = latestSessions.find(s => s.id === targetSessionId);
          const finalAiMsg = targetSession?.messages.find(m => m.id === aiMsgId);
          if (finalAiMsg) {
            await saveChatMessage({
              id: aiMsgId,
              conversationId: targetSessionId,
              role: "assistant",
              content: finalAiMsg.content,
              createdAt: finalAiMsg.timestamp
            });
          }
        } catch (fErr) {
          console.error("Failed saving streamed assistant message to Firestore:", fErr);
        }
      }

    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "Streaming connection failed.", "error");

      const errorMessageText = `\n\n❌ **RAG Stream Error**\n${err.message || "Connection terminated abnormally."}`;

      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          return {
            ...s,
            messages: s.messages.map(m => 
              m.id === aiMsgId 
                ? { 
                    ...m, 
                    content: m.content + errorMessageText,
                    status: "error" as const 
                  } 
                : m
            )
          };
        }
        return s;
      }));

      // Save error AI message to Firestore
      if (user) {
        try {
          const latestSessions = await new Promise<ChatSession[]>(resolve => {
            setSessions(prev => {
              resolve(prev);
              return prev;
            });
          });
          const targetSession = latestSessions.find(s => s.id === targetSessionId);
          const finalAiMsg = targetSession?.messages.find(m => m.id === aiMsgId);
          if (finalAiMsg) {
            await saveChatMessage({
              id: aiMsgId,
              conversationId: targetSessionId,
              role: "assistant",
              content: finalAiMsg.content,
              createdAt: finalAiMsg.timestamp
            });
          }
        } catch (fErr) {
          console.error("Failed saving errored assistant message to Firestore:", fErr);
        }
      }

    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateSettings = (updated: Partial<WorkspaceSettings>) => {
    setSettings(prev => ({ ...prev, ...updated }));
    if (updated.activePersonaId) {
      triggerToast(`Switched active profile to ${WORKSPACE_PERSONAS.find(p => p.id === updated.activePersonaId)?.name}.`, "info");
    } else {
      triggerToast("Workspace configurations updated.", "success");
    }
  };

  const handleAddTemplate = (newTpl: Omit<PromptTemplate, "id">) => {
    const tpl: PromptTemplate = {
      ...newTpl,
      id: `prompt-${Date.now()}`
    };
    setTemplates(prev => [...prev, tpl]);
  };

  const handleUpdateTemplate = (id: string, updated: Partial<PromptTemplate>) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    triggerToast("Prompt template removed from library.", "info");
  };

  const handleInsertIntoChat = (promptText: string) => {
    setChatDraft(promptText);
    setActiveTab("chat");
    triggerToast("Prompt loaded into chat composer!", "success");
  };

  const handleTriggerPaidFlow = () => {
    triggerToast("Premium AI routing enabled across Nexora nodes.", "info");
  };

  const activeTheme = THEMES.find(t => t.id === settings.activeThemeId) || THEMES[0];

  const styleContent = `
    :root {
      --theme-primary: ${activeTheme.primary};
      --theme-primary-hover: ${activeTheme.primaryHover};
      --theme-secondary: ${activeTheme.secondary};
      --theme-gradient-from: ${activeTheme.gradientFrom};
      --theme-gradient-to: ${activeTheme.gradientTo};
      --theme-glow: ${activeTheme.glowColor};
    }
  `;

  const protectRoute = (element: React.ReactNode, requiredRoles: UserRole[]) => {
    // If the Firebase auth is signed in but our state profile is still syncing/loading,
    // treat it as loading to prevent routing them back to /welcome
    const isProfileSyncing = auth.currentUser && !user;
    
    console.log("[protectRoute DEBUG] Evaluating access:", {
      isAuthLoading,
      isProfileSyncing,
      "auth.currentUser.uid": auth.currentUser?.uid,
      "userState.uid": user?.uid,
      "userState.role": user?.role,
      requiredRoles
    });

    if (isAuthLoading || isProfileSyncing) {
      console.log("[protectRoute DEBUG] Auth loading or profile syncing in progress. Showing loading spinner...");
      return (
        <div className="flex items-center justify-center h-full w-full bg-slate-50 dark:bg-slate-950 min-h-screen">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs font-bold text-slate-500">Syncing role permissions...</p>
          </div>
        </div>
      );
    }

    if (!user) {
      console.log("[protectRoute DEBUG] No authenticated user profile. Redirecting to /welcome.");
      return <Navigate to="/welcome" replace />;
    }
    const currentRole = (user.role as UserRole) || "Employee";
    const isAllowed = requiredRoles.includes(currentRole) || currentRole === "Super Admin";

    console.log("Current Role =", currentRole);
    console.log("Allowed Roles =", requiredRoles.join(", "));
    console.log("Authorization Result =", isAllowed ? "ALLOWED" : "DENIED");

    if (isAllowed) {
      console.log("[protectRoute DEBUG] Access ALLOWED for role:", currentRole);
      return element;
    }

    console.log("[protectRoute DEBUG] Access DENIED. Rendering AccessDenied component.");
    return (
      <AccessDenied 
        onBackToDashboard={() => {
          navigate(getDashboardRouteForRole(currentRole));
        }}
        requiredRoles={requiredRoles}
        currentRole={currentRole}
      />
    );
  };

  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-tr from-[#EEF2FF] via-[#E0F2FE] to-[#FDF2F8] dark:from-[#0a0c16] dark:via-[#0c0d19] dark:to-[#170e1c] text-slate-800 dark:text-slate-100 font-sans">
        <style dangerouslySetInnerHTML={{ __html: styleContent }} />
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-pulse">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <svg className="w-7 h-7 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-slate-800 dark:text-white">Authenticating Workspace...</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Verifying enterprise role & organization permissions</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-tr from-[#EEF2FF] via-[#E0F2FE] to-[#FDF2F8] dark:from-[#0a0c16] dark:via-[#0c0d19] dark:to-[#170e1c] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />

      
      {/* Toast Alert stack overlay */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className={`p-3 rounded-xl border flex items-center gap-3 shadow-lg pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md ${
                t.type === "success" 
                  ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : t.type === "error"
                    ? "border-red-500/30 text-red-500"
                    : "border-blue-500/30 text-blue-500 dark:text-blue-400"
              }`}
            >
              {t.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span className="text-xs font-bold leading-normal">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Google Sign-In Glassmorphism Dialog Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowLoginModal(false); setLoginError(null); }}
              className="absolute inset-0 bg-slate-950"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="relative w-full max-w-md bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
              
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto mb-4">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>

              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1 tracking-tight">
                Connect Google Workspace
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6 leading-relaxed">
                Connect with Gmail access to build multi-document briefings, ground AI vectors, and send summary dispatches.
              </p>

              {/* Inline error display */}
              {loginError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-left">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed font-medium">{loginError}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  id="google-signin-btn"
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-slate-900 dark:bg-emerald-500 text-white hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-transparent shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Authenticating with Google...</span>
                    </>
                  ) : (
                    <>
                      <Chrome className="w-4 h-4" />
                      <span>Sign in with Google</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-5 leading-relaxed font-medium">
                Uses standard in-memory caches. Tokens are destroyed instantly upon closing session context.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Routes>
        <Route path="/welcome" element={
          user 
            ? <Navigate to={getDashboardRouteForRole(user.role)} replace /> 
            : <WelcomeScreen />
        } />
        <Route path="/auth-callback" element={
          <AuthCallback onLoginSuccess={(u) => { setUser(u); triggerToast(`Welcome, ${u.displayName}! 🎉`, "success"); }} />
        } />
        <Route path="/join" element={
          <AuthCallback onLoginSuccess={(u) => { setUser(u); triggerToast(`Welcome to workspace, ${u.displayName}! 🎉`, "success"); }} />
        } />
        <Route element={
          <AppLayout
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onCreateSession={handleCreateSession}
            onDeleteSession={handleDeleteSession}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            user={user}
            onLogin={() => setShowLoginModal(true)}
            onLogout={handleLogout}
            activeThemeId={settings.activeThemeId || "emerald"}
            onChangeTheme={(themeId) => handleUpdateSettings({ activeThemeId: themeId })}
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
            showNotificationsDropdown={showNotificationsDropdown}
            setShowNotificationsDropdown={setShowNotificationsDropdown}
            notifications={notifications}
            setNotifications={setNotifications}
            triggerToast={triggerToast}
            settings={settings}
            setShowCommandPalette={setShowCommandPalette}
            activePersona={activePersona}
            onChangeRole={handleChangeRole}
          />
        }>
          <Route path="/" element={
            user
              ? <Navigate to={getDashboardRouteForRole(user.role)} replace />
              : <Navigate to="/welcome" replace />
          } />

          <Route path="/super-admin" element={protectRoute(
            <motion.div key="super-admin" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} className="h-full animate-fade overflow-y-auto">
              <SuperAdminDashboard currentUser={user} triggerToast={triggerToast} />
            </motion.div>,
            ["Super Admin"]
          )} />

          <Route path="/organizer" element={protectRoute(
            <motion.div key="organizer" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} className="h-full animate-fade overflow-y-auto">
              <OrganizerDashboard currentUser={user} triggerToast={triggerToast} />
            </motion.div>,
            ["Organizer"]
          )} />

          <Route path="/manager" element={protectRoute(
            <motion.div key="manager" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} className="h-full animate-fade overflow-y-auto">
              <ManagerDashboard currentUser={user} triggerToast={triggerToast} />
            </motion.div>,
            ["Manager", "Organizer"]
          )} />

          <Route path="/employee" element={protectRoute(
            <motion.div key="employee" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} className="h-full animate-fade overflow-y-auto">
              <EmployeeDashboard currentUser={user} docs={docs} onSelectTab={setActiveTab} triggerToast={triggerToast} />
            </motion.div>,
            ["Employee", "Manager", "Organizer"]
          )} />

          <Route path="/dashboard" element={
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full animate-fade"
            >
              <Dashboard
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={setActiveSessionId}
                onCreateSession={handleCreateSession}
                docs={docs}
                activeTab={activeTab}
                onSelectTab={setActiveTab}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                isDarkMode={isDarkMode}
                onSendMessage={handleSendMessage}
                chatDraft={chatDraft}
                onSetChatDraft={setChatDraft}
                triggerToast={triggerToast}
                user={user}
              />
            </motion.div>
          } />

          <Route path="/chat" element={
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col overflow-hidden animate-fade"
            >
              <ChatWorkspace
                messages={activeSession?.messages || []}
                activePersona={activePersona}
                settings={settings}
                docs={docs}
                isGenerating={isGenerating}
                onSendMessage={handleSendMessage}
                onClearSession={handleClearSession}
                onAddDocFromChat={handleAddDoc}
                chatDraft={chatDraft}
                onClearDraft={() => setChatDraft("")}
                templates={templates}
              />
            </motion.div>
          } />

          <Route path="/docs" element={
            <motion.div
              key="docs"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col overflow-hidden animate-fade"
            >
              <KnowledgeBase
                docs={docs}
                onAddDoc={handleAddDoc}
                onDeleteDoc={handleDeleteDoc}
                onClearDocs={handleClearDocs}
              />
            </motion.div>
          } />

          <Route path="/tasks" element={
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col overflow-hidden animate-fade"
            >
              <TaskWorkspace docs={docs} user={user} />
            </motion.div>
          } />

          <Route path="/meetings" element={
            <motion.div
              key="meetings"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col overflow-hidden animate-fade"
            >
              <MeetingAssistant user={user} onLogin={() => setShowLoginModal(true)} triggerToast={triggerToast} onAddDoc={handleAddDoc} />
            </motion.div>
          } />

          <Route path="/landing" element={
            <motion.div key="landing" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} className="h-full animate-fade overflow-y-auto">
              <LandingPage onLoginSuccess={(profile) => setUser(profile)} triggerToast={triggerToast} isDarkMode={isDarkMode} onExploreWorkspace={() => {}} />
            </motion.div>
          } />

          <Route path="/analytics" element={protectRoute(
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col overflow-hidden animate-fade"
            >
              <Analytics
                messages={activeSession?.messages || []}
                docs={docs}
              />
            </motion.div>,
            ["Super Admin", "Organizer"]
          )} />

          <Route path="/email" element={protectRoute(
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col overflow-hidden animate-fade"
            >
              <EmailAssistant
                user={user}
                onLogin={() => setShowLoginModal(true)}
                docs={docs}
                triggerToast={triggerToast}
              />
            </motion.div>,
            ["Super Admin", "Organizer", "Manager", "Employee"]
          )} />

          <Route path="/prompts" element={protectRoute(
            <motion.div
              key="prompts"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col overflow-hidden animate-fade"
            >
              <PromptLibrary
                templates={templates}
                onAddTemplate={handleAddTemplate}
                onUpdateTemplate={handleUpdateTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                onUpdateSettings={handleUpdateSettings}
                onInsertIntoChat={handleInsertIntoChat}
                triggerToast={triggerToast}
              />
            </motion.div>,
            ["Super Admin", "Organizer"]
          )} />

          <Route path="/architecture" element={protectRoute(
            <motion.div
              key="architecture"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col overflow-hidden animate-fade"
            >
              <ArchitectureCenter />
            </motion.div>,
            ["Super Admin"]
          )} />

          <Route path="/admin" element={protectRoute(
            <motion.div
              key="admin"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col overflow-hidden animate-fade"
            >
              <AdminPanel
                currentUser={user}
                onUpdateUserRole={handleAdminUpdateUserRole}
                triggerToast={triggerToast}
              />
            </motion.div>,
            ["Admin"]
          )} />

          <Route path="/settings" element={
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col overflow-hidden animate-fade"
            >
              <SettingsTab
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onTriggerPaidFlow={handleTriggerPaidFlow}
                customPersonas={customPersonas}
                onAddCustomPersona={(newPersona) => setCustomPersonas(prev => [...prev, newPersona])}
              />
            </motion.div>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      <AnimatePresence>
        {showCommandPalette && (
          <CommandPalette
            isOpen={showCommandPalette}
            onClose={() => setShowCommandPalette(false)}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onAddNewSession={handleCreateSession}
            onClearActiveChat={handleClearSession}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
