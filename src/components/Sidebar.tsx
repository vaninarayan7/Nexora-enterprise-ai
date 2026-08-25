import { useState } from "react";
import { 
  MessageSquare, 
  BarChart3, 
  Settings, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  FolderOpen,
  Sun,
  Moon,
  Cpu,
  Mail,
  ShieldAlert,
  LogOut,
  User,
  BookOpen,
  Home,
  Globe,
  CheckSquare,
  Mic,
  Building2,
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatSession, UserProfile } from "../types";
import { THEMES } from "../lib/theme";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  activeTab: "landing" | "dashboard" | "chat" | "docs" | "tasks" | "meetings" | "analytics" | "email" | "prompts" | "admin" | "settings" | "architecture" | "super-admin" | "organizer" | "manager" | "employee";
  onChangeTab: (tab: any) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  user: UserProfile | null;
  onLogin: () => void;
  onLogout: () => void;
  activeThemeId: string;
  onChangeTheme: (themeId: string) => void;
  onChangeRole?: (newRole: "Super Admin" | "Organizer" | "Manager" | "Employee") => void;
}

export default function Sidebar({
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
  onChangeRole
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleWorkspaceBrandClick = () => {
    if (user?.role === "Super Admin") onChangeTab("super-admin");
    else if (user?.role === "Organizer") onChangeTab("organizer");
    else if (user?.role === "Manager") onChangeTab("manager");
    else onChangeTab("employee");
  };

  const allTabs = [
    { id: "super-admin", label: "Super Admin Hub", icon: ShieldAlert, roles: ["Super Admin"] },
    { id: "organizer", label: "Organizer Hub", icon: Building2, roles: ["Organizer"] },
    { id: "manager", label: "Manager Hub", icon: Users, roles: ["Manager"] },
    { id: "employee", label: "My Workspace", icon: User, roles: ["Employee"] },
    { id: "dashboard", label: "Home Dashboard", icon: Home, roles: ["Super Admin", "Admin", "Organizer", "Manager", "Employee"] },
    { id: "chat", label: "Workspace Chat", icon: MessageSquare, roles: ["Super Admin", "Admin", "Organizer", "Manager", "Employee"] },
    { id: "docs", label: "Knowledge Base", icon: FolderOpen, roles: ["Super Admin", "Admin", "Organizer", "Manager", "Employee"] },
    { id: "tasks", label: "Team Space (Kanban)", icon: CheckSquare, roles: ["Super Admin", "Admin", "Organizer", "Manager", "Employee"] },
    { id: "meetings", label: "Meeting Assistant", icon: Mic, roles: ["Super Admin", "Admin", "Organizer", "Manager", "Employee"] },
    { id: "analytics", label: "Usage Analytics", icon: BarChart3, roles: ["Super Admin", "Admin", "Organizer"] },
    { id: "email", label: "Email Automation", icon: Mail, roles: ["Super Admin", "Admin", "Organizer", "Manager", "Employee"] },
    { id: "prompts", label: "Prompt Library", icon: BookOpen, roles: ["Super Admin", "Admin", "Organizer"] },
    { id: "architecture", label: "System Architecture", icon: Cpu, roles: ["Super Admin", "Admin"] },
    { id: "admin", label: "Admin Panel", icon: ShieldAlert, roles: ["Super Admin", "Admin", "Organizer"] },
    { id: "settings", label: "Settings & AI Config", icon: Settings, roles: ["Super Admin", "Admin", "Organizer", "Manager"] },
  ];

  return (
    <motion.div
      animate={{ width: isCollapsed ? 76 : 280 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative flex flex-col h-full glass-panel border-r border-slate-200/50 dark:border-slate-800/50 transition-colors duration-300 select-none z-30 shrink-0 text-left"
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-100 dark:border-slate-800/50">
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              onClick={handleWorkspaceBrandClick}
              className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-white cursor-pointer hover:opacity-85 transition-opacity"
            >
              <div 
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--theme-gradient-from)] to-[var(--theme-gradient-to)] text-white shadow-md"
                style={{ boxShadow: "0 0 10px var(--theme-glow)" }}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-tight text-slate-800 dark:text-white">Nexora AI</span>
                <span className="text-[9px] text-[var(--theme-primary)] font-bold tracking-wider uppercase -mt-1">Enterprise RAG</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleWorkspaceBrandClick}
              className="mx-auto cursor-pointer hover:opacity-85 transition-opacity"
            >
              <div 
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--theme-gradient-from)] to-[var(--theme-gradient-to)] text-white shadow-md"
                style={{ boxShadow: "0 0 10px var(--theme-glow)" }}
              >
                <Sparkles className="w-4 h-4" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsible toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex items-center justify-center w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Mode Navigation Tabs */}
      <div className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
        {(() => {
          const isTabAllowedForRole = (tabId: string, role?: string): boolean => {
            if (!role) return ["landing", "dashboard", "settings"].includes(tabId);
            const r = role.trim().toUpperCase().replace(/[\s_-]+/g, "");

            if (r === "SUPERADMIN") {
              return true;
            }

            if (r === "ADMIN") {
              if (tabId === "super-admin" || tabId === "organizer" || tabId === "manager" || tabId === "employee") return false;
              return true;
            }

            if (r === "ORGANIZER") {
              if (tabId === "super-admin" || tabId === "architecture" || tabId === "manager" || tabId === "employee") return false;
              return true;
            }

            if (r === "MANAGER") {
              if (tabId === "super-admin" || tabId === "organizer" || tabId === "employee" || tabId === "admin" || tabId === "architecture" || tabId === "analytics" || tabId === "prompts") return false;
              return true;
            }

            if (r === "EMPLOYEE") {
              if (tabId === "super-admin" || tabId === "organizer" || tabId === "manager" || tabId === "admin" || tabId === "architecture" || tabId === "analytics" || tabId === "prompts" || tabId === "settings") return false;
              return true;
            }

            return true;
          };

          const visibleTabs = allTabs.filter(tab => isTabAllowedForRole(tab.id, user?.role));

          return visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all duration-300 group relative cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)] text-white shadow-lg shadow-[var(--theme-primary)]/15 scale-[1.02]"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-850/40 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon className={`w-4.5 h-4.5 shrink-0 transition-all duration-300 group-hover:rotate-6 group-hover:scale-110 ${
                  isActive ? "text-white" : "text-slate-400 dark:text-slate-500"
                }`} />
                
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    className="truncate"
                  >
                    {tab.label}
                  </motion.span>
                )}

                {/* Selection Bar Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1.5 rounded-r-full bg-white"
                  />
                )}
              </button>
            );
          });
        })()}
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800/50 mx-3 my-1" />

      {/* Chat History Section - only visible in Chat workspace */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {activeTab === "chat" && (
          <>
            <div className="flex items-center justify-between px-2">
              {!isCollapsed && (
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  Recent Sessions
                </span>
              )}
              <button
                onClick={onCreateSession}
                className={`flex items-center justify-center p-1 rounded-md text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 transition-colors cursor-pointer ${
                  isCollapsed ? "mx-auto w-full py-1.5 mt-1" : ""
                }`}
                title="New Chat Session"
              >
                <Plus className="w-4 h-4" />
                {!isCollapsed && <span className="text-[10px] font-bold ml-1 pr-1">New Chat</span>}
              </button>
            </div>

            <div className="space-y-1">
              {sessions.map((session) => {
                const isSelected = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    className="relative group flex items-center justify-between w-full animate-fade"
                  >
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className={`flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-left truncate transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "bg-slate-100/80 dark:bg-slate-800/50 text-slate-900 dark:text-white"
                          : "text-slate-500 dark:text-slate-400 hover:bg-slate-50/60 dark:hover:bg-slate-800/20"
                      }`}
                    >
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-slate-600 dark:text-slate-300" : "text-slate-400"}`} />
                      {!isCollapsed && <span className="truncate">{session.title}</span>}
                    </button>

                    {!isCollapsed && sessions.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 transition-all duration-150 cursor-pointer"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* User profile block & Theme controller */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/10 mt-auto">
        <div className="flex flex-col gap-2">
          
          {/* User Sign-In Action or Profile view */}
          <AnimatePresence mode="wait">
            {user ? (
              <motion.div 
                key="signed-in"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-100/40 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-850/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-slate-100 shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {!isCollapsed && (
                    <div className="flex flex-col min-w-0 text-left">
                      <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 truncate leading-tight">
                        {user.displayName}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {/* Read-only role badge — roles can only be changed by an admin via the database */}
                        <span
                          className={`text-[8px] font-extrabold uppercase tracking-wider leading-none ${
                            user.role === "Admin"
                              ? "text-amber-500 dark:text-amber-400"
                              : user.role === "Manager"
                                ? "text-indigo-500 dark:text-indigo-400"
                                : "text-[var(--theme-primary)]"
                          }`}
                          title="Role is managed by your administrator"
                        >
                          {user.role}
                        </span>
                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider pointer-events-none">Privilege</span>
                      </div>
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <button
                    onClick={onLogout}
                    className="p-1 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="signed-out"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
              >
                {!isCollapsed ? (
                  <button
                    onClick={onLogin}
                    className="w-full py-1.5 px-2 text-[10px] font-extrabold text-white bg-slate-950 dark:bg-[var(--theme-primary)] hover:opacity-95 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all shadow-sm"
                  >
                    <User className="w-3 h-3" />
                    <span>Workspace Sign-In</span>
                  </button>
                ) : (
                  <button
                    onClick={onLogin}
                    className="mx-auto w-8 h-8 rounded-full bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] flex items-center justify-center cursor-pointer hover:bg-[var(--theme-primary)]/20 transition-all"
                    title="Sign In with Google"
                  >
                    <User className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active core system profile */}
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-slate-100/30 dark:bg-slate-800/10 border border-slate-100/50 dark:border-slate-800/10">
              <div className="flex items-center justify-center w-6 h-6 rounded bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]">
                <Cpu className="w-3 h-3" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 truncate leading-tight">Gemini Vector Engine</span>
                <span className="text-[8px] text-[var(--theme-primary)] font-bold flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-[var(--theme-primary)] animate-pulse" />
                  Synchronized
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-1">
              <span className="w-2 h-2 rounded-full bg-[var(--theme-primary)] animate-pulse" title="System Connected" />
            </div>
          )}

          {/* Theme action bar */}
          <div className="flex flex-col gap-2.5 pt-1 border-t border-slate-200/50 dark:border-slate-800/40">
            {/* Theme Dot Picker (if expanded) */}
            {!isCollapsed && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                  Workspace Tint
                </span>
                <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-slate-900/40 p-1 rounded-full border border-slate-200/40 dark:border-slate-800/20">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onChangeTheme(t.id)}
                      className={`w-3.5 h-3.5 rounded-full border transition-all hover:scale-125 cursor-pointer ${
                        activeThemeId === t.id 
                          ? "border-slate-800 dark:border-white scale-110 shadow-sm" 
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: t.primary }}
                      title={t.name}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-1`}>
              {!isCollapsed && (
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                  Nexora Network
                </span>
              )}
              <button
                onClick={onToggleDarkMode}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                title={isDarkMode ? "Light Mode" : "Dark Mode"}
              >
                {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-500" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
