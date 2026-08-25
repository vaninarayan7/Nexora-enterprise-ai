import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  Trash2, 
  CheckSquare, 
  Clock, 
  Users, 
  MessageSquare, 
  Calendar, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Flame, 
  TrendingUp, 
  UserPlus, 
  Send,
  AlertTriangle,
  Paperclip,
  History,
  Edit2,
  X,
  Upload,
  Activity,
  ChevronRight,
  FileText,
  BookOpen,
  RefreshCw,
  Loader2,
  Play,
  Download
} from "lucide-react";
import { KnowledgeDoc } from "../types";

export async function fetchWithBackoff(
  url: string,
  options: RequestInit = {},
  maxRetries = 4,
  baseDelay = 1000
): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        attempt++;
        if (attempt >= maxRetries) {
          return response;
        }
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
        console.warn(`Rate limited (429) on ${url}. Retrying attempt ${attempt}/${maxRetries} in ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        throw err;
      }
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 200;
      console.warn(`Fetch error on ${url}. Retrying attempt ${attempt}/${maxRetries} in ${Math.round(delay)}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Max retries reached for ${url}`);
}

interface TaskComment {
  id: string;
  user: string;
  text: string;
  timestamp: string;
}

interface TaskAttachment {
  id: string;
  name: string;
  size?: string;
  uploadedAt: string;
}

interface TaskActivity {
  id: string;
  text: string;
  timestamp: string;
}

interface SubTask {
  id: string;
  text: string;
  done: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "progress" | "review" | "completed";
  assignee: string;
  dueDate: string;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  activities?: TaskActivity[];
  checklist?: SubTask[];
  currentWork?: string;
  reviewComments?: string;
  aiReview?: string;
  qaResults?: string;
  finalOutput?: string;
  finalSummary?: string;
  completionDate?: string;
}

interface Comment {
  id: string;
  user: string;
  text: string;
  timestamp: string;
}

import { 
  getTasks, 
  saveTask, 
  deleteTaskDb 
} from "../lib/firebaseDb";
import { UserProfile } from "../types";

interface TaskWorkspaceProps {
  docs?: KnowledgeDoc[];
  user?: UserProfile | null;
}

export default function TaskWorkspace({ docs = [], user = null }: TaskWorkspaceProps) {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem("nexora-kanban-tasks");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [
      {
        id: "task-1",
        title: "Index Q2 SaaS Vector Embeddings",
        description: "Compile and chunk text and CSV records into standard vector databases for prompt grounding.",
        priority: "high",
        status: "todo",
        assignee: "Sophia Carter (RAG Expert)",
        dueDate: "2026-08-01",
        comments: [
          {
            id: "tc-1",
            user: "Sophia Carter (RAG Expert)",
            text: "Draft vector database indexing strategy is finalized. Preparing to chunk text and CSV records.",
            timestamp: "2026-07-28T10:00:00.000Z"
          }
        ],
        attachments: [
          {
            id: "att-1",
            name: "saas_retention_embeddings_v1.pdf",
            size: "4.2 MB",
            uploadedAt: "2026-07-28T09:30:00.000Z"
          }
        ],
        activities: [
          {
            id: "ta-1",
            text: "Task formulated by Admin.",
            timestamp: "2026-07-28T08:00:00.000Z"
          }
        ]
      },
      {
        id: "task-2",
        title: "Sync Gmail Automation Summary Dispatcher",
        description: "Test express email service dispatches on simulated user profiles and triggers.",
        priority: "medium",
        status: "progress",
        assignee: "Marcus Vance (Backend Officer)",
        dueDate: "2026-07-30",
        comments: [
          {
            id: "tc-2",
            user: "Marcus Vance (Backend Officer)",
            text: "Integration with active server dispatcher completes tonight. Pre-seeding Gmail automation drafts.",
            timestamp: "2026-07-28T11:00:00.000Z"
          }
        ],
        attachments: [],
        activities: [
          {
            id: "ta-2",
            text: "Status moved from TODO to PROGRESS.",
            timestamp: "2026-07-28T09:00:00.000Z"
          },
          {
            id: "ta-3",
            text: "Task formulated by Admin.",
            timestamp: "2026-07-28T08:00:00.000Z"
          }
        ]
      },
      {
        id: "task-3",
        title: "Audit HIPAA Compliance Compliance Filters",
        description: "Ensure legal compliance keys are activated inside custom HR assistant models.",
        priority: "high",
        status: "review",
        assignee: "Anya Moretti (Legal Counsel)",
        dueDate: "2026-07-28",
        comments: [],
        attachments: [
          {
            id: "att-2",
            name: "hipaa_compliance_checklist_v2.docx",
            size: "1.1 MB",
            uploadedAt: "2026-07-28T10:15:00.000Z"
          }
        ],
        activities: [
          {
            id: "ta-4",
            text: "Status moved from PROGRESS to REVIEW.",
            timestamp: "2026-07-28T10:30:00.000Z"
          },
          {
            id: "ta-5",
            text: "Task formulated by Admin.",
            timestamp: "2026-07-28T08:00:00.000Z"
          }
        ]
      },
      {
        id: "task-4",
        title: "Deploy V2 Nexora Frontend Node",
        description: "Bundle and publish compiled components to Cloud Run ingress layers.",
        priority: "low",
        status: "completed",
        assignee: "Leo Hudson (DevOps Lead)",
        dueDate: "2026-07-25",
        comments: [],
        attachments: [],
        activities: [
          {
            id: "ta-6",
            text: "Status moved from REVIEW to COMPLETED.",
            timestamp: "2026-07-28T11:45:00.000Z"
          },
          {
            id: "ta-7",
            text: "Task formulated by Admin.",
            timestamp: "2026-07-28T08:00:00.000Z"
          }
        ]
      }
    ];
  });

  const [comments, setComments] = useState<Comment[]>(() => {
    const saved = localStorage.getItem("nexora-kanban-comments");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [
      {
        id: "c-1",
        user: "Marcus Vance",
        text: "Draft email templates successfully pre-seeded. Awaiting vector confirmation from Sophia.",
        timestamp: "2026-07-27T04:22:00.000Z"
      },
      {
        id: "c-2",
        user: "Sophia Carter",
        text: "SaaS retention matrix vectors are now fully matching on-test. @Chief Analyst ready for audit.",
        timestamp: "2026-07-27T05:12:00.000Z"
      }
    ];
  });

  const [newCommentText, setNewCommentText] = useState("");

  // Sync state to LocalStorage
  React.useEffect(() => {
    localStorage.setItem("nexora-kanban-tasks", JSON.stringify(tasks));
  }, [tasks]);

  // Load tasks from Firestore on mount/user change
  React.useEffect(() => {
    const loadTasksFromDb = async () => {
      if (user) {
        if (!user.organizationId) return;
        try {
          const dbTasks = await getTasks(user.organizationId);
          if (dbTasks && dbTasks.length > 0) {
            setTasks(dbTasks as unknown as Task[]);
          } else {
            console.log("No real tasks exist in Kanban. Automatically seeding demo data...");
            // @ts-ignore
            if (window.seedDemoData) {
              // @ts-ignore
              await window.seedDemoData();
              // Refetch
              const seededTasks = await getTasks(user.organizationId);
              if (seededTasks && seededTasks.length > 0) {
                setTasks(seededTasks as unknown as Task[]);
              }
            }
          }
        } catch (err) {
          console.error("Failed to load tasks from Firestore:", err);
        }
      }
    };
    loadTasksFromDb();
  }, [user]);

  // Sync tasks changes to Firestore if user is logged in
  React.useEffect(() => {
    if (user && tasks.length > 0) {
      tasks.forEach(async (task) => {
        try {
          await saveTask(task);
        } catch (err) {
          console.error(`Failed to sync task ${task.id} to Firestore:`, err);
        }
      });
    }
  }, [tasks, user]);

  React.useEffect(() => {
    localStorage.setItem("nexora-kanban-comments", JSON.stringify(comments));
  }, [comments]);

  // Defensive upgrade: guarantee all tasks have the required checklist/subtask and custom fields initialized
  useEffect(() => {
    let upgraded = false;
    const nextTasks = tasks.map(t => {
      let changed = false;
      const updated = { ...t };
      
      // task-1 (todo) default checklist
      if (t.id === "task-1" && !t.checklist) {
        updated.checklist = [
          { id: "st-1", text: "Download raw Q2 logs", done: false },
          { id: "st-2", text: "Initialize vector database client", done: false },
          { id: "st-3", text: "Validate indexed record counts", done: false }
        ];
        changed = true;
      }
      // task-2 (progress) default checklist
      if (t.id === "task-2" && !t.checklist) {
        updated.checklist = [
          { id: "st-4", text: "Verify express endpoint mapping", done: true },
          { id: "st-5", text: "Pre-seed test profiles", done: false },
          { id: "st-6", text: "Inspect server logs for transit safety", done: false }
        ];
        if (!updated.currentWork) {
          updated.currentWork = "Draft email service dispatcher is integrated. Awaiting QA verification.";
        }
        changed = true;
      }
      // task-3 (review) default checklist
      if (t.id === "task-3" && !t.checklist) {
        updated.checklist = [
          { id: "st-7", text: "Check legal compliance parameters", done: true },
          { id: "st-8", text: "Review by Anya Moretti", done: true }
        ];
        if (!updated.currentWork) {
          updated.currentWork = "All compliance keys are successfully activated inside custom HR assistant models.";
        }
        if (!updated.reviewComments) {
          updated.reviewComments = "Awaiting final automated legal screening review.";
        }
        if (!updated.aiReview) {
          updated.aiReview = "### AI Compliance Evaluation:\nThe model alignment verification check indicates full conformance to HIPAA requirements. Technical audit results show that filters successfully drop PII from training cycles.";
        }
        if (!updated.qaResults) {
          updated.qaResults = "Passes QA automated checks. Memory footprint matches thresholds.";
        }
        changed = true;
      }
      // task-4 (completed) default checklist
      if (t.id === "task-4" && !t.checklist) {
        updated.checklist = [
          { id: "st-9", text: "Build frontend client", done: true },
          { id: "st-10", text: "Deploy to Cloud Run ingress layers", done: true }
        ];
        if (!updated.currentWork) {
          updated.currentWork = "Deploying V2 Nexora Frontend Node. Dist static files compiled successfully.";
        }
        if (!updated.finalOutput) {
          updated.finalOutput = "Successfully deployed and routed V2 Frontend Node. Live URL: https://nexora-v2.nexora-workspace.run";
        }
        if (!updated.finalSummary) {
          updated.finalSummary = "V2 Frontend Node has been deployed. Code bundle: frontend_v2_release.tar.gz. Total files: 1,412.";
        }
        if (!updated.completionDate) {
          updated.completionDate = "2026-07-28";
        }
        changed = true;
      }

      // Initialize empty checklists for custom-created tasks
      if (!updated.checklist) {
        updated.checklist = [];
        changed = true;
      }

      if (changed) upgraded = true;
      return updated;
    });

    if (upgraded) {
      setTasks(nextTasks);
    }
  }, [tasks]);

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeDragColumn, setActiveDragColumn] = useState<string | null>(null);
  const [touchState, setTouchState] = useState<{
    taskId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  
  // Create task modal & fields
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [taskAssignee, setTaskAssignee] = useState("Sophia Carter (RAG Expert)");
  const [taskDueDate, setTaskDueDate] = useState("2026-08-02");

  // Task Details States
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");
  const [editAssignee, setEditAssignee] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<"todo" | "progress" | "review" | "completed">("todo");
  const [detailTab, setDetailTab] = useState<"comments" | "attachments" | "activities">("comments");
  const [newTaskCommentText, setNewTaskCommentText] = useState("");

  // Stage-specific detail states
  const [currentWorkInput, setCurrentWorkInput] = useState("");
  const [reviewCommentsInput, setReviewCommentsInput] = useState("");
  const [qaResultsInput, setQaResultsInput] = useState("");
  const [newSubtaskInput, setNewSubtaskInput] = useState("");

  // AI Assistant in progress states
  const [aiAssistQuery, setAiAssistQuery] = useState("");
  const [aiAssistResponse, setAiAssistResponse] = useState("");
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);

  // Knowledge Base Integration States
  const [manualDocLinks, setManualDocLinks] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem("nexora-task-manual-doc-links");
    return saved ? JSON.parse(saved) : {};
  });

  interface DocSummary {
    summary: string;
    keyPoints: string;
    contentHash: string;
    isError?: boolean;
    isRateLimit?: boolean;
    errorMessage?: string;
  }

  const [docSummaries, setDocSummaries] = useState<Record<string, DocSummary>>(() => {
    const saved = localStorage.getItem("nexora-task-doc-summaries");
    return saved ? JSON.parse(saved) : {};
  });

  const pendingSummaryRequestsRef = React.useRef<Record<string, boolean>>({});

  const [summariesLoading, setSummariesLoading] = useState<Record<string, boolean>>({});
  const [aiQuestions, setAiQuestions] = useState<Record<string, string>>({});
  const [aiAnswers, setAiAnswers] = useState<Record<string, { answer: string; loading: boolean }>>({});
  const [viewingDoc, setViewingDoc] = useState<KnowledgeDoc | null>(null);

  useEffect(() => {
    localStorage.setItem("nexora-task-manual-doc-links", JSON.stringify(manualDocLinks));
  }, [manualDocLinks]);

  useEffect(() => {
    localStorage.setItem("nexora-task-doc-summaries", JSON.stringify(docSummaries));
  }, [docSummaries]);

  // AI Suggestions
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([
    "💡 Move 'Audit HIPAA Compliance Filters' to Completed. Security checks passed factuality evaluation audits.",
    "⚠️ Task 'Sync Gmail Automation Summary Dispatcher' is nearing due date. Re-assigning to Marcus Vance.",
    "⚡ Optimize Workspace layout: Sophia has 3 pending tasks; suggest delegating vector chunking tasks."
  ]);

  const teamMembers = [
    "Sophia Carter (RAG Expert)",
    "Marcus Vance (Backend Officer)",
    "Anya Moretti (Legal Counsel)",
    "Leo Hudson (DevOps Lead)",
    "Executive Guest (Local)"
  ];

  const addTaskActivity = (task: Task, text: string): Task => {
    const newActivity: TaskActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      timestamp: new Date().toISOString()
    };
    return {
      ...task,
      activities: [newActivity, ...(task.activities || [])]
    };
  };

  // Find referenced documents for the current task automatically
  const getReferencedDocs = (task: Task) => {
    if (!docs || docs.length === 0) return [];
    return docs.filter(doc => {
      const titleLower = task.title.toLowerCase();
      const descLower = task.description.toLowerCase();
      const docNameLower = doc.name.toLowerCase();
      const baseName = doc.name.split('.')[0].toLowerCase();
      
      // Match if title or description contains document name or base name
      const matchesName = titleLower.includes(docNameLower) || descLower.includes(docNameLower);
      const matchesBaseName = titleLower.includes(baseName) || descLower.includes(baseName);
      
      // Match by synonyms or keywords (e.g., saas_retention_metrics -> retention, metrics)
      const baseWords = baseName.split(/[_\-]/).filter(w => w.length > 3);
      const matchesKeywords = baseWords.length > 0 && baseWords.every(w => titleLower.includes(w) || descLower.includes(w));
      
      // Specialize for nexora_workspace_handbook -> "handbook", "employee handbook"
      const isHandbookRef = docNameLower.includes("handbook") && (titleLower.includes("handbook") || descLower.includes("handbook") || titleLower.includes("employee") || descLower.includes("employee"));
      
      // Check if task has attachments matching doc name
      const matchesAttachments = task.attachments?.some(att => 
        att.name.toLowerCase().includes(docNameLower) || docNameLower.includes(att.name.toLowerCase())
      );
      
      return matchesName || matchesBaseName || matchesKeywords || isHandbookRef || matchesAttachments;
    });
  };

  const handleFetchSummary = async (doc: KnowledgeDoc, force = false) => {
    const currentHash = `${doc.content.length}-${doc.content.substring(0, 100)}`;
    const cached = docSummaries[doc.id];
    
    if (!force && cached && cached.contentHash === currentHash && !cached.isError) {
      return; // Up to date
    }

    if (pendingSummaryRequestsRef.current[doc.id]) {
      return; // Deduplicate duplicate in-flight requests
    }
    pendingSummaryRequestsRef.current[doc.id] = true;
    
    setSummariesLoading(prev => ({ ...prev, [doc.id]: true }));
    try {
      const summaryRes = await fetchWithBackoff("/api/documents/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summarize", content: doc.content })
      });
      const summaryIsRateLimit = summaryRes.status === 429;
      const summaryData = await summaryRes.json();
      
      const extractRes = await fetchWithBackoff("/api/documents/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extract", content: doc.content })
      });
      const extractIsRateLimit = extractRes.status === 429;
      const extractData = await extractRes.json();
      
      const isError = !summaryData.success || !extractData.success || summaryIsRateLimit || extractIsRateLimit;
      const isRateLimit = summaryIsRateLimit || extractIsRateLimit || summaryData.isRateLimit || extractData.isRateLimit;

      if (!isError) {
        setDocSummaries(prev => ({
          ...prev,
          [doc.id]: {
            summary: summaryData.result,
            keyPoints: extractData.result,
            contentHash: currentHash,
            isError: false,
            isRateLimit: false
          }
        }));
      } else {
        const errMsg = summaryData.error || extractData.error || "Failed to process document summary requests.";
        setDocSummaries(prev => ({
          ...prev,
          [doc.id]: {
            summary: `⚠️ **AI Document Intelligence Error:**\n${errMsg}`,
            keyPoints: "Could not retrieve key points due to an execution error.",
            contentHash: currentHash,
            isError: true,
            isRateLimit,
            errorMessage: errMsg
          }
        }));
      }
    } catch (err: any) {
      console.error("Failed to generate document summary:", err);
      setDocSummaries(prev => ({
        ...prev,
        [doc.id]: {
          summary: `⚠️ **AI Document Intelligence Connection Error:**\n${err.message || "Failed to contact workspace intelligence gateway."}`,
          keyPoints: "Gateway communication failure.",
          contentHash: currentHash,
          isError: true,
          isRateLimit: false,
          errorMessage: err.message || "Connection failure."
        }
      }));
    } finally {
      pendingSummaryRequestsRef.current[doc.id] = false;
      setSummariesLoading(prev => ({ ...prev, [doc.id]: false }));
    }
  };

  const handleAskAI = async (doc: KnowledgeDoc) => {
    const query = aiQuestions[doc.id]?.trim();
    if (!query) return;
    
    setAiAnswers(prev => ({
      ...prev,
      [doc.id]: { answer: "", loading: true }
    }));
    
    try {
      const res = await fetch("/api/documents/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: doc.content,
          query: query,
          docName: doc.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiAnswers(prev => ({
          ...prev,
          [doc.id]: { answer: data.answer, loading: false }
        }));
      } else {
        setAiAnswers(prev => ({
          ...prev,
          [doc.id]: { answer: `### Error\nFailed to get an answer: ${data.error || "Unknown error"}`, loading: false }
        }));
      }
    } catch (err: any) {
      setAiAnswers(prev => ({
        ...prev,
        [doc.id]: { answer: `### Connection Error\n${err.message || "Failed to reach server."}`, loading: false }
      }));
    }
  };

  const handleLinkManualDoc = (taskId: string, docId: string) => {
    if (!docId) return;
    setManualDocLinks(prev => {
      const current = prev[taskId] || [];
      if (current.includes(docId)) return prev;
      return {
        ...prev,
        [taskId]: [...current, docId]
      };
    });
  };

  const handleUnlinkManualDoc = (taskId: string, docId: string) => {
    setManualDocLinks(prev => {
      const current = prev[taskId] || [];
      return {
        ...prev,
        [taskId]: current.filter(id => id !== docId)
      };
    });
  };

  // Trigger automatic summary generation on task selected
  useEffect(() => {
    if (!selectedTaskId) return;
    const task = tasks.find(t => t.id === selectedTaskId);
    if (!task) return;
    
    const matched = [
      ...getReferencedDocs(task),
      ...(docs.filter(d => manualDocLinks[task.id]?.includes(d.id)) || [])
    ];
    const uniqueMatched = Array.from(new Map(matched.map(d => [d.id, d])).values());
    
    uniqueMatched.forEach(doc => {
      handleFetchSummary(doc, false);
    });
  }, [selectedTaskId, docs, manualDocLinks]);

  const handleOpenDetails = (task: Task) => {
    setSelectedTaskId(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditPriority(task.priority);
    setEditAssignee(task.assignee);
    setEditDueDate(task.dueDate);
    setEditStatus(task.status);
    setIsEditingTask(false);
    setDetailTab("comments");
    
    // Synchronize workflow states
    setCurrentWorkInput(task.currentWork || "");
    setReviewCommentsInput(task.reviewComments || "");
    setQaResultsInput(task.qaResults || "");
    setNewSubtaskInput("");
    setAiAssistQuery("");
    setAiAssistResponse("");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedTaskId(null);
        setShowCreateModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: taskTitle,
      description: taskDesc,
      priority: taskPriority,
      status: "todo",
      assignee: taskAssignee,
      dueDate: taskDueDate,
      comments: [],
      attachments: [],
      activities: [
        {
          id: `ta-${Date.now()}`,
          text: "Task formulated by Admin.",
          timestamp: new Date().toISOString()
        }
      ]
    };

    setTasks(prev => [...prev, newTask]);
    setTaskTitle("");
    setTaskDesc("");
    setTaskPriority("medium");
    setShowCreateModal(false);
  };

  const handleMoveTask = (id: string, newStatus: "todo" | "progress" | "review" | "completed") => {
    let taskTitle = "";
    let oldStatus = "";

    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        taskTitle = t.title;
        oldStatus = t.status;
        let updated = { ...t, status: newStatus };
        
        // Complete dates and outputs when dropping directly to completed
        if (newStatus === "completed") {
          if (!updated.completionDate) {
            updated.completionDate = new Date().toLocaleDateString();
          }
          if (!updated.finalOutput) {
            updated.finalOutput = updated.currentWork || "No deliverables recorded.";
          }
        }

        updated = addTaskActivity(updated, `Status moved from ${t.status.toUpperCase()} to ${newStatus.toUpperCase()}`);
        return updated;
      }
      return t;
    }));
    
    // Add activity log to comments
    if (taskTitle) {
      const newLog: Comment = {
        id: `log-${Date.now()}`,
        user: "Nexora AI Monitor",
        text: `Moved task "${taskTitle}" from [${oldStatus.toUpperCase()}] to [${newStatus.toUpperCase()}].`,
        timestamp: new Date().toISOString()
      };
      setComments(prev => [newLog, ...prev]);
    }
  };

  const handleUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    setTasks(prev => prev.map(t => {
      if (t.id === selectedTaskId) {
        let updated = { 
          ...t, 
          title: editTitle,
          description: editDesc,
          priority: editPriority,
          assignee: editAssignee,
          dueDate: editDueDate,
          status: editStatus
        };
        // Compute changes for activity history
        let changeLogs: string[] = [];
        if (t.title !== editTitle) changeLogs.push(`Renamed title to "${editTitle}"`);
        if (t.description !== editDesc) changeLogs.push(`Updated description`);
        if (t.priority !== editPriority) changeLogs.push(`Priority changed to ${editPriority.toUpperCase()}`);
        if (t.assignee !== editAssignee) changeLogs.push(`Re-assigned to ${editAssignee}`);
        if (t.dueDate !== editDueDate) changeLogs.push(`Changed due date to ${editDueDate}`);
        if (t.status !== editStatus) changeLogs.push(`Changed status to ${editStatus.toUpperCase()}`);
        
        if (changeLogs.length > 0) {
          updated = addTaskActivity(updated, `Edited: ${changeLogs.join(", ")}`);
        }
        return updated;
      }
      return t;
    }));
    setIsEditingTask(false);
  };

  const handleAddTaskComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskCommentText.trim() || !selectedTaskId) return;

    const newComment: TaskComment = {
      id: `tc-${Date.now()}`,
      user: "Chief Analyst (You)",
      text: newTaskCommentText,
      timestamp: new Date().toISOString()
    };

    setTasks(prev => prev.map(t => {
      if (t.id === selectedTaskId) {
        const commentsList = t.comments || [];
        const updated = {
          ...t,
          comments: [newComment, ...commentsList]
        };
        return addTaskActivity(updated, `Added comment: "${newTaskCommentText.substring(0, 30)}${newTaskCommentText.length > 30 ? "..." : ""}"`);
      }
      return t;
    }));

    setNewTaskCommentText("");
  };

  const handleAddAttachment = (fileName: string, fileSize: string) => {
    if (!selectedTaskId) return;
    const newAttachment: TaskAttachment = {
      id: `att-${Date.now()}`,
      name: fileName,
      size: fileSize,
      uploadedAt: new Date().toISOString()
    };

    setTasks(prev => prev.map(t => {
      if (t.id === selectedTaskId) {
        const attachmentsList = t.attachments || [];
        const updated = {
          ...t,
          attachments: [newAttachment, ...attachmentsList]
        };
        return addTaskActivity(updated, `Attached file "${fileName}" (${fileSize})`);
      }
      return t;
    }));
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    if (!selectedTaskId) return;
    setTasks(prev => prev.map(t => {
      if (t.id === selectedTaskId) {
        const attachmentsList = t.attachments || [];
        const fileToDelete = attachmentsList.find(a => a.id === attachmentId);
        const updated = {
          ...t,
          attachments: attachmentsList.filter(a => a.id !== attachmentId)
        };
        return fileToDelete 
          ? addTaskActivity(updated, `Deleted attachment "${fileToDelete.name}"`)
          : updated;
      }
      return t;
    }));
  };

  // Desktop Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setActiveDragColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: "todo" | "progress" | "review" | "completed") => {
    e.preventDefault();
    setActiveDragColumn(colId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, colId: "todo" | "progress" | "review" | "completed") => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    if (taskId) {
      handleMoveTask(taskId, colId);
    }
    setDraggedTaskId(null);
    setActiveDragColumn(null);
  };

  // Mobile Touch handlers
  const handleTouchStart = (e: React.TouchEvent, taskId: string) => {
    const touch = e.touches[0];
    setTouchState({
      taskId,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
    });
    setDraggedTaskId(taskId);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchState) return;
    const touch = e.touches[0];
    setTouchState(prev => prev ? {
      ...prev,
      currentX: touch.clientX,
      currentY: touch.clientY,
    } : null);

    // Find elements under current touch point to highlight target column
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const columnElement = element?.closest("[data-column-id]");
    if (columnElement) {
      const colId = columnElement.getAttribute("data-column-id");
      setActiveDragColumn(colId);
    } else {
      setActiveDragColumn(null);
    }
  };

  const handleTouchEnd = () => {
    if (touchState) {
      if (activeDragColumn) {
        handleMoveTask(touchState.taskId, activeDragColumn as any);
      }
    }
    setTouchState(null);
    setDraggedTaskId(null);
    setActiveDragColumn(null);
  };

  const handleDeleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (user) {
      try {
        await deleteTaskDb(id);
      } catch (err) {
        console.error(`Failed to delete task ${id} from Firestore:`, err);
      }
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: Comment = {
      id: `c-${Date.now()}`,
      user: "Chief Analyst",
      text: newCommentText,
      timestamp: new Date().toISOString()
    };

    setComments(prev => [newComment, ...prev]);
    setNewCommentText("");
  };

  // ==========================================
  // STAGE-SPECIFIC WORKFLOW EVENT HANDLERS
  // ==========================================
  
  const handleStartTask = (task: Task) => {
    setTasks(prev => prev.map(t => {
      if (t.id === task.id) {
        let updated = { ...t, status: "progress" as const };
        updated = addTaskActivity(updated, "Task started. Status moved to IN PROGRESS.");
        return updated;
      }
      return t;
    }));
    // Sync local input states
    setCurrentWorkInput("");
    
    const newLog: Comment = {
      id: `log-${Date.now()}`,
      user: "Nexora AI Monitor",
      text: `Task "${task.title}" started. Status moved to IN PROGRESS.`,
      timestamp: new Date().toISOString()
    };
    setComments(prev => [newLog, ...prev]);
  };

  const handleToggleSubtask = (taskId: string, subTaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updatedChecklist = (t.checklist || []).map(st => 
          st.id === subTaskId ? { ...st, done: !st.done } : st
        );
        return { ...t, checklist: updatedChecklist };
      }
      return t;
    }));
  };

  const handleAddSubtask = (taskId: string) => {
    if (!newSubtaskInput.trim()) return;
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newItem = { id: `st-${Date.now()}`, text: newSubtaskInput.trim(), done: false };
        return { ...t, checklist: [...(t.checklist || []), newItem] };
      }
      return t;
    }));
    setNewSubtaskInput("");
  };

  const handleSaveProgress = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        let updated = { ...t, currentWork: currentWorkInput };
        updated = addTaskActivity(updated, "Saved current work progress.");
        return updated;
      }
      return t;
    }));
  };

  const handleMoveToReview = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        let updated = { 
          ...t, 
          status: "review" as const, 
          currentWork: currentWorkInput 
        };
        updated = addTaskActivity(updated, "Task work submitted. Status moved to UNDER REVIEW.");
        return updated;
      }
      return t;
    }));
  };

  const handleAiAssist = async (task: Task) => {
    if (!aiAssistQuery.trim()) return;
    setAiAssistLoading(true);
    setAiAssistResponse("");
    try {
      const matched = [
        ...getReferencedDocs(task),
        ...(docs.filter(d => manualDocLinks[task.id]?.includes(d.id)) || [])
      ];
      const uniqueMatched = Array.from(new Map(matched.map(d => [d.id, d])).values());

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: aiAssistQuery,
          personaPrompt: `You are Nexora AI Task Companion. Help the user accomplish this specific task: "${task.title}". Description: "${task.description}". Current work draft: "${currentWorkInput}". Assist them with suggestions, drafts, code snippets, or solutions. Keep the tone helpful, professional, and directly focused on the task.`,
          ragDocuments: uniqueMatched.map(d => ({ name: d.name, content: d.content })),
          modelName: "gemini-3.6-flash"
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiAssistResponse(data.text || data.response);
      } else {
        setAiAssistResponse(`Error: ${data.error || "Failed to obtain suggestions."}`);
      }
    } catch (err: any) {
      setAiAssistResponse(`Connection error: ${err.message || "Failed to contact helper."}`);
    } finally {
      setAiAssistLoading(false);
    }
  };

  const handleRunAiReview = async (task: Task) => {
    setAiReviewLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Evaluate the following work output against the task guidelines. 
Task Title: "${task.title}"
Task Description: "${task.description}"
Work Output:
"""
${task.currentWork || "No work output provided yet."}
"""

Provide:
1. Score out of 10.
2. Review evaluation notes.
3. List of suggested changes (if any).
Ensure the output is in clean Markdown format.`,
          personaPrompt: "You are the chief AI Technical Quality Auditor. Conduct an objective, comprehensive evaluation of the work output.",
          modelName: "gemini-3.6-flash"
        })
      });
      const data = await res.json();
      if (data.success) {
        const reviewText = data.text || data.response;
        setTasks(prev => prev.map(t => {
          if (t.id === task.id) {
            let updated = { ...t, aiReview: reviewText };
            updated = addTaskActivity(updated, "Generated automated AI review report.");
            return updated;
          }
          return t;
        }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setAiReviewLoading(false);
    }
  };

  const handleApproveCompleted = async (task: Task) => {
    // Save state and move status
    setTasks(prev => prev.map(t => {
      if (t.id === task.id) {
        let updated = { 
          ...t, 
          status: "completed" as const,
          reviewComments: reviewCommentsInput,
          qaResults: qaResultsInput,
          finalOutput: t.currentWork || "No work output compiled.",
          completionDate: new Date().toLocaleDateString()
        };
        updated = addTaskActivity(updated, "Task approved by QA & review team. Status moved to COMPLETED.");
        return updated;
      }
      return t;
    }));

    // Trigger asynchronous AI final summary generation
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Generate a 2-paragraph professional final executive wrap-up summary for the following completed task. Mention assignee, key achievements, and completion status.
Title: "${task.title}"
Output details: "${task.currentWork || "No output details."}"`,
          personaPrompt: "You are an executive summary writer. Write an elegant, summary briefing.",
          modelName: "gemini-3.6-flash"
        })
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => prev.map(t => {
          if (t.id === task.id) {
            return { ...t, finalSummary: data.text || data.response };
          }
          return t;
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestChanges = (task: Task) => {
    setTasks(prev => prev.map(t => {
      if (t.id === task.id) {
        let updated = { 
          ...t, 
          status: "progress" as const,
          reviewComments: reviewCommentsInput,
          qaResults: qaResultsInput
        };
        updated = addTaskActivity(updated, `Changes requested. Comments: "${reviewCommentsInput}". Moved back to IN PROGRESS.`);
        return updated;
      }
      return t;
    }));
  };

  const handleDownloadReport = (task: Task) => {
    const md = `# Nexora Task Completion Report
**Task Title:** ${task.title}
**Status:** Completed
**Assignee:** ${task.assignee}
**Completion Date:** ${task.completionDate || new Date().toLocaleDateString()}
**Priority:** ${task.priority.toUpperCase()}

## 1. Description
${task.description || "No description provided."}

## 2. Work Output / Final Deliverables
\`\`\`
${task.finalOutput || task.currentWork || "No deliverables recorded."}
\`\`\`

## 3. Executive AI Summary
${task.finalSummary || "Summary is pending or was not generated."}

## 4. Quality Evaluation & Comments
* **AI Review Report:** 
${task.aiReview || "No AI review run."}
* **Human Review Comments:** ${task.reviewComments || "None."}
* **QA Benchmarks & Results:** ${task.qaResults || "All tests passed successfully."}

## 5. Task Activity Timeline
${(task.activities || []).map(a => `* [${new Date(a.timestamp).toLocaleString()}] ${a.text}`).join("\n")}
`;

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${task.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_report.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns = [
    { id: "todo" as const, name: "To Do List", color: "border-slate-300 dark:border-slate-800" },
    { id: "progress" as const, name: "In Progress", color: "border-indigo-500/30" },
    { id: "review" as const, name: "Under Review", color: "border-amber-500/30" },
    { id: "completed" as const, name: "Completed", color: "border-emerald-500/30" }
  ];

  const getPriorityColor = (priority: "low" | "medium" | "high") => {
    switch (priority) {
      case "high": return "bg-red-500/15 text-red-500 border border-red-500/20";
      case "medium": return "bg-amber-500/15 text-amber-500 border border-amber-500/20";
      case "low": return "bg-blue-500/15 text-blue-500 border border-blue-500/20";
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#F8FAFC] dark:bg-[#0B0D13] p-4 md:p-6 overflow-hidden">
      
      {/* Team header area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0 text-left">
        <div>
          <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest font-mono">Team Collaboration Space</span>
          <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider -mt-1">Active Projects & Kanban Node</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Mock Avatars */}
          <div className="flex -space-x-2">
            {teamMembers.map((m, i) => (
              <div 
                key={i} 
                title={m}
                className={`w-7.5 h-7.5 rounded-full border border-white dark:border-slate-900 text-white flex items-center justify-center text-[10px] font-black cursor-pointer bg-gradient-to-tr ${
                  i % 3 === 0 ? "from-indigo-500 to-indigo-600" : i % 3 === 1 ? "from-purple-500 to-pink-500" : "from-teal-400 to-teal-500"
                }`}
              >
                {m.charAt(0)}
              </div>
            ))}
            <button className="w-7.5 h-7.5 rounded-full border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold hover:bg-slate-100 cursor-pointer">
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Formulate Task</span>
          </button>
        </div>
      </div>

      {/* Main Board Grid and Feed Splitter */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
        
        {/* Left Side: Kanban Board (Grid covering 3 cols) */}
        <div className="lg:col-span-3 min-h-0 flex flex-col gap-4 overflow-hidden">
          
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-y-auto pr-1">
            {columns.map((col) => {
              const colTasks = tasks.filter(t => t.status === col.id);
              const isCurrentOver = activeDragColumn === col.id;
              
              return (
                <div 
                  key={col.id}
                  data-column-id={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`flex flex-col min-h-[300px] rounded-2xl p-3 transition-all duration-200 ${
                    isCurrentOver 
                      ? "bg-indigo-50/60 dark:bg-indigo-950/25 border-2 border-indigo-500/50 scale-[1.01] shadow-md shadow-indigo-500/5" 
                      : "bg-slate-100/40 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/50"
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">{col.name}</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-200/50 dark:bg-slate-850 text-[9px] font-black text-slate-600 dark:text-slate-400">{colTasks.length}</span>
                    </div>
                  </div>

                  {/* Tasks list area */}
                  <div className="flex-1 space-y-3 overflow-y-auto min-h-0 text-left">
                    {colTasks.length > 0 ? (
                      colTasks.map((task) => {
                        const isTouchDragging = touchState && touchState.taskId === task.id;
                        return (
                          <motion.div
                            layout
                            key={task.id}
                            draggable={!touchState}
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            onTouchStart={(e) => handleTouchStart(e, task.id)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onClick={() => handleOpenDetails(task)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleOpenDetails(task);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Task: ${task.title}. Press Enter to view details.`}
                            whileHover={{ scale: isTouchDragging ? 1 : 1.01 }}
                            className={`p-3.5 rounded-xl bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative group cursor-pointer hover:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 select-none`}
                            style={{
                              touchAction: "none",
                              opacity: draggedTaskId === task.id ? 0.45 : 1,
                              ...(isTouchDragging ? {
                                transform: `translate(${touchState.currentX - touchState.startX}px, ${touchState.currentY - touchState.startY}px)`,
                                zIndex: 100,
                                position: "relative" as const,
                                pointerEvents: "none" as const,
                                boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.15)",
                              } : {})
                            }}
                          >
                            {/* Task Action Row */}
                            <div className="flex justify-between items-start gap-1">
                              <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </span>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task.id);
                                }}
                                className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded cursor-pointer opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <h4 className="text-xs font-extrabold text-slate-800 dark:text-white leading-snug uppercase tracking-tight mt-2 select-text">
                              {task.title}
                            </h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-1 font-medium select-text">
                              {task.description}
                            </p>

                            <div className="h-px bg-slate-100 dark:bg-slate-850/60 my-2.5" />

                            {/* Task details and simple flow buttons */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                <Users className="w-3 h-3" />
                                <span className="truncate">{task.assignee}</span>
                              </div>
                              
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-1 text-[8px] font-mono text-slate-400">
                                  <Clock className="w-3 h-3" />
                                  <span>{task.dueDate}</span>
                                </div>

                                {/* Simple move trigger icons to emulate drag & drop easily on any screen */}
                                <div className="flex gap-1">
                                  {col.id !== "todo" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const steps: Record<string, "todo" | "progress" | "review"> = { progress: "todo", review: "progress", completed: "review" };
                                        handleMoveTask(task.id, steps[col.id]);
                                      }}
                                      className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[8px] font-bold hover:bg-slate-100 text-slate-500 cursor-pointer"
                                      title="Move Back"
                                    >
                                      ←
                                    </button>
                                  )}
                                  {col.id !== "completed" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const steps: Record<string, "progress" | "review" | "completed"> = { todo: "progress", progress: "review", review: "completed" };
                                        handleMoveTask(task.id, steps[col.id]);
                                      }}
                                      className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-900 text-[8px] font-bold hover:bg-slate-100 text-indigo-500 cursor-pointer"
                                      title="Move Forward"
                                    >
                                      →
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : !isCurrentOver ? (
                      <div className="py-12 border border-dashed border-slate-200 dark:border-slate-850 rounded-xl flex flex-col items-center justify-center opacity-60 text-center">
                        <CheckSquare className="w-5 h-5 text-slate-300 dark:text-slate-700 mb-1.5" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Column Unassigned</span>
                      </div>
                    ) : null}

                    {isCurrentOver && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border-2 border-dashed border-indigo-500/35 rounded-xl h-24 flex flex-col items-center justify-center bg-indigo-500/[0.03] transition-colors"
                      >
                        <ArrowRight className="w-5 h-5 text-indigo-500/70 animate-bounce mb-1" />
                        <span className="text-[9px] font-black uppercase text-indigo-500/80 tracking-widest">Drop to Allocate</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Row: AI Task Suggestions block */}
          <div className="p-4 rounded-2xl border border-indigo-500/10 bg-indigo-500/[0.01] dark:bg-[#111318]/50 text-left shrink-0 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest font-mono">Workspace AI Optimizations</span>
              <div className="space-y-1.5 mt-1.5">
                {aiSuggestions.map((s, idx) => (
                  <p key={idx} className="text-[10px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed select-text">
                    {s}
                  </p>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Feed & Live Discussion Logging (Covering 1 col) */}
        <div className="rounded-2xl bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-850/60 p-4 flex flex-col min-h-0 text-left">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider">Comment Activity Feed</span>
          </div>

          {/* Comment submission form */}
          <form onSubmit={handlePostComment} className="mb-4 shrink-0 flex gap-2">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Post update... (@Sophia)"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 transition-all cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 min-h-0">
            {comments.map((comment) => {
              const isAi = comment.user === "Nexora AI Monitor";
              return (
                <div 
                  key={comment.id}
                  className={`p-3 rounded-xl border ${
                    isAi 
                      ? "border-indigo-500/10 bg-indigo-500/[0.02] text-indigo-600 dark:text-indigo-400"
                      : "border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider">{comment.user}</span>
                    <span className="text-[8px] font-mono text-slate-400">
                      {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed font-medium select-text">
                    {comment.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Task Creation Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-950"
            />
            
            <motion.div
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-left"
            >
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-1">Draft New Task</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-6">Allocate goals and timelines inside the sandbox</p>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Task Title</label>
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Audit compliance matrices..."
                    className="w-full px-4.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Details / Description</label>
                  <textarea
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    placeholder="Provide granular objectives here..."
                    className="w-full px-4.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium min-h-[60px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as any)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Due Date</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Assignee</label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100"
                  >
                    {teamMembers.map((m, idx) => (
                      <option key={idx} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:opacity-90"
                  >
                    Formulate
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Details Modals - Dedicated detail view rendered per column */}
      {columns.map(col => (
        <AnimatePresence key={col.id}>
          {selectedTaskId && (() => {
            const selectedTask = tasks.find(t => t.id === selectedTaskId);
            if (!selectedTask || selectedTask.status !== col.id) return null;
            
            const taskComments = selectedTask.comments || [];
            const taskAttachments = selectedTask.attachments || [];
            const taskActivities = selectedTask.activities || [];
            
            return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTaskId(null)}
                className="absolute inset-0 bg-slate-950"
              />
              
              <motion.div
                initial={{ scale: 0.93, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.93, opacity: 0 }}
                className="relative w-full max-w-4xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-left flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto"
              >
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedTaskId(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Left Side: Task Content or Editing Form */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                  {isEditingTask ? (
                    <form onSubmit={handleUpdateTask} className="space-y-4 flex flex-col h-full">
                      <div>
                        <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest font-mono">Editing Mode</span>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-3">Modify Task Parameters</h3>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Task Title</label>
                        <input
                          type="text"
                          required
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-4.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description</label>
                        <textarea
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full px-4.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium min-h-[100px]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Priority</label>
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value as any)}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status / Column</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as any)}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100"
                          >
                            <option value="todo">To Do</option>
                            <option value="progress">In Progress</option>
                            <option value="review">Under Review</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Due Date</label>
                          <input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="w-full px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Assignee</label>
                          <select
                            value={editAssignee}
                            onChange={(e) => setEditAssignee(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100"
                          >
                            {teamMembers.map((m, idx) => (
                              <option key={idx} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end mt-auto pt-6 border-t border-slate-100 dark:border-slate-850">
                        <button
                          type="button"
                          onClick={() => setIsEditingTask(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:opacity-90"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col h-full gap-5 text-left">
                      {/* Unified Title & Header */}
                      <div className="border-b border-slate-100 dark:border-slate-850/60 pb-3 flex items-center justify-between">
                        <div>
                          <span className="text-[8px] font-black uppercase text-indigo-500 tracking-widest font-mono px-2 py-0.5 rounded-md bg-indigo-500/10">
                            {selectedTask.status === "todo" ? "To Do" : selectedTask.status === "progress" ? "In Progress" : selectedTask.status === "review" ? "Under Review" : "Completed"}
                          </span>
                          <h2 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight mt-1 break-words">{selectedTask.title}</h2>
                        </div>
                        {selectedTask.status === "completed" && selectedTask.completionDate && (
                          <div className="text-right">
                            <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest font-mono block">Completed On</span>
                            <span className="text-[10px] font-bold text-slate-500">{selectedTask.completionDate}</span>
                          </div>
                        )}
                      </div>

                      {/* --- STAGE: TO DO --- */}
                      {selectedTask.status === "todo" && (
                        <div className="space-y-4 flex-1">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description</span>
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium break-words whitespace-pre-wrap">
                              {selectedTask.description || "No description provided."}
                            </div>
                          </div>

                          {/* Meta grid */}
                          <div className="grid grid-cols-3 gap-3 bg-slate-50/50 dark:bg-[#111318]/40 p-3.5 rounded-2xl border border-slate-100/80 dark:border-slate-900">
                            <div className="space-y-0.5">
                              <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Priority</span>
                              <div className="flex">
                                <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${getPriorityColor(selectedTask.priority)}`}>
                                  {selectedTask.priority}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Assignee</span>
                              <div className="text-[10px] text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                <span>{selectedTask.assignee}</span>
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Due Date</span>
                              <div className="text-[10px] text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{selectedTask.dueDate}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleStartTask(selectedTask)}
                            className="w-full py-3 rounded-2xl bg-indigo-500 text-white hover:bg-indigo-600 active:scale-[0.99] transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10"
                          >
                            <Play className="w-4 h-4 fill-white" />
                            <span>Start Task & Move to Progress</span>
                          </button>
                        </div>
                      )}

                      {/* --- STAGE: IN PROGRESS --- */}
                      {selectedTask.status === "progress" && (
                        <div className="space-y-4 flex-1 overflow-y-auto max-h-[480px] pr-1 scrollbar-thin">
                          {/* Overview Description */}
                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900">
                            <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Task Overview</span>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                              {selectedTask.description || "No description."}
                            </p>
                          </div>

                          {/* Checklist & Progress bar */}
                          {(() => {
                            const subtasks = selectedTask.checklist || [];
                            const doneCount = subtasks.filter(s => s.done).length;
                            const pct = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;
                            return (
                              <div className="border border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 p-4 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <CheckSquare className="w-4 h-4 text-indigo-500" />
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Subtask Milestones</span>
                                  </div>
                                  <span className="text-[9px] font-mono font-bold text-indigo-500">{doneCount}/{subtasks.length} Completed ({pct}%)</span>
                                </div>

                                {/* Progress bar */}
                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-500 transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>

                                {/* Checklist Items */}
                                <div className="space-y-2 pt-1.5">
                                  {subtasks.map(st => (
                                    <div 
                                      key={st.id} 
                                      onClick={() => handleToggleSubtask(selectedTask.id, st.id)}
                                      className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition-all border border-slate-50/50 dark:border-slate-950/20"
                                    >
                                      <input 
                                        type="checkbox"
                                        checked={st.done}
                                        readOnly
                                        className="rounded text-indigo-500 focus:ring-indigo-500 w-3.5 h-3.5"
                                      />
                                      <span className={`text-xs font-medium text-slate-700 dark:text-slate-300 ${st.done ? "line-through text-slate-400 dark:text-slate-500" : ""}`}>
                                        {st.text}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Add Subtask Input */}
                                <form 
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    handleAddSubtask(selectedTask.id);
                                  }}
                                  className="flex gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-900/50"
                                >
                                  <input 
                                    type="text"
                                    placeholder="Add custom milestone..."
                                    value={newSubtaskInput}
                                    onChange={(e) => setNewSubtaskInput(e.target.value)}
                                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[10px] focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium"
                                  />
                                  <button
                                    type="submit"
                                    className="px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 transition-all cursor-pointer text-[9px] font-black uppercase"
                                  >
                                    Add
                                  </button>
                                </form>
                              </div>
                            );
                          })()}

                          {/* Current Work Draft Input */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Active Draft / Work Output</span>
                              <span className="text-[8px] font-mono text-slate-400">Autosave input ready</span>
                            </div>
                            <textarea
                              value={currentWorkInput}
                              onChange={(e) => setCurrentWorkInput(e.target.value)}
                              placeholder="Describe your current work, paste deliverables, or code outputs here..."
                              className="w-full px-4.5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium min-h-[120px] font-mono"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveProgress(selectedTask.id)}
                                className="flex-1 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 transition-all font-black text-[9px] uppercase tracking-wider cursor-pointer"
                              >
                                Save Progress
                              </button>
                              <button
                                onClick={() => handleMoveToReview(selectedTask.id)}
                                className="flex-1 py-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-all font-black text-[9px] uppercase tracking-wider cursor-pointer"
                              >
                                Submit to Under Review
                              </button>
                            </div>
                          </div>

                          {/* Interactive AI Assistant */}
                          <div className="border border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-[#111318]/20 p-4 rounded-2xl space-y-3">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">Nexora Task Copilot</span>
                            </div>
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                placeholder="Ask Copilot for suggestions, drafts, or debug solutions..."
                                value={aiAssistQuery}
                                onChange={(e) => setAiAssistQuery(e.target.value)}
                                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium"
                              />
                              <button
                                onClick={() => handleAiAssist(selectedTask)}
                                disabled={aiAssistLoading || !aiAssistQuery.trim()}
                                className="px-4 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 font-black text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                              >
                                {aiAssistLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Generate"}
                              </button>
                            </div>

                            {/* Preset prompts buttons */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <button 
                                onClick={() => {
                                  setAiAssistQuery("Draft a structural outline for this task.");
                                  handleAiAssist(selectedTask);
                                }}
                                className="text-[8px] font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-all cursor-pointer"
                              >
                                Outline Task
                              </button>
                              <button 
                                onClick={() => {
                                  setAiAssistQuery("Suggest 3 key optimization ideas.");
                                  handleAiAssist(selectedTask);
                                }}
                                className="text-[8px] font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-all cursor-pointer"
                              >
                                Optimization Ideas
                              </button>
                            </div>

                            {aiAssistResponse && (
                              <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-900 space-y-2 mt-2">
                                <span className="text-[8px] font-mono text-slate-400 block uppercase font-bold">Suggested Deliverable Draft</span>
                                <div className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-mono select-all">
                                  {aiAssistResponse}
                                </div>
                                <button
                                  onClick={() => {
                                    setCurrentWorkInput(prev => prev ? `${prev}\n\n${aiAssistResponse}` : aiAssistResponse);
                                    setAiAssistResponse("");
                                  }}
                                  className="text-[8px] font-black uppercase tracking-wider text-indigo-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                                >
                                  Apply Draft to Active Work
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Knowledge Base Grounding */}
                          <div className="pt-2">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 font-mono">Grounding Assets</span>
                            {/* KB Grounding Panel Inlined */}
                            {(() => {
                              const matched = [
                                ...getReferencedDocs(selectedTask),
                                ...(docs.filter(d => manualDocLinks[selectedTask.id]?.includes(d.id)) || [])
                              ];
                              const uniqueMatched = Array.from(new Map(matched.map(d => [d.id, d])).values());
                              const unlinkedDocs = docs.filter(d => !uniqueMatched.some(m => m.id === d.id));

                              return (
                                <div className="space-y-3 mt-1 text-left bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-white">
                                      <BookOpen className="w-4 h-4 text-indigo-500" />
                                      <span className="text-[10px] font-black uppercase tracking-widest font-mono">Knowledge Base Grounding</span>
                                    </div>
                                    {uniqueMatched.length > 0 && (
                                      <span className="text-[8px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 font-bold">
                                        {uniqueMatched.length} connected
                                      </span>
                                    )}
                                  </div>

                                  {uniqueMatched.length > 0 ? (
                                    <div className="space-y-3">
                                      {uniqueMatched.map((doc) => {
                                        const loading = summariesLoading[doc.id];
                                        const cache = docSummaries[doc.id];
                                        const question = aiQuestions[doc.id] || "";
                                        const answerState = aiAnswers[doc.id];

                                        return (
                                          <div 
                                            key={doc.id} 
                                            className="border border-indigo-100/50 dark:border-indigo-950/40 bg-white dark:bg-slate-950 rounded-xl p-3.5 space-y-2"
                                          >
                                            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-50 dark:border-slate-900">
                                              <div className="flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                                <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">{doc.name}</h4>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <button
                                                  type="button"
                                                  onClick={() => handleFetchSummary(doc, true)}
                                                  disabled={loading}
                                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded"
                                                  title="Refresh Summary"
                                                >
                                                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-indigo-500" : ""}`} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleUnlinkManualDoc(selectedTask.id, doc.id)}
                                                  className="text-[8px] text-red-500 hover:bg-red-500/5 px-1.5 py-0.5 rounded"
                                                >
                                                  Unlink
                                                </button>
                                              </div>
                                            </div>

                                            {loading ? (
                                              <div className="flex items-center justify-center py-2 gap-1.5 text-[10px] text-slate-400 font-mono">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                                <span>Synthesizing...</span>
                                              </div>
                                            ) : cache ? (
                                              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal whitespace-pre-wrap">
                                                {cache.summary}
                                              </p>
                                            ) : (
                                              <p className="text-[9px] text-slate-400">No summary. Click refresh to query AI.</p>
                                            )}

                                            {/* Ask AI Mini */}
                                            <form 
                                              onSubmit={(e) => {
                                                e.preventDefault();
                                                handleAskAI(doc);
                                              }}
                                              className="flex gap-1.5 mt-2 pt-2 border-t border-slate-50 dark:border-slate-900"
                                            >
                                              <input 
                                                type="text"
                                                value={question}
                                                onChange={(e) => setAiQuestions(prev => ({ ...prev, [doc.id]: e.target.value }))}
                                                placeholder="Ask about this file..."
                                                className="flex-1 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded text-[10px] outline-none text-slate-700 dark:text-slate-300"
                                              />
                                              <button type="submit" className="px-2 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[9px] font-bold rounded">Ask</button>
                                            </form>
                                            {answerState && (
                                              <div className="mt-1.5 p-2 bg-slate-50 dark:bg-slate-900 rounded text-[9px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                                                {answerState.answer}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-center py-3 text-[10px] text-slate-400">No linked documents. Use the manual selector.</div>
                                  )}

                                  {unlinkedDocs.length > 0 && (
                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-indigo-500/10">
                                      <span className="text-[8px] font-black uppercase text-indigo-500 shrink-0">Link:</span>
                                      <select
                                        onChange={(e) => {
                                          handleLinkManualDoc(selectedTask.id, e.target.value);
                                          e.target.value = "";
                                        }}
                                        defaultValue=""
                                        className="flex-1 bg-white dark:bg-slate-950 text-[10px] rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-0.5"
                                      >
                                        <option value="" disabled>Select document...</option>
                                        {unlinkedDocs.map(doc => (
                                          <option key={doc.id} value={doc.id}>{doc.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* --- STAGE: UNDER REVIEW --- */}
                      {selectedTask.status === "review" && (
                        <div className="space-y-4 flex-1 overflow-y-auto max-h-[480px] pr-1">
                          {/* Deliverable details */}
                          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Submitted Deliverables</span>
                              <span className="text-[8px] font-mono text-slate-400">Read Only</span>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-900 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {selectedTask.currentWork || "No deliverables recorded."}
                            </div>
                          </div>

                          {/* AI Compliance Review Model Output */}
                          <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">AI Automated Quality Review</span>
                              </div>
                              <button 
                                onClick={() => handleRunAiReview(selectedTask)}
                                disabled={aiReviewLoading}
                                className="px-2.5 py-1 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 text-[8px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                              >
                                {aiReviewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Run Compliance AI"}
                              </button>
                            </div>

                            {selectedTask.aiReview ? (
                              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#111318] border border-slate-100 dark:border-slate-900/50 text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                                {selectedTask.aiReview}
                              </div>
                            ) : (
                              <div className="text-center py-4 bg-slate-50/50 dark:bg-slate-950/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <span className="text-[10px] text-slate-400">No compliance evaluation generated yet. Click above to execute.</span>
                              </div>
                            )}
                          </div>

                          {/* Quality Review & Verification Input Form */}
                          <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-950/5 space-y-3">
                            <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block font-mono">Reviewer Checkpoint & Feedback</span>

                            <div className="space-y-1">
                              <label className="text-[8px] font-mono uppercase text-slate-400 font-bold">QA Benchmarks & Results</label>
                              <input 
                                type="text"
                                placeholder="e.g., Passes unit testing. Coverage at 94.2%."
                                value={qaResultsInput}
                                onChange={(e) => setQaResultsInput(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 font-medium font-mono"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[8px] font-mono uppercase text-slate-400 font-bold">Review Comments</label>
                              <textarea 
                                placeholder="Add human compliance comments or required modifications..."
                                value={reviewCommentsInput}
                                onChange={(e) => setReviewCommentsInput(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 font-medium min-h-[60px]"
                              />
                            </div>

                            <div className="flex gap-2 pt-1.5">
                              <button
                                onClick={() => handleRequestChanges(selectedTask)}
                                className="flex-1 py-2 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/5 font-black text-[9px] uppercase tracking-wider cursor-pointer"
                              >
                                Request Changes & Revert
                              </button>
                              <button
                                onClick={() => handleApproveCompleted(selectedTask)}
                                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider cursor-pointer"
                              >
                                Approve & Complete Task
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* --- STAGE: COMPLETED --- */}
                      {selectedTask.status === "completed" && (
                        <div className="space-y-4 flex-1 overflow-y-auto max-h-[480px] pr-1">
                          {/* Final Deliverables summary */}
                          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                            <span className="text-[9px] font-black uppercase text-emerald-500 tracking-wider block">Final Approved Deliverables</span>
                            <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-900 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                              {selectedTask.finalOutput || selectedTask.currentWork || "No deliverables recorded."}
                            </div>
                          </div>

                          {/* Executive summary */}
                          {selectedTask.finalSummary && (
                            <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 space-y-1.5">
                              <span className="text-[9px] font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider block">Executive Delivery Summary</span>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                {selectedTask.finalSummary}
                              </p>
                            </div>
                          )}

                          {/* Review Audits Log */}
                          <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 space-y-2.5">
                            <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block font-mono">Audit History & Quality Evaluation</span>
                            
                            {selectedTask.qaResults && (
                              <div className="text-xs">
                                <span className="font-bold text-slate-700 dark:text-slate-300 block font-mono">QA Benchmark Output:</span>
                                <span className="text-slate-500 dark:text-slate-400 leading-normal">{selectedTask.qaResults}</span>
                              </div>
                            )}

                            {selectedTask.reviewComments && (
                              <div className="text-xs">
                                <span className="font-bold text-slate-700 dark:text-slate-300 block">Reviewer Feedback:</span>
                                <span className="text-slate-500 dark:text-slate-400 leading-normal">{selectedTask.reviewComments}</span>
                              </div>
                            )}

                            <button
                              onClick={() => handleDownloadReport(selectedTask)}
                              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                              <span>Download Complete Workspace Report (.md)</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Global Action Footer */}
                      <div className="flex gap-3 justify-start mt-auto pt-4 border-t border-slate-100 dark:border-slate-850">
                        <button
                          onClick={() => setIsEditingTask(true)}
                          className="px-4.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit Parameters</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this task?")) {
                              handleDeleteTask(selectedTask.id);
                              setSelectedTaskId(null);
                            }
                          }}
                          className="px-4 py-2 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side Column: Tab bar and Tabs contents (Comments, Attachments, Activity) */}
                <div className="w-full md:w-[350px] border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-850 pt-6 md:pt-0 md:pl-6 flex flex-col max-h-[480px] md:max-h-none">
                  {/* Tabs Selector */}
                  <div className="flex border-b border-slate-100 dark:border-slate-850 mb-4 pb-0.5 shrink-0 gap-2">
                    <button
                      onClick={() => setDetailTab("comments")}
                      className={`pb-2 text-[9px] font-black uppercase tracking-wider relative transition-colors cursor-pointer px-1 ${
                        detailTab === "comments" 
                          ? "text-slate-800 dark:text-white" 
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      Comments ({taskComments.length})
                      {detailTab === "comments" && (
                        <motion.div layoutId="tabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setDetailTab("attachments")}
                      className={`pb-2 text-[9px] font-black uppercase tracking-wider relative transition-colors cursor-pointer px-1 ${
                        detailTab === "attachments" 
                          ? "text-slate-800 dark:text-white" 
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      Files ({taskAttachments.length})
                      {detailTab === "attachments" && (
                        <motion.div layoutId="tabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setDetailTab("activities")}
                      className={`pb-2 text-[9px] font-black uppercase tracking-wider relative transition-colors cursor-pointer px-1 ${
                        detailTab === "activities" 
                          ? "text-slate-800 dark:text-white" 
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      History ({taskActivities.length})
                      {detailTab === "activities" && (
                        <motion.div layoutId="tabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
                      )}
                    </button>
                  </div>

                  {/* Tabs Content Areas */}
                  <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
                    {detailTab === "comments" && (
                      <div className="flex flex-col h-full">
                        {/* Comments input */}
                        <form onSubmit={handleAddTaskComment} className="flex gap-2 mb-3 shrink-0">
                          <input
                            type="text"
                            required
                            value={newTaskCommentText}
                            onChange={(e) => setNewTaskCommentText(e.target.value)}
                            placeholder="Add clear feedback..."
                            className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[10px] focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium"
                          />
                          <button
                            type="submit"
                            className="px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 transition-all cursor-pointer text-[10px] font-black uppercase"
                          >
                            Send
                          </button>
                        </form>

                        {/* Comments List */}
                        <div className="space-y-3 flex-1 overflow-y-auto">
                          {taskComments.length > 0 ? (
                            taskComments.map((comment) => (
                              <div 
                                key={comment.id}
                                className="p-3 rounded-xl border border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 text-slate-600 dark:text-slate-300 text-left"
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[9px] font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider truncate max-w-[150px]">{comment.user}</span>
                                  <span className="text-[8px] font-mono text-slate-400">
                                    {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-[10px] leading-relaxed font-medium break-words">
                                  {comment.text}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                              No comments yet.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {detailTab === "attachments" && (
                      <div className="space-y-3 h-full flex flex-col">
                        {/* File Upload Zone */}
                        <div 
                          className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-50/30 dark:bg-slate-950/10 shrink-0 relative"
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const files = e.dataTransfer.files;
                            if (files && files.length > 0) {
                              const f = files[0];
                              const sizeStr = f.size > 1024 * 1024 
                                ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` 
                                : `${(f.size / 1024).toFixed(0)} KB`;
                              handleAddAttachment(f.name, sizeStr);
                            }
                          }}
                          onClick={() => {
                            const fileInput = document.getElementById("task-details-file-input");
                            if (fileInput) fileInput.click();
                          }}
                        >
                          <input 
                            id="task-details-file-input"
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                const f = files[0];
                                const sizeStr = f.size > 1024 * 1024 
                                  ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` 
                                  : `${(f.size / 1024).toFixed(0)} KB`;
                                handleAddAttachment(f.name, sizeStr);
                              }
                            }}
                          />
                          <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                          <span className="block text-[9px] font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">Drag & Drop or Select File</span>
                          <span className="block text-[8px] text-slate-400 mt-0.5 uppercase font-mono">Max size 25MB</span>
                        </div>

                        {/* Attachments list */}
                        <div className="space-y-2 flex-1 overflow-y-auto">
                          {taskAttachments.length > 0 ? (
                            taskAttachments.map((file) => (
                              <div 
                                key={file.id}
                                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950/40"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <div className="text-left min-w-0">
                                    <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 truncate max-w-[140px] uppercase tracking-wide leading-tight" title={file.name}>
                                      {file.name}
                                    </p>
                                    <p className="text-[8px] font-mono text-slate-400 mt-0.5 uppercase">
                                      {file.size || "Unknown Size"}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAttachment(file.id);
                                  }}
                                  className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer font-extrabold"
                                  title="Delete attachment"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                              No files attached.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {detailTab === "activities" && (
                      <div className="space-y-4 text-left">
                        {taskActivities.length > 0 ? (
                          <div className="relative border-l border-slate-100 dark:border-slate-850 pl-3 ml-2.5 space-y-4 py-1">
                            {taskActivities.map((act) => (
                              <div key={act.id} className="relative">
                                {/* Timeline Bullet icon */}
                                <div className="absolute -left-[17px] top-0.5 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white dark:border-[#111318]" />
                                <div className="text-left">
                                  <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono leading-none">
                                    {new Date(act.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </p>
                                  <p className="text-[10px] text-slate-700 dark:text-slate-200 font-extrabold leading-normal mt-0.5 break-words">
                                    {act.text}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                            No activities logged yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
        </AnimatePresence>
      ))}

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {viewingDoc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingDoc(null)}
              className="absolute inset-0 bg-slate-950"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <button
                onClick={() => setViewingDoc(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                title="Close Document Viewer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-850 pb-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">{viewingDoc.name}</h3>
                  <span className="text-[9px] font-mono text-slate-400">Knowledge Base Source Document</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 p-5 text-left text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans">
                {viewingDoc.content}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-850 mt-4 shrink-0">
                <button
                  onClick={() => setViewingDoc(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:opacity-90 transition-all"
                >
                  Close Viewer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
