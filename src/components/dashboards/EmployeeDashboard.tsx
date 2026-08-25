import React, { useState, useEffect } from "react";
import { 
  User, 
  MessageSquare, 
  Mail, 
  Video, 
  FileText, 
  CheckSquare, 
  Upload, 
  ArrowRight,
  Sparkles
} from "lucide-react";
import { DbKanbanTask, getTasks } from "../../lib/firebaseDb";
import { UserProfile, KnowledgeDoc } from "../../types";

interface EmployeeDashboardProps {
  currentUser: UserProfile | null;
  docs: KnowledgeDoc[];
  onSelectTab: (tab: string) => void;
  triggerToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function EmployeeDashboard({ currentUser, docs, onSelectTab, triggerToast }: EmployeeDashboardProps) {
  const [assignedTasks, setAssignedTasks] = useState<DbKanbanTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.organizationId && currentUser?.uid) {
      loadAssignedTasks();
    }
  }, [currentUser]);

  const loadAssignedTasks = async () => {
    if (!currentUser?.organizationId) return;
    setIsLoading(true);
    try {
      const tasks = await getTasks(currentUser.organizationId);
      const myTasks = tasks.filter(t => t.assigneeId === currentUser.uid);
      setAssignedTasks(myTasks);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <User className="w-8 h-8 text-blue-500" />
            Welcome back, {currentUser?.displayName || "Employee"}! 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Access your personal suite, complete assigned tasks, upload documents, and collaborate with AI.
          </p>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div 
          onClick={() => onSelectTab("chat")}
          className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 hover:border-indigo-500/40 cursor-pointer transition-all hover:scale-105 group"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-500 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-1">AI Chat Studio</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Engage with tailored enterprise personas.</p>
          <span className="text-xs font-semibold text-indigo-500 flex items-center gap-1">Open Studio <ArrowRight className="w-3.5 h-3.5" /></span>
        </div>

        <div 
          onClick={() => onSelectTab("email")}
          className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40 cursor-pointer transition-all hover:scale-105 group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-1">Email Assistant</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Draft, optimize & compose smart emails.</p>
          <span className="text-xs font-semibold text-blue-500 flex items-center gap-1">Open Email <ArrowRight className="w-3.5 h-3.5" /></span>
        </div>

        <div 
          onClick={() => onSelectTab("meetings")}
          className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer transition-all hover:scale-105 group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Video className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-1">Meeting Assistant</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Record, transcribe & generate summaries.</p>
          <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">Open Meetings <ArrowRight className="w-3.5 h-3.5" /></span>
        </div>

        <div 
          onClick={() => onSelectTab("docs")}
          className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer transition-all hover:scale-105 group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-1">Knowledge Base</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Upload & access organizational context.</p>
          <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">View Docs <ArrowRight className="w-3.5 h-3.5" /></span>
        </div>
      </div>

      {/* Assigned Tasks */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-500" />
            My Assigned Tasks
          </h2>
          <button 
            onClick={() => onSelectTab("tasks")}
            className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1"
          >
            View Task Workspace <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-slate-400 animate-pulse">Loading assigned tasks...</div>
        ) : assignedTasks.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No pending tasks assigned to you right now.</div>
        ) : (
          <div className="space-y-3">
            {assignedTasks.map((t) => (
              <div key={t.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">{t.title}</h4>
                  {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                    t.priority === "high" 
                      ? "bg-red-500/10 text-red-500" 
                      : t.priority === "medium" 
                        ? "bg-amber-500/10 text-amber-500" 
                        : "bg-blue-500/10 text-blue-500"
                  }`}>
                    {t.priority}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold capitalize">
                    {t.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
