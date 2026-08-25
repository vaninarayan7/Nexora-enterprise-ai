import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  MessageSquare, 
  Folder, 
  BarChart3, 
  Mail, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Compass, 
  Plus, 
  Trash2, 
  Calendar, 
  CloudSun, 
  Cpu, 
  TrendingUp, 
  FileText, 
  Check, 
  Play, 
  Workflow, 
  Milestone,
  Brain,
  ChevronLeft,
  ChevronRight,
  Bell,
  Activity,
  Send,
  X,
  Volume2
} from "lucide-react";
import { ChatSession, KnowledgeDoc, WorkspaceSettings, UserProfile } from "../types";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface DashboardProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  docs: KnowledgeDoc[];
  activeTab: string;
  onSelectTab: (tab: any) => void;
  settings: WorkspaceSettings;
  onUpdateSettings: (settings: Partial<WorkspaceSettings>) => void;
  isDarkMode: boolean;
  onSendMessage: (text: string) => void;
  chatDraft: string;
  onSetChatDraft: (text: string) => void;
  triggerToast: (msg: string, type: "success" | "info" | "error") => void;
  user?: UserProfile | null;
}

interface DashboardTask {
  id: string;
  text: string;
  completed: boolean;
  dueDate: string;
  priority: "low" | "medium" | "high";
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: "reminder" | "task" | "meeting" | "custom";
  priority?: "low" | "medium" | "high";
}

interface UnifiedEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string;
  type: "reminder" | "task" | "meeting" | "custom";
  source: "calendar" | "kanban" | "meeting" | "dashboard";
  priority?: "low" | "medium" | "high";
  completed?: boolean;
}

export default function Dashboard({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  docs,
  activeTab,
  onSelectTab,
  settings,
  onUpdateSettings,
  isDarkMode,
  onSendMessage,
  chatDraft,
  onSetChatDraft,
  triggerToast,
  user
}: DashboardProps) {
  // Log role every time dashboard renders
  const userRole = user?.role;
  if (user) {
    console.group("[Dashboard] Rendering dashboard");
    console.log("  uid  :", user.uid);
    console.log("  email:", user.email);
    console.log("  role :", userRole ?? "⚠️ NO ROLE");
    console.groupEnd();
  }
  // Load tasks from localStorage or default
  const [tasks, setTasks] = useState<DashboardTask[]>(() => {
    const saved = localStorage.getItem("nexora_dashboard_tasks");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      { id: "t-1", text: "Index HR policy amendments into security vector store", completed: true, dueDate: "Today", priority: "high" },
      { id: "t-2", text: "Generate weekly intelligence analytics briefing", completed: false, dueDate: "Today", priority: "medium" },
      { id: "t-3", text: "Review legal compliance clauses in draft NDA", completed: false, dueDate: "Tomorrow", priority: "high" },
      { id: "t-4", text: "Audit system log anomalies in the IT Control Panel", completed: false, dueDate: "In 2 days", priority: "low" }
    ];
  });

  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");

  // --- START DYNAMIC CALENDAR ENGINE ---
  const [systemDate, setSystemDate] = useState(() => new Date());
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [displayYear, setDisplayYear] = useState(() => systemDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(() => systemDate.getMonth()); // 0-indexed
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const y = systemDate.getFullYear();
    const m = String(systemDate.getMonth() + 1).padStart(2, "0");
    const d = String(systemDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [kanbanTasks, setKanbanTasks] = useState<any[]>([]);
  const [customMeetings, setCustomMeetings] = useState<any[]>([]);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    type: "custom" as "reminder" | "task" | "meeting" | "custom",
    priority: "medium" as "low" | "medium" | "high",
    date: "",
    time: "10:00",
    description: ""
  });

  // Calendar events persisted in local database / localStorage
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem("nexora_calendar_events");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    // Dynamic defaults starting from today to keep calendar populated elegantly
    const formatOffsetDate = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const yr = d.getFullYear();
      const mn = String(d.getMonth() + 1).padStart(2, "0");
      const dy = String(d.getDate()).padStart(2, "0");
      return `${yr}-${mn}-${dy}`;
    };
    return [
      {
        id: "ce-1",
        title: "RAG Evaluation Benchmark Suite",
        description: "Review automated validation thresholds for document indexing.",
        date: formatOffsetDate(0), // Today
        time: "10:00",
        type: "task",
        priority: "high"
      },
      {
        id: "ce-2",
        title: "Weekly Security Compliance Review",
        description: "Audit active credential scopes and access logs on server node.",
        date: formatOffsetDate(1), // Tomorrow
        time: "14:30",
        type: "meeting",
        priority: "medium"
      },
      {
        id: "ce-3",
        title: "Refresh vector store database backups",
        description: "Run cron sync to replicate embedded chunks.",
        date: formatOffsetDate(2), // In 2 days
        time: "09:00",
        type: "reminder",
        priority: "low"
      }
    ];
  });

  // Load external/tab state data on mount and activeTab switch
  useEffect(() => {
    const syncExternalData = () => {
      // 1. Kanban Tasks
      const savedKanban = localStorage.getItem("nexora-kanban-tasks");
      if (savedKanban) {
        try { setKanbanTasks(JSON.parse(savedKanban)); } catch (e) { /* ignore */ }
      } else {
        setKanbanTasks([]);
      }
      // 2. Custom Meetings
      const savedMeetings = localStorage.getItem("nexora-custom-meetings");
      if (savedMeetings) {
        try { setCustomMeetings(JSON.parse(savedMeetings)); } catch (e) { /* ignore */ }
      } else {
        setCustomMeetings([]);
      }
    };

    syncExternalData();
    
    // Refresh when user focuses the tab or when local storage changes
    window.addEventListener("storage", syncExternalData);
    window.addEventListener("focus", syncExternalData);
    return () => {
      window.removeEventListener("storage", syncExternalData);
      window.removeEventListener("focus", syncExternalData);
    };
  }, [activeTab]);

  // Midnight Rollover effect
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (
        now.getDate() !== systemDate.getDate() ||
        now.getMonth() !== systemDate.getMonth() ||
        now.getFullYear() !== systemDate.getFullYear()
      ) {
        setSystemDate(now);
      }
    }, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, [systemDate]);

  // Sync calendar events to database / localStorage
  useEffect(() => {
    localStorage.setItem("nexora_calendar_events", JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  // Handle month/year navigations
  const handlePrevMonth = () => {
    setDisplayMonth(prev => {
      if (prev === 0) {
        setDisplayYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setDisplayMonth(prev => {
      if (prev === 11) {
        setDisplayYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setSystemDate(now);
    setDisplayYear(now.getFullYear());
    setDisplayMonth(now.getMonth());
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    setSelectedDateStr(`${y}-${m}-${d}`);
  };

  // Helper date parsing math
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const extractDateStr = (str: string): string => {
    if (!str) return "";
    const match = str.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    return "";
  };

  const resolveDashboardDueDate = (dueDateStr: string, todayObj: Date): string => {
    const target = new Date(todayObj);
    if (dueDateStr === "Today") {
      // Keep today
    } else if (dueDateStr === "Tomorrow") {
      target.setDate(target.getDate() + 1);
    } else if (dueDateStr === "In 2 days") {
      target.setDate(target.getDate() + 2);
    } else {
      const extracted = extractDateStr(dueDateStr);
      if (extracted) return extracted;
      return "";
    }
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, "0");
    const d = String(target.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Compile unified calendar schedule
  const getMergedEvents = (): UnifiedEvent[] => {
    const list: UnifiedEvent[] = [];
    
    // 1. Calendar Custom Events
    calendarEvents.forEach(e => {
      list.push({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date,
        time: e.time,
        type: e.type,
        source: "calendar",
        priority: e.priority || "medium"
      });
    });

    // 2. Kanban Tasks Due Dates
    kanbanTasks.forEach(t => {
      if (t.dueDate) {
        const parsedDate = extractDateStr(t.dueDate);
        if (parsedDate) {
          list.push({
            id: `kanban-${t.id}`,
            title: `[Kanban] ${t.title}`,
            description: t.description || `Status: ${t.status?.toUpperCase()}`,
            date: parsedDate,
            time: "17:00",
            type: "task",
            source: "kanban",
            priority: t.priority || "medium",
            completed: t.status === "completed"
          });
        }
      }
    });

    // 3. Custom Meetings
    customMeetings.forEach(m => {
      let dateStr = "";
      let timeStr = "12:00";
      
      if (m.date) {
        dateStr = extractDateStr(m.date);
      } else if (m.time) {
        dateStr = extractDateStr(m.time);
      }
      
      const timeMatch = m.time?.match(/(\d{2}:\d{2})/);
      if (timeMatch) {
        timeStr = timeMatch[1];
      }
      
      if (dateStr) {
        list.push({
          id: `meeting-${m.id}`,
          title: `[Meeting] ${m.title}`,
          description: `Platform: ${m.platform} • Host: ${m.organizer}`,
          date: dateStr,
          time: timeStr,
          type: "meeting",
          source: "meeting",
          priority: "high"
        });
      }
    });

    // 4. Checklist Tasks
    tasks.forEach(t => {
      if (t.dueDate) {
        const dateStr = resolveDashboardDueDate(t.dueDate, systemDate);
        if (dateStr) {
          list.push({
            id: `db-task-${t.id}`,
            title: `[Checklist] ${t.text}`,
            description: `Priority: ${t.priority?.toUpperCase()}`,
            date: dateStr,
            time: "09:00",
            type: "task",
            source: "dashboard",
            priority: t.priority || "medium",
            completed: t.completed
          });
        }
      }
    });

    return list;
  };

  const allMergedEvents = getMergedEvents();

  // Create custom calendar event
  const handleCreateCalendarEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !eventForm.date || !eventForm.time) {
      triggerToast("Event Title, Date, and Time are required.", "error");
      return;
    }
    const newEvent: CalendarEvent = {
      id: `ce-${Date.now()}`,
      title: eventForm.title.trim(),
      description: eventForm.description.trim(),
      date: eventForm.date,
      time: eventForm.time,
      type: eventForm.type,
      priority: eventForm.priority
    };
    setCalendarEvents(prev => [...prev, newEvent]);
    setIsAddEventOpen(false);
    setEventForm({
      title: "",
      type: "custom",
      priority: "medium",
      date: "",
      time: "10:00",
      description: ""
    });
    triggerToast(`Calendar event "${newEvent.title}" scheduled successfully.`, "success");
  };

  // Delete custom calendar event
  const handleDeleteCalendarEvent = (eventId: string, title: string) => {
    setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
    triggerToast(`Calendar event "${title}" removed.`, "info");
  };

  // Calendar cells calculation
  const calendarGrid = (() => {
    const daysInCurrentMonth = getDaysInMonth(displayYear, displayMonth);
    const firstDayIndex = getFirstDayOfMonth(displayYear, displayMonth);
    
    const prevMonth = displayMonth === 0 ? 11 : displayMonth - 1;
    const prevYear = displayMonth === 0 ? displayYear - 1 : displayYear;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
    
    const grid: { day: number; month: number; year: number; isCurrentMonth: boolean; dateStr: string }[] = [];
    
    // Prev month days offset
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const mStr = String(prevMonth + 1).padStart(2, "0");
      const dStr = String(d).padStart(2, "0");
      grid.push({
        day: d,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        dateStr: `${prevYear}-${mStr}-${dStr}`
      });
    }
    
    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const mStr = String(displayMonth + 1).padStart(2, "0");
      const dStr = String(d).padStart(2, "0");
      grid.push({
        day: d,
        month: displayMonth,
        year: displayYear,
        isCurrentMonth: true,
        dateStr: `${displayYear}-${mStr}-${dStr}`
      });
    }
    
    // Next month trailing cells
    const totalCells = grid.length <= 35 ? 35 : 42;
    const nextMonth = displayMonth === 11 ? 0 : displayMonth + 1;
    const nextYear = displayMonth === 11 ? displayYear + 1 : displayYear;
    
    let nextDay = 1;
    while (grid.length < totalCells) {
      const mStr = String(nextMonth + 1).padStart(2, "0");
      const dStr = String(nextDay).padStart(2, "0");
      grid.push({
        day: nextDay,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        dateStr: `${nextYear}-${mStr}-${dStr}`
      });
      nextDay++;
    }
    return grid;
  })();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const todayYear = systemDate.getFullYear();
  const todayMonth = systemDate.getMonth();
  const todayDay = systemDate.getDate();
  const todayDateStr = `${todayYear}-${String(todayMonth + 1).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;

  // Filter events for the selected day
  const selectedDayEvents = allMergedEvents
    .filter(e => e.date === selectedDateStr)
    .sort((a, b) => a.time.localeCompare(b.time));
  // --- END DYNAMIC CALENDAR ENGINE ---

  // Flowchart Generator states
  const [flowchartQuery, setFlowchartQuery] = useState("HR Employee Onboarding Process");
  const [flowchartNodes, setFlowchartNodes] = useState<{ id: string; label: string; x: number; y: number; type: string }[]>([
    { id: "1", label: "Candidate Accepts Offer", x: 60, y: 30, type: "start" },
    { id: "2", label: "Auto-Generate IT Accounts", x: 60, y: 110, type: "process" },
    { id: "3", label: "Security & NDA Signoff", x: 60, y: 190, type: "process" },
    { id: "4", label: "Welcome Dispatch Sent", x: 60, y: 270, type: "end" }
  ]);
  const [isGeneratingFlow, setIsGeneratingFlow] = useState(false);

  // Timeline Generator states
  const [timelineQuery, setTimelineQuery] = useState("Software Launch Phases");
  const [timelineMilestones, setTimelineMilestones] = useState<{ id: string; title: string; date: string; progress: number; status: "completed" | "active" | "planned" }[]>([
    { id: "m1", title: "RAG Alpha Index Testing", date: "July 20, 2026", progress: 100, status: "completed" },
    { id: "m2", title: "Enterprise Pilot Onboarding", date: "August 01, 2026", progress: 75, status: "active" },
    { id: "m3", title: "Dual Multi-Cloud Deployment", date: "August 15, 2026", progress: 0, status: "planned" },
    { id: "m4", title: "Continuous Compliance Sign-off", date: "Sept 10, 2026", progress: 0, status: "planned" }
  ]);
  const [isGeneratingTimeline, setIsGeneratingTimeline] = useState(false);

  // Floating micro agent states
  const [isFloatOpen, setIsFloatOpen] = useState(false);
  const [floatMessage, setFloatMessage] = useState("");
  const [floatChatHistory, setFloatChatHistory] = useState<{ sender: "user" | "agent"; text: string }[]>([
    { sender: "agent", text: "Hello! I am your ambient workspace buddy. How can I assist you with RAG or strategy today?" }
  ]);
  const [isFloatTyping, setIsFloatTyping] = useState(false);

  useEffect(() => {
    localStorage.setItem("nexora_dashboard_tasks", JSON.stringify(tasks));
  }, [tasks]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const task: DashboardTask = {
      id: `task-${Date.now()}`,
      text: newTaskText.trim(),
      completed: false,
      dueDate: "Tomorrow",
      priority: newTaskPriority
    };
    setTasks(prev => [task, ...prev]);
    setNewTaskText("");
    triggerToast(`Task "${task.text.substring(0, 20)}..." created.`, "success");
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    triggerToast("Task status updated.", "info");
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    triggerToast("Task deleted from checklist.", "info");
  };

  // SVG Flowchart Generator logic using Gemini API mock / in-memory triggers
  const handleGenerateFlowchart = async () => {
    if (!flowchartQuery.trim()) return;
    setIsGeneratingFlow(true);
    triggerToast("Generating neural workflow architecture layout...", "info");
    
    setTimeout(() => {
      // Create dynamically labeled nodes based on user query
      const query = flowchartQuery.trim();
      const nodes = [
        { id: "1", label: `Trigger: ${query}`, x: 60, y: 30, type: "start" },
        { id: "2", label: `Verify Data Integrity & Security Check`, x: 60, y: 110, type: "process" },
        { id: "3", label: `Analyze with AI Persona Node`, x: 60, y: 190, type: "process" },
        { id: "4", label: `Execute & Dispatch Workspace Deliverable`, x: 60, y: 270, type: "end" }
      ];
      setFlowchartNodes(nodes);
      setIsGeneratingFlow(false);
      triggerToast("AI Flowchart architecture synchronized.", "success");
    }, 1200);
  };

  // Dynamic Timeline builder
  const handleGenerateTimeline = () => {
    if (!timelineQuery.trim()) return;
    setIsGeneratingTimeline(true);
    triggerToast("Compiling predictive milestone timeline...", "info");
    
    setTimeout(() => {
      const query = timelineQuery.trim();
      const milestones = [
        { id: "m1", title: `Phase I: ${query} Architecture Setup`, date: "August 02, 2026", progress: 100, status: "completed" as const },
        { id: "m2", title: "Phase II: Security Gateway Auditing", date: "August 18, 2026", progress: 40, status: "active" as const },
        { id: "m3", title: "Phase III: Pilot Release Node Deploy", date: "Sept 05, 2026", progress: 0, status: "planned" as const },
        { id: "m4", title: "Phase IV: Fully Autonomous Orchestration", date: "Oct 12, 2026", progress: 0, status: "planned" as const }
      ];
      setTimelineMilestones(milestones);
      setIsGeneratingTimeline(false);
      triggerToast("Timeline pipeline projected.", "success");
    }, 1100);
  };

  // Micro Floating Agent trigger chat
  const handleFloatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!floatMessage.trim()) return;
    const userMsg = floatMessage.trim();
    setFloatChatHistory(prev => [...prev, { sender: "user", text: userMsg }]);
    setFloatMessage("");
    setIsFloatTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: [],
          personaPrompt: "You are the friendly micro companion widget inside Nexora workspace. Keep your response brief, helpful, and under 2 sentences.",
          modelName: "gemini-3.6-flash",
          temperature: 0.7,
          ragDocuments: docs.map(d => ({ name: d.name, content: d.content }))
        })
      });
      const data = await response.json();
      if (data.success) {
        setFloatChatHistory(prev => [...prev, { sender: "agent", text: data.response }]);
      } else {
        setFloatChatHistory(prev => [...prev, { sender: "agent", text: "Oops, connection error with standard Nexora API. Let me know if you need to load pages!" }]);
      }
    } catch (e) {
      setFloatChatHistory(prev => [...prev, { sender: "agent", text: "Nexora AI gateway node is offline. Please check active server connection status." }]);
    } finally {
      setIsFloatTyping(false);
    }
  };

  // Run dynamic prompt inside main chat panel
  const handleRunSuggestion = (promptText: string) => {
    onSetChatDraft(promptText);
    onSelectTab("chat");
    triggerToast("Suggestion loaded into Chat. Submit to process.", "info");
  };

  // Chart data
  const activityData = [
    { name: "Mon", requests: 12, tokens: 4.2 },
    { name: "Tue", requests: 19, tokens: 6.8 },
    { name: "Wed", requests: 28, tokens: 8.5 },
    { name: "Thu", requests: 35, tokens: 12.1 },
    { name: "Fri", requests: 42, tokens: 15.6 },
    { name: "Sat", requests: 25, tokens: 9.3 },
    { name: "Sun", requests: 31, tokens: 11.2 }
  ];

  const departmentPerformance = [
    { name: "HR", accuracy: 94 },
    { name: "Finance", accuracy: 98 },
    { name: "Legal", accuracy: 91 },
    { name: "IT", accuracy: 96 },
    { name: "Research", accuracy: 95 }
  ];

  const completedTasksCount = tasks.filter(t => t.completed).length;
  const taskProgressPercent = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto px-6 py-6 space-y-6 select-text text-left">
      
      {/* Welcome Hero Banner with Glassmorphism */}
      <div className="relative overflow-hidden rounded-2xl border border-white/20 dark:border-slate-800/60 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-teal-500/10 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 backdrop-blur-md">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 text-[8px] font-black uppercase text-white rounded-md tracking-wider ${
              (userRole === "Super Admin" || userRole === "Organizer") ? "bg-rose-500" : userRole === "Manager" ? "bg-amber-500" : "bg-indigo-500"
            }`}>
              {(userRole === "Super Admin" || userRole === "Organizer") ? "Admin Dashboard" : userRole === "Manager" ? "Manager Dashboard" : "Employee Dashboard"}
            </span>
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md">
              <Activity className="w-3 h-3 animate-ping" />
              <span>All Systems Nominal</span>
            </span>
            {user && (
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                {user.email} &bull; {userRole}
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white leading-tight tracking-tight">
            {(userRole === "Super Admin" || userRole === "Organizer") ? (
              <>Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-500">Administrator</span></>
            ) : userRole === "Manager" ? (
              <>Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-yellow-400">Manager</span></>
            ) : (
              <>Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">Nexora Workspace</span></>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xl leading-relaxed">
            {(userRole === "Super Admin" || userRole === "Organizer")
              ? "Full administrative access. Manage users, organizations, analytics, and system configuration."
              : userRole === "Manager"
              ? "Team management access. Oversee tasks, meetings, and team productivity."
              : "Your high-performance intelligent enterprise knowledge & productivity command node."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0 w-full md:w-auto relative z-10">
          <button
            onClick={onCreateSession}
            className="flex-1 sm:flex-none py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Launch Fresh Chat</span>
          </button>
          <button
            onClick={() => onSelectTab("docs")}
            className="flex-1 sm:flex-none py-2 px-4 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Ingest Knowledge</span>
          </button>
        </div>
      </div>

      {/* Grid of 4 Key Operational Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 relative overflow-hidden transition-all hover:border-indigo-500/20 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Semantic Vectors Index
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0 group-hover:scale-105 transition-all">
              <Folder className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
            {docs.length} <span className="text-xs text-slate-400 font-bold">Documents</span>
          </h3>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1 tracking-wider">
            {docs.reduce((acc, d) => acc + d.content.split(/\s+/).length, 0)} indexed embeddings
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 relative overflow-hidden transition-all hover:border-indigo-500/20 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Core Model Throughput
            </span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500 shrink-0 group-hover:scale-105 transition-all">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
            99.8% <span className="text-xs text-slate-400 font-bold">Uptime</span>
          </h3>
          <p className="text-[9px] text-emerald-500 font-black uppercase mt-1 tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>0.4s response latency</span>
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 relative overflow-hidden transition-all hover:border-indigo-500/20 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              RAG Accuracy Rating
            </span>
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-500 shrink-0 group-hover:scale-105 transition-all">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
            96.4% <span className="text-xs text-slate-400 font-bold">Reliable</span>
          </h3>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1 tracking-wider">
            Zero citation hallucination mode active
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 relative overflow-hidden transition-all hover:border-indigo-500/20 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Active Dialog Sessions
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 shrink-0 group-hover:scale-105 transition-all">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
            {sessions.length} <span className="text-xs text-slate-400 font-bold">Threads</span>
          </h3>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1 tracking-wider">
            {sessions.reduce((acc, s) => acc + s.messages.length, 0)} structured exchanges
          </p>
        </div>
      </div>

      {/* Main Column Grid Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Columns (Span 2) - Analytics, Generators, AI Actions */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Beautiful Recharts Daily Activity & Department Radar/Bar Charts */}
          <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Today's Neural Model Activity
                </h3>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  Continuous performance tracking across key agents
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-500 tracking-wider bg-indigo-500/5 px-2.5 py-1 rounded-lg">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Live Feed</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="h-44">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">Throughput Trend (Requests)</span>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                    <Tooltip contentStyle={{ background: isDarkMode ? "#0f172a" : "#ffffff", border: "1px solid #334155", borderRadius: "8px", fontSize: "10px" }} />
                    <Area type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRequests)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="h-44">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">Department Fact Accuracy Rating (%)</span>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentPerformance}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={9} tickLine={false} domain={[80, 100]} />
                    <Tooltip contentStyle={{ background: isDarkMode ? "#0f172a" : "#ffffff", border: "1px solid #334155", borderRadius: "8px", fontSize: "10px" }} />
                    <Bar dataKey="accuracy" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Interactive AI Flowchart and Timeline Generator Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* AI Flowchart Generator Card */}
            <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 flex flex-col min-h-80">
              <div className="flex items-center gap-2 mb-3 border-b border-slate-100 dark:border-slate-800/40 pb-2.5">
                <Workflow className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="text-left">
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">AI Flowchart Builder</h4>
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Dynamic workflow visualization</span>
                </div>
              </div>

              <div className="flex gap-1.5 mb-3">
                <input
                  type="text"
                  value={flowchartQuery}
                  onChange={(e) => setFlowchartQuery(e.target.value)}
                  placeholder="Enter a process name..."
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-[10px] bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none font-bold"
                />
                <button
                  onClick={handleGenerateFlowchart}
                  disabled={isGeneratingFlow}
                  className="px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Dynamic SVG Drawing Box */}
              <div className="flex-1 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-800/45 rounded-xl relative p-3 overflow-hidden flex flex-col justify-center min-h-[200px]">
                {isGeneratingFlow ? (
                  <div className="flex flex-col items-center justify-center text-center opacity-75">
                    <Brain className="w-6 h-6 text-indigo-500 animate-spin mb-1.5" />
                    <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Compiling nodes...</span>
                  </div>
                ) : (
                  <svg className="w-full h-full" viewBox="0 0 300 320" style={{ maxHeight: "210px" }}>
                    {/* Render paths/arrows first */}
                    {flowchartNodes.map((node, i) => {
                      if (i === flowchartNodes.length - 1) return null;
                      const nextNode = flowchartNodes[i + 1];
                      return (
                        <g key={`arrow-${node.id}`}>
                          <path
                            d={`M ${node.x + 75} ${node.y + 35} L ${nextNode.x + 75} ${nextNode.y}`}
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth="1.5"
                            strokeDasharray="3,3"
                            className="animate-pulse"
                          />
                          <polygon
                            points={`${nextNode.x + 75},${nextNode.y} ${nextNode.x + 71},${nextNode.y - 4} ${nextNode.x + 79},${nextNode.y - 4}`}
                            fill="#6366f1"
                          />
                        </g>
                      );
                    })}

                    {/* Render nodes */}
                    {flowchartNodes.map((node) => (
                      <g key={node.id}>
                        <rect
                          x={node.x}
                          y={node.y}
                          width="150"
                          height="35"
                          rx={node.type === "start" || node.type === "end" ? "12" : "6"}
                          fill={node.type === "start" ? "rgba(99,102,241,0.12)" : node.type === "end" ? "rgba(20,184,166,0.12)" : "rgba(100,116,139,0.08)"}
                          stroke={node.type === "start" ? "#6366f1" : node.type === "end" ? "#14b8a6" : "rgba(100,116,139,0.3)"}
                          strokeWidth="1"
                        />
                        <text
                          x={node.x + 75}
                          y={node.y + 20}
                          textAnchor="middle"
                          fill={isDarkMode ? "#e2e8f0" : "#334155"}
                          fontSize="8"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          {node.label.length > 28 ? `${node.label.substring(0, 26)}...` : node.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </div>

            {/* AI Timeline Generator Card */}
            <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 flex flex-col min-h-80">
              <div className="flex items-center gap-2 mb-3 border-b border-slate-100 dark:border-slate-800/40 pb-2.5">
                <Milestone className="w-4 h-4 text-teal-500 shrink-0" />
                <div className="text-left">
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">AI Timeline Generator</h4>
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Chronological project roadmap</span>
                </div>
              </div>

              <div className="flex gap-1.5 mb-3">
                <input
                  type="text"
                  value={timelineQuery}
                  onChange={(e) => setTimelineQuery(e.target.value)}
                  placeholder="Enter milestone plan..."
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-[10px] bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none font-bold"
                />
                <button
                  onClick={handleGenerateTimeline}
                  disabled={isGeneratingTimeline}
                  className="px-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-100 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Dynamic Timeline milestone list */}
              <div className="flex-1 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-800/45 rounded-xl relative p-3 overflow-y-auto min-h-[200px]">
                {isGeneratingTimeline ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-75 py-10">
                    <Clock className="w-6 h-6 text-teal-500 animate-spin mb-1.5" />
                    <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Calculating project tracks...</span>
                  </div>
                ) : (
                  <div className="relative pl-4 border-l border-slate-200 dark:border-slate-800 space-y-4 text-left">
                    {timelineMilestones.map((m) => (
                      <div key={m.id} className="relative">
                        <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                          m.status === "completed" 
                            ? "bg-emerald-500 border-emerald-200 dark:border-emerald-950" 
                            : m.status === "active"
                              ? "bg-indigo-500 border-indigo-200 dark:border-indigo-950 animate-ping"
                              : "bg-slate-300 border-slate-100 dark:bg-slate-700 dark:border-slate-800"
                        }`} />
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-200 block truncate max-w-[130px]">{m.title}</span>
                            <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500 uppercase">{m.date}</span>
                          </div>
                          {m.progress > 0 && (
                            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                              <div className="bg-teal-500 h-full transition-all" style={{ width: `${m.progress}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* AI Strategy Suggestions Grid */}
          <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 space-y-3.5">
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-indigo-500" />
                <span>AI Prompt Blueprint Suggestions</span>
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Click any suggested command card to instantly execute inside workspace chat
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: "Review Master Services Agreement", desc: "Scan NDAs and terms sheets to detect high-risk policies or loopholes.", cat: "Legal & Compliance", prompt: "Perform a legal compliance risk analysis on our standard MSA document, highlighting payment terms, liability limits, and termination policies." },
                { title: "Formulate QBR Slide Strategic Points", desc: "Draft outline bullets and quantitative targets for quarterly business reviews.", cat: "Strategy & Finance", prompt: "Draft a QBR strategic performance framework detailing our operational milestones, key cost metrics, and predictive expansion targets." },
                { title: "Draft Employee Handbook Guide", desc: "Build onboarding sequences, benefits explanations, and compliance checklists.", cat: "HR & Talent", prompt: "Generate a complete structured onboarding syllabus checklist template for a remote engineering lead position." },
                { title: "Devise API Troubleshooting Runbook", desc: "Generate step-by-step diagnostic actions for connection problems.", cat: "IT Support", prompt: "Create a 5-step troubleshooting diagnostic checklist for addressing transient OAuth login timeouts and failed API token calls." }
              ].map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRunSuggestion(s.prompt)}
                  className="p-4 rounded-xl border border-slate-200/40 dark:border-slate-800/40 bg-slate-50/20 dark:bg-slate-950/20 text-left hover:border-indigo-500/30 transition-all cursor-pointer group flex items-start gap-3.5"
                >
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-500 shrink-0 group-hover:scale-105 transition-all">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">{s.cat}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-100 block mt-1 leading-tight group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                      {s.title}
                    </span>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-normal font-bold uppercase tracking-wider mt-0.5">
                      {s.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Right Side Column (Span 1) - Weather, Calendar, Tasks, Floating Widget info */}
        <div className="space-y-6">
          
          {/* Weather Widget */}
          <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/15 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center justify-between relative z-10 text-left">
              <div>
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                  Nexora HQ Node Location
                </span>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  San Francisco, CA
                </h3>
              </div>
              <CloudSun className="w-8 h-8 text-indigo-500 shrink-0" />
            </div>

            <div className="flex items-end gap-3 mt-4 relative z-10 text-left">
              <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">72°F</span>
              <div className="space-y-0.5 mb-1">
                <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 block">Mostly Sunny</span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase block tracking-wider">Humidity: 48% • Air Quality: Excellent</span>
              </div>
            </div>
          </div>

          {/* Mini Calendar Widget */}
          <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col relative">
            {/* Header */}
            <div className="flex items-center justify-between text-left">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Interactive Calendar
                  </h3>
                  <span className="text-[7px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black">
                    Zone: {timezone}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleJumpToToday}
                  className="px-2 py-0.5 text-[8px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md border border-indigo-200/50 dark:border-indigo-800/50 uppercase tracking-wider transition-all cursor-pointer"
                >
                  Today
                </button>
                <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider min-w-[75px] text-center">
                  {monthNames[displayMonth]} {displayYear}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800/40 pb-1.5">
              <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
            </div>
            
            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-600 dark:text-slate-400">
              {calendarGrid.map((cell, idx) => {
                const isCellToday = cell.dateStr === todayDateStr;
                const isCellSelected = cell.dateStr === selectedDateStr;
                
                // Get events for this cell
                const cellEvents = allMergedEvents.filter(e => e.date === cell.dateStr);
                
                return (
                  <button
                    key={`${cell.dateStr}-${idx}`}
                    onClick={() => {
                      setSelectedDateStr(cell.dateStr);
                      // Set default date in the form to the clicked day
                      setEventForm(prev => ({ ...prev, date: cell.dateStr }));
                    }}
                    className={`h-8 flex flex-col items-center justify-between p-1 rounded-xl transition-all cursor-pointer relative group
                      ${cell.isCurrentMonth ? "text-slate-800 dark:text-slate-200" : "text-slate-400/40 dark:text-slate-600/40"}
                      ${isCellToday ? "bg-indigo-600 text-white font-black shadow-md scale-105" : ""}
                      ${isCellSelected && !isCellToday ? "border border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-extrabold" : "hover:bg-slate-100 dark:hover:bg-slate-800/40"}
                    `}
                  >
                    <span className="text-[9px]">{cell.day}</span>
                    
                    {/* Event indicators dots */}
                    {cellEvents.length > 0 && (
                      <div className="flex gap-0.5 justify-center overflow-hidden max-w-full">
                        {cellEvents.slice(0, 3).map((ev, evIdx) => {
                          let dotColor = "bg-blue-500";
                          if (ev.source === "kanban") dotColor = "bg-emerald-500";
                          if (ev.source === "meeting") dotColor = "bg-purple-500";
                          if (ev.source === "dashboard") dotColor = "bg-amber-500";
                          return (
                            <span
                              key={`${ev.id}-${evIdx}`}
                              className={`w-1 h-1 rounded-full ${isCellToday ? "bg-white" : dotColor}`}
                            />
                          );
                        })}
                        {cellEvents.length > 3 && (
                          <span className={`text-[6px] leading-none ${isCellToday ? "text-white" : "text-indigo-500"}`}>+</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Date Header and List */}
            <div className="pt-3 border-t border-slate-150 dark:border-slate-850 space-y-2 text-left flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Schedule for {new Date(selectedDateStr + "T00:00:00").toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <button
                  onClick={() => {
                    setEventForm(prev => ({ ...prev, date: selectedDateStr }));
                    setIsAddEventOpen(true);
                  }}
                  className="px-2 py-0.5 text-[7px] font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Add Event</span>
                </button>
              </div>

              {/* Event Cards Scroll Area */}
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 flex-1">
                {selectedDayEvents.length > 0 ? (
                  selectedDayEvents.map(ev => {
                    let badgeColor = "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400";
                    let typeLabel = "Event";
                    
                    if (ev.source === "kanban") {
                      badgeColor = "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400";
                      typeLabel = "Kanban";
                    } else if (ev.source === "meeting") {
                      badgeColor = "border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-900/40 dark:bg-purple-950/20 dark:text-purple-400";
                      typeLabel = "Meeting";
                    } else if (ev.source === "dashboard") {
                      badgeColor = "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400";
                      typeLabel = "Task";
                    }

                    return (
                      <div
                        key={ev.id}
                        className="p-2.5 border border-slate-150 dark:border-slate-800/60 rounded-xl space-y-1 bg-slate-50/50 dark:bg-slate-950/10 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded-md text-[6px] font-black uppercase border tracking-widest ${badgeColor}`}>
                              {typeLabel}
                            </span>
                            {ev.priority && (
                              <span className={`text-[6px] font-black uppercase tracking-wider
                                ${ev.priority === "high" ? "text-rose-500" : ev.priority === "medium" ? "text-amber-500" : "text-slate-400"}
                              `}>
                                • {ev.priority}
                              </span>
                            )}
                            <span className="text-[7px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                              {ev.time}
                            </span>
                          </div>
                          
                          <h4 className={`text-[9px] font-extrabold text-slate-800 dark:text-slate-200 leading-tight truncate ${ev.completed ? "line-through opacity-50" : ""}`}>
                            {ev.title}
                          </h4>
                          
                          {ev.description && (
                            <p className="text-[8px] text-slate-400 dark:text-slate-500 font-medium leading-normal line-clamp-2">
                              {ev.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        {ev.source === "calendar" && (
                          <button
                            onClick={() => handleDeleteCalendarEvent(ev.id, ev.title)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer shrink-0"
                            title="Delete custom event"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-center opacity-65 flex flex-col items-center justify-center border border-dashed border-slate-150 dark:border-slate-850 rounded-xl">
                    <Calendar className="w-5 h-5 text-slate-300 dark:text-slate-700 mb-1" />
                    <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      No events or tasks scheduled
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Task Management Checklist */}
          <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between text-left">
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Tasks Checklist</span>
                </h3>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  {completedTasksCount} of {tasks.length} tasks completed ({taskProgressPercent}%)
                </p>
              </div>
            </div>

            {/* Task list progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${taskProgressPercent}%` }} />
            </div>

            {/* Simple Task Input Form */}
            <form onSubmit={handleAddTask} className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Schedule new task..."
                className="flex-1 min-w-0 px-3 py-1.5 text-[10px] bg-slate-150/40 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none font-bold"
              />
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as any)}
                className="px-1.5 py-1.5 text-[8px] font-black bg-slate-100 dark:bg-slate-800 border border-transparent rounded-xl outline-none uppercase text-slate-600 dark:text-slate-350"
              >
                <option value="low">Low</option>
                <option value="medium">Med</option>
                <option value="high">High</option>
              </select>
              <button
                type="submit"
                className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="space-y-2 max-h-56 overflow-y-auto pt-1 divide-y divide-slate-100 dark:divide-slate-850/40">
              {tasks.length > 0 ? (
                tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2.5 pt-2 first:pt-0">
                    <div className="flex items-start gap-2.5 text-left min-w-0 flex-1">
                      <button
                        onClick={() => handleToggleTask(t.id)}
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer mt-0.5 ${
                          t.completed 
                            ? "bg-emerald-500 border-emerald-500 text-white" 
                            : "border-slate-300 dark:border-slate-700 hover:border-indigo-500"
                        }`}
                      >
                        {t.completed && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                      <span className={`text-[10px] font-bold uppercase tracking-wide leading-normal truncate ${
                        t.completed ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300"
                      }`}>
                        {t.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider ${
                        t.priority === "high" 
                          ? "bg-red-500/10 text-red-500" 
                          : t.priority === "medium"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-slate-500/10 text-slate-400"
                      }`}>
                        {t.priority}
                      </span>
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="text-slate-400 hover:text-red-500 cursor-pointer p-0.5 rounded transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center opacity-65 flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-slate-300 dark:text-slate-700 mb-1" />
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Checklist Clear!</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Access Documents list sync panel */}
          <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-indigo-500" />
              <span>Workspace Archives</span>
            </h4>
            <div className="space-y-2">
              {docs.length > 0 ? (
                docs.slice(0, 3).map((d) => (
                  <div
                    key={d.id}
                    onClick={() => onSelectTab("docs")}
                    className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40 hover:border-indigo-500/20 bg-slate-50/20 dark:bg-slate-950/20 cursor-pointer transition-all flex items-center gap-2.5 text-left group"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 block truncate group-hover:text-indigo-500 transition-colors">
                        {d.name}
                      </span>
                      <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block">
                        {(d.content.length / 1024).toFixed(1)} KB • OCR sync
                      </span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-350 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                ))
              ) : (
                <div className="py-6 text-center opacity-65 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <FileText className="w-5 h-5 text-slate-300 dark:text-slate-700 mb-1" />
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Documents Ingested</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Dynamic Calendar Event Creation Modal */}
      <AnimatePresence>
        {isAddEventOpen && (
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl text-left space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span>Schedule Calendar Event</span>
                </h4>
                <button
                  onClick={() => setIsAddEventOpen(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateCalendarEvent} className="space-y-4 text-[10px]">
                <div>
                  <label className="block text-[8px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1">
                    Event Title
                  </label>
                  <input
                    type="text"
                    required
                    value={eventForm.title}
                    onChange={e => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Run Vector Embeddings Audit"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs font-bold text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Event Type
                    </label>
                    <select
                      value={eventForm.type}
                      onChange={e => setEventForm(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none uppercase font-bold text-[9px] text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="custom">Custom</option>
                      <option value="reminder">Reminder</option>
                      <option value="task">Task</option>
                      <option value="meeting">Meeting</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[8px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Priority Level
                    </label>
                    <select
                      value={eventForm.priority}
                      onChange={e => setEventForm(prev => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none uppercase font-bold text-[9px] text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-slate-455 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Date (YYYY-MM-DD)
                    </label>
                    <input
                      type="date"
                      required
                      value={eventForm.date}
                      onChange={e => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[8px] font-black text-slate-455 dark:text-slate-500 uppercase tracking-widest mb-1">
                      Time (HH:MM)
                    </label>
                    <input
                      type="time"
                      required
                      value={eventForm.time}
                      onChange={e => setEventForm(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[8px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-1">
                    Event Description
                  </label>
                  <textarea
                    value={eventForm.description}
                    onChange={e => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Provide details, deliverables, or checklist points..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs font-bold h-16 resize-none text-slate-800 dark:text-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Schedule</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Ambient AI Assistant */}
      <div className="fixed bottom-6 right-6 z-40">
        <AnimatePresence>
          {isFloatOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              className="absolute bottom-16 right-0 w-80 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col max-h-96 z-50 text-left"
            >
              {/* Float Header */}
              <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/10 rounded-lg">
                    <Sparkles className="w-4 h-4 text-white animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">Nexora Ambient Companion</h4>
                    <span className="text-[8px] text-white/70 block uppercase font-bold tracking-widest">Autonomous Micro-node</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsFloatOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer text-white/80 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Float Chat History */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 max-h-56 divide-y divide-slate-50 dark:divide-slate-850/30">
                {floatChatHistory.map((h, i) => (
                  <div key={i} className={`pt-2.5 first:pt-0 text-[10px] ${h.sender === "user" ? "text-right" : "text-left"}`}>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">
                      {h.sender === "user" ? "You" : "Nexora Buddy"}
                    </span>
                    <span className={`inline-block p-2.5 rounded-xl text-[10px] leading-relaxed max-w-[85%] font-medium whitespace-pre-wrap ${
                      h.sender === "user" 
                        ? "bg-indigo-600 text-white" 
                        : "bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200"
                    }`}>
                      {h.text}
                    </span>
                  </div>
                ))}
                {isFloatTyping && (
                  <div className="pt-2.5 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
              </div>

              {/* Float Input Form */}
              <form onSubmit={handleFloatSend} className="p-3 border-t border-slate-100 dark:border-slate-800/60 flex gap-1.5">
                <input
                  type="text"
                  value={floatMessage}
                  onChange={(e) => setFloatMessage(e.target.value)}
                  placeholder="Ask anything..."
                  className="flex-1 min-w-0 px-3 py-1.5 text-[10px] bg-slate-100 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none font-bold"
                />
                <button
                  type="submit"
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsFloatOpen(!isFloatOpen)}
          className="p-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:scale-105 active:scale-95 text-white rounded-full shadow-2xl cursor-pointer transition-all flex items-center justify-center relative group"
        >
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="absolute right-12 scale-0 group-hover:scale-100 transition-all bg-slate-900 text-white text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-md whitespace-nowrap">
            Ambient Buddy Assistant
          </span>
        </button>
      </div>

    </div>
  );
}
