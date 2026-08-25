import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  MessageSquare, 
  Folder, 
  LineChart, 
  Mail, 
  ShieldAlert, 
  FileText, 
  Settings, 
  Sun, 
  Moon, 
  PlusCircle, 
  Trash2, 
  Sparkles, 
  Users, 
  Scale, 
  Cpu, 
  Briefcase, 
  Video, 
  Volume2, 
  X,
  Languages
} from "lucide-react";
import { WorkspaceSettings, WorkspacePersona } from "../types";
import { WORKSPACE_PERSONAS } from "./personas";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  settings: WorkspaceSettings;
  onUpdateSettings: (settings: Partial<WorkspaceSettings>) => void;
  onAddNewSession: () => void;
  onClearActiveChat: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  settings,
  onUpdateSettings,
  onAddNewSession,
  onClearActiveChat,
  isDarkMode,
  onToggleDarkMode
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const navigationCommands = [
    { id: "nav-chat", label: "Go to Workspace Chat", desc: "Initiate RAG discussion workflows", icon: MessageSquare, category: "Navigation", action: () => { onSelectTab("chat"); onClose(); } },
    { id: "nav-docs", label: "Go to Knowledge Base", desc: "Upload and index workspace assets", icon: Folder, category: "Navigation", action: () => { onSelectTab("docs"); onClose(); } },
    { id: "nav-analytics", label: "Go to Analytics Dashboard", desc: "Review token throughput & costs", icon: LineChart, category: "Navigation", action: () => { onSelectTab("analytics"); onClose(); } },
    { id: "nav-email", label: "Go to Email Automation", desc: "Design automated digests and alerts", icon: Mail, category: "Navigation", action: () => { onSelectTab("email"); onClose(); } },
    { id: "nav-prompts", label: "Go to Prompt Library", desc: "Manage template cards and snippets", icon: FileText, category: "Navigation", action: () => { onSelectTab("prompts"); onClose(); } },
    { id: "nav-admin", label: "Go to Admin Panel", desc: "Monitor system health & roles", icon: ShieldAlert, category: "Navigation", action: () => { onSelectTab("admin"); onClose(); } },
    { id: "nav-settings", label: "Go to System Settings", desc: "Fine-tune models and personas", icon: Settings, category: "Navigation", action: () => { onSelectTab("settings"); onClose(); } },
  ];

  const quickActionCommands = [
    { id: "act-session", label: "Start New Discussion Session", desc: "Clear canvas and boot empty context", icon: PlusCircle, category: "Quick Actions", action: () => { onAddNewSession(); onClose(); } },
    { id: "act-clear", label: "Clear Active Chat History", desc: "Wipe memory for the current thread", icon: Trash2, category: "Quick Actions", action: () => { onClearActiveChat(); onClose(); } },
    { id: "act-theme", label: isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme", desc: "Toggle interface colors", icon: isDarkMode ? Sun : Moon, category: "Quick Actions", action: () => { onToggleDarkMode(); onClose(); } },
  ];

  // Map icons dynamically for personas
  const getPersonaIcon = (iconName: string) => {
    switch (iconName) {
      case "Sparkles": return Sparkles;
      case "Users": return Users;
      case "BarChart3": return LineChart;
      case "Scale": return Scale;
      case "Cpu": return Cpu;
      case "Briefcase": return Briefcase;
      case "Video": return Video;
      default: return Sparkles;
    }
  };

  const agentCommands = WORKSPACE_PERSONAS.map(p => ({
    id: `agent-${p.id}`,
    label: `Deploy ${p.name}`,
    desc: p.description,
    icon: getPersonaIcon(p.iconName),
    category: "AI Specialists",
    action: () => {
      onUpdateSettings({ activePersonaId: p.id, systemInstruction: p.systemPrompt });
      onSelectTab("chat");
      onClose();
    }
  }));

  const languageCommands = [
    { id: "lang-en", label: "Set Default Locale: English", desc: "Default system language interface", icon: Languages, category: "Languages", action: () => { onUpdateSettings({ language: "en" }); onClose(); } },
    { id: "lang-te", label: "Set Default Locale: Telugu (తెలుగు)", desc: "Translate responses & workspace settings", icon: Languages, category: "Languages", action: () => { onUpdateSettings({ language: "te" }); onClose(); } },
    { id: "lang-hi", label: "Set Default Locale: Hindi (हिन्दी)", desc: "Translate responses & workspace settings", icon: Languages, category: "Languages", action: () => { onUpdateSettings({ language: "hi" }); onClose(); } },
  ];

  const notificationCommands = [
    { id: "notif-sound", label: "Toggle Audio Triggers", desc: "Acoustic feedback on chat completion", icon: Volume2, category: "Notifications", action: () => { onUpdateSettings({ enableSoundNotifications: !settings.enableSoundNotifications }); onClose(); } },
    { id: "notif-email", label: "Toggle Email Summaries", desc: "Weekly automated analytics alerts", icon: Mail, category: "Notifications", action: () => { onUpdateSettings({ enableEmailAlerts: !settings.enableEmailAlerts }); onClose(); } },
  ];

  const allCommands = [
    ...navigationCommands,
    ...quickActionCommands,
    ...agentCommands,
    ...languageCommands,
    ...notificationCommands
  ];

  const filteredCommands = allCommands.filter(cmd => 
    cmd.label.toLowerCase().includes(search.toLowerCase()) || 
    cmd.desc.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = Array.from(new Set(filteredCommands.map(c => c.category)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4 bg-slate-950/40 dark:bg-slate-950/60 backdrop-blur-md">
      {/* Click outside backdrop overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -8 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="w-full max-w-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl shadow-indigo-500/10 dark:shadow-slate-950/50 backdrop-blur-xl flex flex-col overflow-hidden max-h-[60vh] z-10"
      >
        {/* Input area */}
        <div className="flex items-center px-4.5 py-3 border-b border-slate-200/60 dark:border-slate-800/60 gap-3">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands, agents, modules, actions... (Ctrl+K)"
            className="w-full bg-transparent border-none outline-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 font-extrabold focus:ring-0"
          />
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 max-h-[48vh] text-left">
          {categories.length > 0 ? (
            categories.map(cat => {
              const catCmds = filteredCommands.filter(c => c.category === cat);
              return (
                <div key={cat} className="space-y-1">
                  <h4 className="text-[9px] font-black uppercase text-indigo-500 tracking-widest px-3 py-1">
                    {cat}
                  </h4>
                  <div className="space-y-0.5">
                    {catCmds.map(cmd => {
                      const CmdIcon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          className="w-full px-3 py-2.5 rounded-xl hover:bg-indigo-500/[0.04] hover:dark:bg-indigo-500/[0.03] transition-all flex items-center gap-3 text-left group cursor-pointer border border-transparent hover:border-indigo-500/10"
                        >
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors text-slate-500 dark:text-slate-400 shrink-0">
                            <CmdIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                              {cmd.label}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider truncate">
                              {cmd.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-65">
              <Search className="w-7 h-7 text-slate-350 dark:text-slate-600 mb-2 animate-bounce" />
              <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">No commands found</span>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[240px] mt-1 leading-relaxed">
                Refine your query or browse different sections in Nexora Workspace.
              </p>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4.5 py-2.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-1">
            <span>Esc</span>
            <span className="text-slate-350 dark:text-slate-700">to exit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1 bg-slate-200 dark:bg-slate-800 rounded font-mono">⌘</span>
            <span className="px-1 bg-slate-200 dark:bg-slate-800 rounded font-mono">K</span>
            <span className="text-slate-350 dark:text-slate-700">to toggle</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
