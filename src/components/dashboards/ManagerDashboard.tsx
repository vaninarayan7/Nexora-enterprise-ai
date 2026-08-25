import React, { useState, useEffect } from "react";
import { 
  Users, 
  CheckSquare, 
  Calendar, 
  FileText, 
  Plus, 
  Clock, 
  User, 
  TrendingUp 
} from "lucide-react";
import { DbKanbanTask, getTasks, saveTask, getAllUserProfiles, DbUserProfile } from "../../lib/firebaseDb";
import { UserProfile } from "../../types";

interface ManagerDashboardProps {
  currentUser: UserProfile | null;
  triggerToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export default function ManagerDashboard({ currentUser, triggerToast }: ManagerDashboardProps) {
  const [tasks, setTasks] = useState<DbKanbanTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<DbUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Task State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  useEffect(() => {
    if (currentUser?.organizationId) {
      loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser?.organizationId) return;
    setIsLoading(true);
    try {
      const [tList, users] = await Promise.all([
        getTasks(currentUser.organizationId),
        getAllUserProfiles(currentUser.organizationId)
      ]);
      
      // Automatic seeding for demonstration purposes if empty
      if (tList.length === 0 && users.length <= 1) {
        console.log("No real data exists. Automatically seeding demo data...");
        try {
          // @ts-ignore
          if (window.seedDemoData) await window.seedDemoData();
          
          // Refetch after seeding
          const [seededTasks, seededUsers] = await Promise.all([
            getTasks(currentUser.organizationId),
            getAllUserProfiles(currentUser.organizationId)
          ]);
          setTasks(seededTasks);
          setTeamMembers(seededUsers);
        } catch (seedErr) {
          console.error("Auto-seeding failed:", seedErr);
          setTasks(tList);
          setTeamMembers(users);
        }
      } else {
        setTasks(tList);
        setTeamMembers(users);
      }
    } catch (e) {
      console.error(e);
      triggerToast("Failed to load manager workspace data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !currentUser?.organizationId) return;

    try {
      const assignedUser = teamMembers.find(m => m.uid === assigneeId);
      const newTask: DbKanbanTask = {
        id: crypto.randomUUID(),
        organizationId: currentUser.organizationId,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        status: "todo",
        priority,
        assigneeId: assigneeId || undefined,
        assigneeName: assignedUser?.displayName || undefined,
        creatorId: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveTask(newTask);
      triggerToast("Task assigned to team member!", "success");
      setShowTaskModal(false);
      setTaskTitle("");
      setTaskDesc("");
      loadData();
    } catch (e) {
      console.error(e);
      triggerToast("Failed to create task", "error");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="w-8 h-8 text-emerald-500" />
            Manager Command Center
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Oversee team deliverables, assign tasks, schedule syncs, and monitor productivity.
          </p>
        </div>
        <button
          onClick={() => setShowTaskModal(true)}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>Assign New Task</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Team Size</span>
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold">{teamMembers.length}</p>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Tasks</span>
            <CheckSquare className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-extrabold text-blue-500">{tasks.filter(t => t.status !== "completed").length}</p>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed Tasks</span>
            <CheckSquare className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-500">{tasks.filter(t => t.status === "completed").length}</p>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Team Performance</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-500">94%</p>
        </div>
      </div>

      {/* Team Tasks Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-emerald-500" />
          Team Tasks & Deliverables
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 animate-pulse">Loading team tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center text-slate-500">No active tasks created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Task Title</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {task.title}
                    </td>
                    <td className="py-4 px-4 text-slate-500">
                      {task.assigneeName || "Unassigned"}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        task.priority === "high" 
                          ? "bg-red-500/10 text-red-500" 
                          : task.priority === "medium" 
                            ? "bg-amber-500/10 text-amber-500" 
                            : "bg-blue-500/10 text-blue-500"
                      }`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold capitalize">
                        {task.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold">Assign New Task</h3>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Title</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Update Security Documentation"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Description</label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Detailed task guidelines..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 h-24"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Assignee</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select Team Member</option>
                  {teamMembers.map(m => (
                    <option key={m.uid} value={m.uid}>{m.displayName} ({m.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
