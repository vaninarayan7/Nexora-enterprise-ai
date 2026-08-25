import React, { useState, useEffect } from "react";
import { 
  Mail, 
  Send, 
  Calendar, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  FileText, 
  User, 
  Plus, 
  ArrowRight,
  Sliders,
  Play,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile, ChatSession, EmailLog } from "../types";
import { saveEmailRecord, getEmailRecords } from "../lib/firebaseDb";

interface EmailAutomationProps {
  user: UserProfile | null;
  onLogin: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  triggerToast: (msg: string, type: "success" | "info" | "error") => void;
}

export default function EmailAutomation({
  user,
  onLogin,
  sessions,
  activeSessionId,
  triggerToast
}: EmailAutomationProps) {
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("Nexora Executive AI Digest & RAG Summary");
  const [selectedSessionId, setSelectedSessionId] = useState(activeSessionId);
  const [summaryLength, setSummaryLength] = useState<"brief" | "detailed" | "bullet">("detailed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Schedule state
  const [schedules, setSchedules] = useState([
    { id: "sch-1", type: "daily", time: "17:00", recipient: "leadership@enterprise.io", active: true },
    { id: "sch-2", type: "weekly", time: "Friday, 16:00", recipient: "audit-records@enterprise.io", active: false }
  ]);
  const [newScheduleRecipient, setNewScheduleRecipient] = useState("");
  const [newScheduleType, setNewScheduleType] = useState<"daily" | "weekly">("daily");
  const [newScheduleTime, setNewScheduleTime] = useState("17:00");

  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Fetch email logs from express backend or Firestore
  const fetchEmailLogs = async () => {
    setIsLoadingLogs(true);
    try {
      if (user) {
        if (!user.organizationId) return;
        const dbLogs = await getEmailRecords(user.uid, user.organizationId);
        if (dbLogs && dbLogs.length > 0) {
          const userLogs = dbLogs.filter(l => !l.userId || l.userId === user.uid);
          setEmailLogs(userLogs as any[]);
          setIsLoadingLogs(false);
          return;
        }
      }

      const res = await fetch("/api/email/logs");
      if (res.ok) {
        const data = await res.json();
        setEmailLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchEmailLogs();
    if (user?.email) {
      setRecipient(user.email);
    }
  }, [user]);

  // Create new dispatch schedule
  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleRecipient.trim()) {
      triggerToast("Recipient email is required for scheduling.", "error");
      return;
    }
    const newSch = {
      id: `sch-${Date.now()}`,
      type: newScheduleType,
      time: newScheduleType === "daily" ? newScheduleTime : `Friday, ${newScheduleTime}`,
      recipient: newScheduleRecipient,
      active: true
    };
    setSchedules(prev => [...prev, newSch]);
    setNewScheduleRecipient("");
    triggerToast(`Configured ${newScheduleType} email summary schedule.`, "success");
  };

  const toggleSchedule = (id: string) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
    triggerToast("Automation schedule state adjusted.", "info");
  };

  // Compile Gemini summary & dispatch via proxy endpoint
  const handleTriggerAutomation = async () => {
    if (!user || !user.token) {
      triggerToast("Please authenticate with Google to access Gmail dispatches.", "error");
      return;
    }
    if (!recipient.trim()) {
      triggerToast("Recipient email address is required.", "error");
      return;
    }

    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session || session.messages.length === 0) {
      triggerToast("Please select a discussion session with active chat history to summarize.", "error");
      return;
    }

    setIsGenerating(true);
    setIsSending(true);

    try {
      // Step 1: Request Gemini server summary based on selected discussion
      const summaryResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...session.messages,
            {
              role: "user",
              content: `Summarize our conversation logs above. Make it an enterprise executive briefing. Formatting style constraint: ${summaryLength}. Output must be styled cleanly in markdown with explicit bullet points or structured tables mapping KPIs.`
            }
          ],
          systemInstruction: "You are an elite corporate strategy advisor. Convert logs into high-value enterprise digests.",
          modelName: "gemini-3.6-flash",
          temperature: 0.3
        })
      });

      if (!summaryResponse.ok) {
        throw new Error("Failed to compile AI executive summary.");
      }

      const summaryData = await summaryResponse.json();
      const compiledMarkdown = summaryData.text;

      // Convert Markdown to clean simple HTML for email
      const compiledHtml = compiledMarkdown
        .replace(/### (.*?)\n/g, "<h4 style='color: #4f46e5; font-weight: 700; margin-top: 16px;'>$1</h4>")
        .replace(/## (.*?)\n/g, "<h3 style='color: #6366f1; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; font-weight: 800;'>$1</h3>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/^- (.*?)\n/g, "<li style='margin-left: 12px; font-size: 13px; color: #334155; margin-bottom: 6px;'>$1</li>")
        .replace(/\n/g, "<br/>");

      // Step 2: Push summary email dispatch to Gmail Relay proxy on server
      const emailResponse = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient,
          subject,
          body: `
            <div style="font-family: system-ui, sans-serif; padding: 5px;">
              <h2 style="color: #4f46e5; margin-top: 0; font-size: 22px; font-weight: 850; letter-spacing: -0.025em;">Nexora AI Grounded Digest</h2>
              <p style="font-size: 13px; color: #64748b; margin-top: -4px;">Discussion: <strong>${session.title}</strong> • Generated on ${new Date().toLocaleDateString()}</p>
              <div style="margin-top: 20px; font-size: 14px; line-height: 1.6; color: #1e293b;">
                ${compiledHtml}
              </div>
            </div>
          `,
          token: user.token,
          type: "summary"
        })
      });

      const emailData = await emailResponse.json();

      if (!emailResponse.ok) {
        if (user && emailData.log) {
          try {
            await saveEmailRecord({
              ...emailData.log,
              userId: user.uid
            });
          } catch (fErr) {
            console.error("Failed saving email failure log to Firestore:", fErr);
          }
        }
        throw new Error(emailData.error || "Failed to dispatch through Gmail Relay.");
      }

      if (user && emailData.log) {
        try {
          await saveEmailRecord({
            ...emailData.log,
            userId: user.uid
          });
        } catch (fErr) {
          console.error("Failed saving email success log to Firestore:", fErr);
        }
      }

      triggerToast("AI Executive Summary compiled and securely emailed via Gmail!", "success");
      fetchEmailLogs();
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "Failed email automation cycle.", "error");
      fetchEmailLogs();
    } finally {
      setIsGenerating(false);
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-transparent transition-colors text-left max-w-5xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-full">
              Relay Dispatch
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Mail className="w-6 h-6 text-indigo-500" />
            <span className="gemini-gradient-text">Nexora Email Automation</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Synthesize secure multi-document RAG summaries and dispatch automated updates via Gmail API.
          </p>
        </div>

        {/* Gmail OAuth Connection card */}
        <div className="p-3.5 rounded-20 border border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md flex items-center gap-3.5 max-w-md shadow-sm">
          {user ? (
            <>
              <div className="relative">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full border border-slate-100" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#111318]" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">{user.displayName}</span>
                  <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono">Gmail Sync</span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-mono">{user.email}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4.5 h-4.5 animate-pulse" />
              </div>
              <div className="text-left shrink-1">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest block mb-0.5">Gmail Offline</span>
                <button 
                  onClick={onLogin}
                  className="text-[10px] text-indigo-500 font-extrabold hover:underline flex items-center gap-1 cursor-pointer font-mono uppercase tracking-wider"
                >
                  Configure Auth <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Dispatcher form */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="glass-panel p-6 rounded-20 space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
              Grounded AI Summary Dispatcher
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recipient Input */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Target Recipient</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="e.g. leadership@enterprise.io"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-bold"
                  />
                </div>
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Email Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Q3 Strategic AI Digest"
                  className="w-full px-3.5 py-2.5 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Session thread selector */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Grounding Discussion Thread</label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-black cursor-pointer"
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.title} ({s.messages.length} msgs)</option>
                  ))}
                </select>
              </div>

              {/* Summary Layout Style */}
              <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Executive Formatting Template</label>
                <div className="flex gap-2.5">
                  {([
                    { id: "brief", label: "Brief" },
                    { id: "detailed", label: "Strategic" },
                    { id: "bullet", label: "Bullets" }
                  ] as const).map(style => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSummaryLength(style.id)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black border cursor-pointer transition-all uppercase tracking-wider ${
                        summaryLength === style.id
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-500 shadow-sm"
                          : "border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/60 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Automation launch CTA */}
            <div className="pt-2">
              <button
                onClick={handleTriggerAutomation}
                disabled={isSending || isGenerating || !user}
                className="w-full py-3 text-xs font-black rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-95 text-white shadow-lg shadow-indigo-500/15 cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Compiling Summary & Dispatching via Gmail...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Compile & Send Executive Summary</span>
                  </>
                )}
              </button>
              {!user && (
                <p className="text-[9px] text-amber-500 font-bold text-center mt-2.5 flex items-center justify-center gap-1 uppercase tracking-wider">
                  <AlertCircle className="w-3 h-3" /> Connect Google Workspace Account to enable email dispatch.
                </p>
              )}
            </div>
          </div>

          {/* Activity Logs */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                Dispatcher Activity Logs
              </h3>
              <button 
                onClick={fetchEmailLogs} 
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                title="Refresh Logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="space-y-3.5">
              <AnimatePresence mode="wait">
                {emailLogs.length === 0 ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-8 rounded-20 border border-dashed border-slate-200/50 dark:border-slate-800/50 text-center text-slate-400 text-xs font-bold uppercase tracking-wider"
                  >
                    No email automation logs recorded yet.
                  </motion.div>
                ) : (
                  <motion.div 
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3.5"
                  >
                    {emailLogs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4.5 rounded-20 border border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md hover:border-slate-350 dark:hover:border-slate-705 transition-all flex flex-col sm:flex-row justify-between gap-3 text-left"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              log.status === "success" 
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" 
                                : log.status === "pending"
                                  ? "bg-amber-500/15 text-amber-600"
                                  : "bg-red-500/15 text-red-600"
                            }`}>
                              {log.status}
                            </span>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">{log.subject}</span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                            Recipient: <span className="text-slate-700 dark:text-slate-300 font-mono">{log.recipient}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 italic font-medium mt-1">
                            "{log.body.replace(/<[^>]*>/g, '').substring(0, 100)}..."
                          </p>
                        </div>

                        <div className="flex flex-row sm:flex-col justify-between sm:items-end shrink-0 gap-1.5 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 dark:border-slate-800/40">
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1 font-bold">
                            <Clock className="w-3 h-3" />
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          {log.error && (
                            <span className="text-[9px] font-black text-red-500 flex items-center gap-0.5 uppercase tracking-wider">
                              <AlertCircle className="w-3 h-3" /> Error relaying
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* Right Column: Scheduled Automations */}
        <div className="space-y-6">
          
          <div className="glass-panel p-6 rounded-20 space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
              RAG Dispatch Schedules
            </h3>

            {/* Schedules list */}
            <div className="space-y-3.5">
              {schedules.map((sch) => (
                <div 
                  key={sch.id}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                    sch.active 
                      ? "border-indigo-500/30 bg-indigo-500/[0.03]" 
                      : "border-slate-200/50 dark:border-slate-800/50 bg-white/20 dark:bg-slate-900/10 opacity-60"
                  }`}
                >
                  <div className="text-left space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-black px-2 py-0.5 bg-slate-200/60 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 rounded-full uppercase tracking-widest font-mono">
                        {sch.type}
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">{sch.time}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold truncate">Recipient: {sch.recipient}</p>
                  </div>

                  {/* Toggle state */}
                  <button
                    onClick={() => toggleSchedule(sch.id)}
                    className="cursor-pointer text-indigo-500 hover:scale-105 transition-transform"
                  >
                    {sch.active ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-400" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Configure new schedule */}
            <form onSubmit={handleAddSchedule} className="space-y-3.5 pt-4 border-t border-slate-200/40 dark:border-slate-800/40 text-left">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">New Schedule Spec</span>
              
              <div className="space-y-2.5">
                <input
                  type="email"
                  value={newScheduleRecipient}
                  onChange={(e) => setNewScheduleRecipient(e.target.value)}
                  placeholder="Recipient email address"
                  className="w-full px-3.5 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-bold"
                />

                <div className="flex gap-2">
                  <select
                    value={newScheduleType}
                    onChange={(e) => setNewScheduleType(e.target.value as "daily" | "weekly")}
                    className="flex-1 px-3 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-black cursor-pointer"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>

                  <input
                    type="time"
                    value={newScheduleTime}
                    onChange={(e) => setNewScheduleTime(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-black"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-black rounded-xl border border-slate-200/50 dark:border-slate-800/50 hover:bg-white/40 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Summary Schedule
              </button>
            </form>
          </div>

          {/* Prompt automation criteria card */}
          <div className="p-5 rounded-20 border border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-[#111318]/20 space-y-3.5 text-left backdrop-blur-md">
            <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-500 animate-pulse" /> Custom Trigger Rules
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-bold uppercase tracking-wider">
              Nexora enterprise triggers support automatic dispatches when vector indexes sync or model temperature anomalies hit.
            </p>
            <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/80 border border-slate-200/40 dark:border-slate-800/50 text-[10px] text-slate-600 dark:text-slate-400 font-mono space-y-1">
              <div className="flex justify-between font-black">
                <span>Trigger #1: Accuracy anomaly</span>
                <span className="text-emerald-500">Active</span>
              </div>
              <p className="text-[9px] text-slate-400 dark:text-slate-500">If model helpfulness index falls below 98.5%, dispatch a high-priority diagnostic dump.</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
