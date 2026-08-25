import React, { useState, useEffect, useRef } from "react";
import {
  Mail, Send, Sparkles, AlertCircle, Clock, RefreshCw,
  FileText, User, X, ChevronDown, ChevronUp, Trash2,
  Save, Eye, EyeOff, Copy, Edit3, Inbox, Archive,
  PenLine, LayoutTemplate, Search, Tag, Paperclip,
  AtSign, RotateCcw, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  DbEmailRecord, DbEmailTemplate,
  saveDraft, getDrafts, deleteDraftDb,
  saveSentEmail, getSentEmails,
  saveEmailTemplate, getEmailTemplates, deleteEmailTemplate
} from "../lib/firebaseDb";
import { UserProfile, KnowledgeDoc } from "../types";
import { googleSignInWithGmailScopes, getGmailAccessToken, getGmailRefreshToken, clearGmailAccessToken } from "../lib/firebaseAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab = "compose" | "sent" | "drafts" | "templates";

interface TagChipInputProps {
  label: string;
  placeholder: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  icon?: React.ReactNode;
  required?: boolean;
}

interface EmailAssistantProps {
  user: UserProfile | null;
  onLogin: () => void;
  docs: KnowledgeDoc[];
  triggerToast: (msg: string, type: "success" | "info" | "error") => void;
}

// ── Built-in Email Templates ──────────────────────────────────────────────────
const BUILTIN_TEMPLATES: DbEmailTemplate[] = [
  {
    id: "tpl-builtin-1",
    name: "Executive Summary",
    subject: "Executive AI Digest — {{date}}",
    body: `Dear {{name}},\n\nPlease find below the executive summary for this period:\n\n{{summary}}\n\nKey Highlights:\n• {{highlight_1}}\n• {{highlight_2}}\n• {{highlight_3}}\n\nAction Items:\n{{action_items}}\n\nBest regards,\n{{sender}}`,
    category: "Report",
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "tpl-builtin-2",
    name: "Meeting Follow-Up",
    subject: "Meeting Follow-Up: {{meeting_title}}",
    body: `Hi {{name}},\n\nThank you for attending today's meeting. Here is a quick recap:\n\nDecisions Made:\n{{decisions}}\n\nAction Items:\n{{action_items}}\n\nNext Meeting: {{next_meeting}}\n\nBest,\n{{sender}}`,
    category: "Meeting",
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "tpl-builtin-3",
    name: "Project Status Update",
    subject: "Project Update: {{project_name}}",
    body: `Hi Team,\n\nHere is the latest update on {{project_name}}:\n\nStatus: {{status}}\nProgress: {{progress}}%\n\nCompleted this week:\n{{completed}}\n\nUpcoming:\n{{upcoming}}\n\nBlockers:\n{{blockers}}\n\nRegards,\n{{sender}}`,
    category: "Project",
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "tpl-builtin-4",
    name: "Client Onboarding",
    subject: "Welcome to {{company_name}}!",
    body: `Dear {{client_name}},\n\nWelcome aboard! We are thrilled to have you as a client.\n\nYour account is now active. Here are your next steps:\n\n1. {{step_1}}\n2. {{step_2}}\n3. {{step_3}}\n\nYour dedicated account manager is: {{account_manager}}\nContact: {{contact_email}}\n\nDo not hesitate to reach out with any questions.\n\nWarm regards,\n{{sender}}`,
    category: "General",
    createdAt: new Date(0).toISOString(),
  },
];

// ── TagChipInput ──────────────────────────────────────────────────────────────
function TagChipInput({ label, placeholder, tags, onChange, icon, required }: TagChipInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (value: string) => {
    const emails = value.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes("@"));
    if (emails.length > 0) {
      onChange([...new Set([...tags, ...emails])]);
      setInputValue("");
    }
  };

  const removeTag = (index: number) => onChange(tags.filter((_, i) => i !== index));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", ";"].includes(e.key)) { e.preventDefault(); addTag(inputValue); }
    else if (e.key === "Backspace" && !inputValue && tags.length > 0) removeTag(tags.length - 1);
  };

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
        {icon}{label}{required && <span className="text-red-400">*</span>}
      </label>
      <div
        onClick={() => inputRef.current?.focus()}
        className="min-h-[38px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 focus-within:border-indigo-500/50 transition cursor-text"
      >
        {tags.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full">
            {tag}
            <button type="button" onClick={e => { e.stopPropagation(); removeTag(i); }} className="hover:text-red-500 transition cursor-pointer">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[140px] bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none"
        />
      </div>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    draft:   "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    pending: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    failed:  "bg-red-500/10 text-red-500 border-red-500/30",
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[status] || "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"}`}>
      {status}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EmailAssistant({ user, onLogin, docs, triggerToast }: EmailAssistantProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("compose");

  // Compose state
  const [toEmails, setToEmails]     = useState<string[]>([]);
  const [ccEmails, setCcEmails]     = useState<string[]>([]);
  const [bccEmails, setBccEmails]   = useState<string[]>([]);
  const [showCcBcc, setShowCcBcc]   = useState(false);
  const [subject, setSubject]       = useState("");
  const [body, setBody]             = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // AI draft state
  const [aiPrompt, setAiPrompt]         = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiPanel, setShowAiPanel]   = useState(true);

  // Document attachment
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showDocPicker, setShowDocPicker]   = useState(false);

  // Send / save state
  const [isSending, setIsSending]       = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Template dialog
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName]         = useState("");
  const [templateCategory, setTemplateCategory] = useState("General");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Sent tab
  const [sentEmails, setSentEmails]   = useState<DbEmailRecord[]>([]);
  const [isLoadingSent, setIsLoadingSent] = useState(false);
  const [expandedSent, setExpandedSent]   = useState<string | null>(null);
  const [sentSearch, setSentSearch]       = useState("");

  // Drafts tab
  const [drafts, setDrafts]               = useState<DbEmailRecord[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);

  // Templates tab
  const [userTemplates, setUserTemplates]   = useState<DbEmailTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  useEffect(() => {
    if (activeTab === "sent")      loadSent();
    else if (activeTab === "drafts")    loadDrafts();
    else if (activeTab === "templates") loadTemplates();
  }, [activeTab, user]);

  const loadSent = async () => {
    if (!user || !user.organizationId) return;
    setIsLoadingSent(true);
    try {
      const records = await getSentEmails(user.uid, user.organizationId);
      setSentEmails(records);
    } catch (err) {
      console.error("[EmailAssistant] loadSent error:", err);
    } finally { setIsLoadingSent(false); }
  };

  const loadDrafts = async () => {
    if (!user || !user.organizationId) return;
    setIsLoadingDrafts(true);
    try {
      const results = await getDrafts(user.uid, user.organizationId);
      setDrafts(results);
    } catch (err) {
      console.error("[EmailAssistant] loadDrafts error:", err);
    } finally { setIsLoadingDrafts(false); }
  };

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const userTpls = (user && user.organizationId) ? await getEmailTemplates(user.uid, user.organizationId) : [];
      setUserTemplates([...userTpls, ...BUILTIN_TEMPLATES]);
    } catch { setUserTemplates(BUILTIN_TEMPLATES); } finally { setIsLoadingTemplates(false); }
  };

  const [isConnectingGmail, setIsConnectingGmail] = useState(false);

  const handleConnectGmail = async () => {
    setIsConnectingGmail(true);
    try {
      const res = await googleSignInWithGmailScopes();
      if (res) {
        triggerToast("Gmail integration authorized successfully!", "success");
      }
    } catch (e: any) {
      triggerToast(e.message || "Failed to authorize Gmail.", "error");
    } finally {
      setIsConnectingGmail(false);
    }
  };

  // ── AI generate ─────────────────────────────────────────────────────────────
  const handleGenerateDraft = async () => {
    if (!aiPrompt.trim()) { triggerToast("Describe what you want to say.", "error"); return; }
    setIsGenerating(true);
    try {
      const docContext = selectedDocIds.length > 0
        ? "\n\nContext from attached documents:\n" +
          docs.filter(d => selectedDocIds.includes(d.id))
              .map(d => `[${d.name}]: ${(d.content || "").slice(0, 800)}`)
              .join("\n---\n")
        : "";

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Write a professional business email:\n\n${aiPrompt}${docContext}\n\nOutput only the email body. Professional tone.` }],
          modelName: "gemini-2.0-flash",
          systemInstruction: "You are an expert business email writer. Output only the email body — no headers."
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBody(data.text || data.content || "");
        if (!subject) setSubject(aiPrompt.split(" ").slice(0, 5).join(" ").replace(/^\w/, c => c.toUpperCase()));
        triggerToast("AI draft generated!", "success");
        setShowAiPanel(false);
      } else { triggerToast("AI generation failed.", "error"); }
    } catch (e: any) { triggerToast(e.message || "AI error.", "error"); }
    finally { setIsGenerating(false); }
  };

  // ── Send ──────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!user) { onLogin(); return; }
    if (!toEmails.length) { triggerToast("Add at least one recipient.", "error"); return; }
    if (!subject.trim()) { triggerToast("Subject is required.", "error"); return; }
    if (!body.trim())    { triggerToast("Email body is required.", "error"); return; }

    let token = getGmailAccessToken();
    let refreshToken = getGmailRefreshToken();

    if (!token) {
      triggerToast("Gmail authorization expired or missing. Reconnecting...", "info");
      try {
        const res = await googleSignInWithGmailScopes();
        if (res) {
          token = res.accessToken;
          refreshToken = getGmailRefreshToken();
          triggerToast("Gmail re-authorized. Sending email now...", "success");
        } else {
          triggerToast("Gmail authorization was cancelled. Email not sent.", "error");
          return;
        }
      } catch (e: any) {
        console.error("[Gmail Re-auth Error]:", e);
        triggerToast(e.message || "Failed to re-authorize Gmail.", "error");
        return;
      }
    }

    setIsSending(true);
    triggerToast("Sending via Gmail API...", "info");
    let anySuccess = false;
    let lastErrorMsg = "";

    try {
      // Single API call — server handles To/CC/BCC addressing
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: toEmails[0],   // legacy fallback field
          recipients: toEmails,
          cc: ccEmails,
          bcc: bccEmails,
          subject,
          body,
          token,
          refreshToken,
          type: aiPrompt ? "ai_draft" : "manual"
        })
      });

      if (res.ok) {
        anySuccess = true;
      } else {
        const errData = await res.json().catch(() => ({}));
        lastErrorMsg = errData.error || `Server status ${res.status}`;
        console.error("[Gmail API Server Error]:", lastErrorMsg);
        if (res.status === 401 || res.status === 403 ||
            lastErrorMsg.toLowerCase().includes("invalid_grant") ||
            lastErrorMsg.toLowerCase().includes("expire") ||
            lastErrorMsg.toLowerCase().includes("invalid credentials")) {
          clearGmailAccessToken();
        }
      }

      if (anySuccess) {
        // Write to the dedicated "sentEmails" Firestore collection
        const sentRecord: DbEmailRecord = {
          id: `sent-${Date.now()}`,
          to: toEmails,
          cc: ccEmails,
          bcc: bccEmails,
          subject,
          body,
          timestamp: new Date().toISOString(),
          status: "sent",
          type: aiPrompt ? "ai_draft" : "manual",
          attachedDocIds: selectedDocIds,
          aiPromptUsed: aiPrompt || undefined,
          userId: user.uid,
        };
        try {
          await saveSentEmail(sentRecord, user.organizationId);
          // Instant UI update — prepend without requiring tab switch
          setSentEmails(prev => [sentRecord, ...prev]);
          console.log("[EmailAssistant] ✅ Sent email saved to Firestore sentEmails collection.");
        } catch (saveErr) {
          console.error("[EmailAssistant] ❌ Failed to write sentEmails record:", saveErr);
          // Email was delivered — log failure but don't block the success toast
        }
        triggerToast(`Sent to ${toEmails.length} recipient${toEmails.length > 1 ? "s" : ""}!`, "success");
        setToEmails([]); setCcEmails([]); setBccEmails([]);
        setSubject(""); setBody(""); setAiPrompt(""); setSelectedDocIds([]); setActiveDraftId(null);
      } else {
        console.error("[Gmail API Error]:", lastErrorMsg);
        triggerToast(`Send failed: ${lastErrorMsg}. Please reconnect your Gmail account.`, "error");
      }
    } catch (e: any) {
      console.error("[Gmail Send Error]:", e);
      triggerToast(e.message || "Failed to send email due to network error.", "error");
    } finally {
      setIsSending(false);
    }
  };


  // ── Save draft ──────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!user) { onLogin(); return; }
    if (!subject && !body && !toEmails.length) { triggerToast("Nothing to save.", "error"); return; }
    setIsSavingDraft(true);
    try {
      const id = activeDraftId || `draft-${Date.now()}`;
      const draftRecord: DbEmailRecord = {
        id,
        to: toEmails,
        cc: ccEmails,
        bcc: bccEmails,
        subject: subject || "(No subject)",
        body,
        timestamp: new Date().toISOString(),
        status: "draft",
        type: "manual",
        attachedDocIds: selectedDocIds,
        aiPromptUsed: aiPrompt || undefined,
        userId: user.uid
      };
      // Write to the dedicated "drafts" Firestore collection
      await saveDraft(draftRecord, user.organizationId);
      setActiveDraftId(id);
      // Upsert into local drafts state for instant UI feedback
      setDrafts(prev => [draftRecord, ...prev.filter(d => d.id !== id)]);
      console.log("[EmailAssistant] ✅ Draft saved to Firestore drafts collection.");
      triggerToast("Draft saved!", "success");
      // Switch to drafts tab and refresh list
      setActiveTab("drafts");
      loadDrafts();
    } catch (err) {
      console.error("[EmailAssistant] ❌ handleSaveDraft error:", err);
      triggerToast("Failed to save draft. Check console for details.", "error");
    } finally {
      setIsSavingDraft(false);
    }
  };

  // ── Resume draft ────────────────────────────────────────────────────────────
  const handleResumeDraft = (draft: DbEmailRecord) => {
    setToEmails(draft.to || []); setCcEmails(draft.cc || []); setBccEmails(draft.bcc || []);
    setSubject(draft.subject); setBody(draft.body);
    setAiPrompt(draft.aiPromptUsed || ""); setSelectedDocIds(draft.attachedDocIds || []);
    setActiveDraftId(draft.id); setActiveTab("compose");
    triggerToast("Draft loaded.", "success");
  };

  // ── Use template ────────────────────────────────────────────────────────────
  const handleUseTemplate = (tpl: DbEmailTemplate) => {
    setSubject(tpl.subject); setBody(tpl.body);
    setActiveTab("compose");
    triggerToast(`Template "${tpl.name}" loaded.`, "success");
  };

  // ── Save template ────────────────────────────────────────────────────────────
  const handleSaveTemplate = async () => {
    if (!user) { onLogin(); return; }
    if (!templateName.trim()) { triggerToast("Template name required.", "error"); return; }
    setIsSavingTemplate(true);
    try {
      const tpl: DbEmailTemplate = { id: `tpl-${Date.now()}`, name: templateName, subject: subject || "(No subject)", body, category: templateCategory, createdAt: new Date().toISOString(), userId: user.uid };
      await saveEmailTemplate(tpl);
      setUserTemplates(prev => [tpl, ...prev]);
      setShowSaveTemplateDialog(false); setTemplateName(""); setTemplateCategory("General");
      triggerToast(`Template "${tpl.name}" saved!`, "success");
    } catch { triggerToast("Failed to save template.", "error"); }
    finally { setIsSavingTemplate(false); }
  };

  // ── Delete template ─────────────────────────────────────────────────────────
  const handleDeleteTemplate = async (id: string, isBuiltin: boolean) => {
    if (isBuiltin) { triggerToast("Built-in templates cannot be deleted.", "info"); return; }
    if (!confirm("Delete this template?")) return;
    try { await deleteEmailTemplate(id); setUserTemplates(prev => prev.filter(t => t.id !== id)); triggerToast("Template deleted.", "info"); }
    catch { triggerToast("Delete failed.", "error"); }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); triggerToast("Copied!", "success"); };

  const clearForm = () => { setToEmails([]); setCcEmails([]); setBccEmails([]); setSubject(""); setBody(""); setAiPrompt(""); setSelectedDocIds([]); setActiveDraftId(null); };

  const filteredSent = sentEmails.filter(e => (e.to?.join(", ") + e.subject + e.body).toLowerCase().includes(sentSearch.toLowerCase()));
  const filteredTemplates = userTemplates.filter(t => (t.name + t.subject + t.category).toLowerCase().includes(templateSearch.toLowerCase()));

  const TABS = [
    { id: "compose" as ActiveTab,   label: "Compose",   icon: PenLine },
    { id: "sent" as ActiveTab,      label: "Sent",      icon: Send,    count: null },
    { id: "drafts" as ActiveTab,    label: "Drafts",    icon: Archive, count: drafts.length || null },
    { id: "templates" as ActiveTab, label: "Templates", icon: LayoutTemplate },
  ];

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-slate-950 gap-6 p-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Mail className="w-10 h-10 text-indigo-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-base font-extrabold text-slate-800 dark:text-white">Sign in to use Email Assistant</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
            Connect your Google Workspace to compose AI-powered emails, manage drafts, and send directly via Gmail.
          </p>
        </div>
        <button onClick={onLogin} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-indigo-500/20">
          Connect Google Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0c0d15] overflow-hidden">

      {/* ── Header + Tabs ───────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/30 backdrop-blur-md shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Mail className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Email Assistant
                <span className="text-[9px] bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono font-bold">AI · Gmail</span>
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Compose · Draft · Template · Send</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl px-3 py-1.5">
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center overflow-hidden">
              {user.photoURL
                ? <img src={user.photoURL} alt="" className="w-full h-full object-cover rounded-full" />
                : <User className="w-3 h-3 text-indigo-400" />}
            </div>
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 max-w-[120px] truncate">{user.displayName}</span>
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">{user.role}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = (tab as any).count;
            return (
              <button
                key={tab.id}
                id={`email-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition cursor-pointer border-b-2 relative ${
                  isActive
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {count != null && count > 0 && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">{count}</span>
                )}
                {activeDraftId && tab.id === "compose" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-2 right-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="h-full overflow-y-auto"
          >

            {/* ══════════════════════════════════════════════════════════════
                COMPOSE TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === "compose" && (
              <div className="max-w-3xl mx-auto p-6 space-y-5">

                {/* Draft indicator */}
                {activeDraftId && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
                    <Archive className="w-3.5 h-3.5" />
                    Editing draft
                    <button onClick={() => { clearForm(); }} className="ml-auto text-[10px] hover:text-red-400 transition cursor-pointer flex items-center gap-1">
                      <X className="w-3 h-3" /> Discard
                    </button>
                  </div>
                )}

                {/* ── AI Draft Generator ──────────────────────────────── */}
                <div className="bg-gradient-to-br from-indigo-950/20 to-purple-950/10 dark:from-indigo-950/50 dark:to-purple-950/20 border border-indigo-500/20 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setShowAiPanel(!showAiPanel)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-white/5 dark:hover:bg-white/3 transition"
                  >
                    <span className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-white">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      AI Email Generator
                      <span className="text-[9px] font-mono text-indigo-400/80">Gemini</span>
                    </span>
                    {showAiPanel ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  <AnimatePresence>
                    {showAiPanel && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-3 border-t border-indigo-500/10">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-3">
                            Describe your email goal. Attach knowledge docs for additional context.
                          </p>

                          {/* Doc picker */}
                          {docs.length > 0 && (
                            <div className="space-y-2">
                              <button
                                onClick={() => setShowDocPicker(!showDocPicker)}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition cursor-pointer"
                              >
                                <Paperclip className="w-3 h-3" />
                                Attach Knowledge Documents
                                {selectedDocIds.length > 0 && (
                                  <span className="bg-indigo-500/15 text-indigo-500 px-1.5 py-0.5 rounded-full text-[9px] font-black">{selectedDocIds.length} attached</span>
                                )}
                                {showDocPicker ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                              </button>
                              <AnimatePresence>
                                {showDocPicker && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-4 overflow-hidden"
                                  >
                                    {docs.map(d => (
                                      <label key={d.id} className="flex items-center gap-2 cursor-pointer group py-0.5">
                                        <input
                                          type="checkbox"
                                          checked={selectedDocIds.includes(d.id)}
                                          onChange={e => setSelectedDocIds(prev => e.target.checked ? [...prev, d.id] : prev.filter(id => id !== d.id))}
                                          className="w-3 h-3 accent-indigo-500 cursor-pointer"
                                        />
                                        <span className="text-[10px] text-slate-600 dark:text-slate-400 group-hover:text-indigo-500 transition font-medium truncate">
                                          <FileText className="w-2.5 h-2.5 inline mr-1 text-slate-400" />{d.name}
                                        </span>
                                      </label>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          <textarea
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleGenerateDraft(); }}}
                            placeholder="E.g. Write a professional follow-up email to the marketing team about Q3 campaign results, highlighting budget overrun and requesting a review meeting..."
                            rows={3}
                            className="w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none outline-none focus:border-indigo-500/50 transition"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              id="ai-generate-btn"
                              onClick={handleGenerateDraft}
                              disabled={isGenerating || !aiPrompt.trim()}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer"
                            >
                              {isGenerating
                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                                : <><Sparkles className="w-3.5 h-3.5" /> Generate Draft</>}
                            </button>
                            <span className="text-[9px] text-slate-400 font-mono">Ctrl+Enter</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Recipients ──────────────────────────────────────── */}
                <div className="bg-white/80 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 space-y-3">
                  <TagChipInput
                    label="To"
                    placeholder="recipient@company.com — Enter or comma to add"
                    tags={toEmails}
                    onChange={setToEmails}
                    icon={<AtSign className="w-3 h-3" />}
                    required
                  />
                  <button
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-500 transition cursor-pointer"
                  >
                    {showCcBcc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showCcBcc ? "Hide CC / BCC" : "Add CC / BCC"}
                  </button>
                  <AnimatePresence>
                    {showCcBcc && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 overflow-hidden"
                      >
                        <TagChipInput label="CC" placeholder="cc@example.com" tags={ccEmails} onChange={setCcEmails} icon={<AtSign className="w-3 h-3" />} />
                        <TagChipInput label="BCC" placeholder="bcc@example.com" tags={bccEmails} onChange={setBccEmails} icon={<AtSign className="w-3 h-3" />} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Subject ─────────────────────────────────────────── */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Subject <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Email subject..."
                    className="w-full px-3 py-2.5 rounded-xl bg-white/80 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition font-semibold"
                  />
                </div>

                {/* ── Body ────────────────────────────────────────────── */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Body <span className="text-red-400">*</span></label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => copyToClipboard(body)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-500 transition cursor-pointer">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                      <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-500 transition cursor-pointer">
                        {showPreview ? <><EyeOff className="w-3 h-3" /> Edit</> : <><Eye className="w-3 h-3" /> Preview</>}
                      </button>
                    </div>
                  </div>
                  {showPreview ? (
                    <div className="min-h-[180px] px-4 py-3 rounded-xl bg-white/80 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                      {body || <span className="italic text-slate-400">No content yet.</span>}
                    </div>
                  ) : (
                    <textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      placeholder="Write your email here, or use the AI generator above..."
                      rows={10}
                      className="w-full px-4 py-3 rounded-xl bg-white/80 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-y outline-none focus:border-indigo-500/50 transition font-mono leading-relaxed"
                    />
                  )}
                </div>

                {/* ── Action Buttons ───────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    id="email-send-btn"
                    onClick={handleSend}
                    disabled={isSending || toEmails.length === 0 || !subject || !body}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-indigo-500/20"
                  >
                    {isSending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</> : <><Send className="w-3.5 h-3.5" /> Send Email</>}
                  </button>
                  <button
                    id="email-save-draft-btn"
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 bg-white/60 dark:bg-slate-900/20 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-amber-500 transition cursor-pointer"
                  >
                    {isSavingDraft ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Archive className="w-3.5 h-3.5" /> Save Draft</>}
                  </button>
                  <button
                    id="email-save-template-btn"
                    onClick={() => { setTemplateName(""); setTemplateCategory("General"); setShowSaveTemplateDialog(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 bg-white/60 dark:bg-slate-900/20 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition cursor-pointer"
                  >
                    <LayoutTemplate className="w-3.5 h-3.5" /> Save as Template
                  </button>
                  <button
                    onClick={() => { if (confirm("Clear compose form?")) clearForm(); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20 text-xs font-bold text-slate-500 hover:text-red-400 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear
                  </button>
                </div>

                {/* Google Workspace Gmail Auth Status Banner */}
                {!getGmailAccessToken() ? (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-600 dark:text-amber-400">Gmail Send Permission Required</p>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Authorizing Gmail allows Nexora to dispatch emails directly on your behalf.
                        <button
                          onClick={handleConnectGmail}
                          disabled={isConnectingGmail}
                          className="ml-1 text-indigo-500 font-bold hover:underline cursor-pointer disabled:opacity-50"
                        >
                          {isConnectingGmail ? "Connecting..." : "Authorize Gmail Send Scope →"}
                        </button>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Gmail API Secure Connection Active
                    <button
                      onClick={() => { clearGmailAccessToken(); triggerToast("Gmail connection cleared.", "info"); }}
                      className="ml-auto text-[10px] text-slate-400 hover:text-red-400 transition cursor-pointer"
                    >
                      Disconnect Gmail
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SENT TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === "sent" && (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input type="text" value={sentSearch} onChange={e => setSentSearch(e.target.value)} placeholder="Search sent emails..." className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none" />
                  </div>
                  <button onClick={loadSent} disabled={isLoadingSent} className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 text-slate-400 hover:text-indigo-500 transition cursor-pointer">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSent ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {isLoadingSent && <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>}

                {!isLoadingSent && filteredSent.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center"><Inbox className="w-7 h-7 text-slate-400" /></div>
                    <p className="text-sm font-bold text-slate-400">No sent emails yet</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Send an email from Compose to see it here.</p>
                  </div>
                )}

                <div className="space-y-3 max-w-3xl mx-auto">
                  {filteredSent.map(email => (
                    <div key={email.id} className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setExpandedSent(expandedSent === email.id ? null : email.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                          <Send className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{email.subject}</p>
                          <p className="text-[10px] text-slate-400 truncate">To: {(email.to || [email.recipient]).filter(Boolean).join(", ")}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={email.status} />
                          <span className="text-[9px] text-slate-400 font-mono hidden sm:block">{new Date(email.timestamp).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" })}</span>
                          {expandedSent === email.id ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                      </button>
                      {expandedSent === email.id && (
                        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800/60">
                          <div className="grid grid-cols-2 gap-2 pt-3">
                            {[
                              { label: "To", value: (email.to || [email.recipient || ""]).filter(Boolean).join(", ") },
                              email.cc?.length ? { label: "CC", value: email.cc.join(", ") } : null,
                              { label: "Type", value: email.type },
                              { label: "Sent", value: new Date(email.timestamp).toLocaleString() },
                            ].filter(Boolean).map(({ label, value }: any) => (
                              <div key={label} className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
                                <p className="text-[10px] text-slate-700 dark:text-slate-300 font-medium truncate">{value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-3 max-h-40 overflow-y-auto">
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed font-mono">{email.body}</p>
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => { setSubject("Re: " + email.subject); setToEmails((email.to || [email.recipient || ""]).filter(Boolean)); setActiveTab("compose"); }} className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition cursor-pointer">
                              <Edit3 className="w-3 h-3" /> Reply
                            </button>
                            <button onClick={() => copyToClipboard(email.body)} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer">
                              <Copy className="w-3 h-3" /> Copy Body
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                DRAFTS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === "drafts" && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">{drafts.length} draft{drafts.length !== 1 ? "s" : ""}</p>
                  <button onClick={loadDrafts} disabled={isLoadingDrafts} className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 text-slate-400 hover:text-indigo-500 transition cursor-pointer">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrafts ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {isLoadingDrafts && <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>}
                {!isLoadingDrafts && drafts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center"><Archive className="w-7 h-7 text-slate-400" /></div>
                    <p className="text-sm font-bold text-slate-400">No drafts yet</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">Click "Save Draft" in Compose to save unfinished emails.</p>
                    <button onClick={() => setActiveTab("compose")} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer">Go to Compose</button>
                  </div>
                )}
                <div className="space-y-3 max-w-3xl mx-auto">
                  {drafts.map(draft => (
                    <div key={draft.id} className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Archive className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{draft.subject}</p>
                        <p className="text-[10px] text-slate-400 truncate">To: {draft.to?.join(", ") || "—"}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-600 line-clamp-2 font-mono">{draft.body || "(empty body)"}</p>
                        <p className="text-[9px] text-slate-400 font-mono"><Clock className="w-2.5 h-2.5 inline mr-1" />{new Date(draft.timestamp).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          id={`resume-draft-${draft.id}`}
                          onClick={() => handleResumeDraft(draft)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold hover:bg-indigo-500/20 transition cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Resume
                        </button>
                        <button
                          onClick={async () => {
                            setDrafts(prev => prev.filter(d => d.id !== draft.id)); // optimistic remove
                            try {
                              await deleteDraftDb(draft.id);
                              triggerToast("Draft deleted.", "info");
                            } catch (err) {
                              console.error("[EmailAssistant] ❌ deleteDraftDb failed:", err);
                              triggerToast("Failed to delete draft from Firestore.", "error");
                              // Restore the draft if delete failed
                              setDrafts(prev => [...prev, draft].sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/5 text-red-400 text-[10px] font-bold hover:bg-red-500/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TEMPLATES TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === "templates" && (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input type="text" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} placeholder="Search templates..." className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none" />
                  </div>
                  <button onClick={loadTemplates} disabled={isLoadingTemplates} className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 text-slate-400 hover:text-indigo-500 transition cursor-pointer">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTemplates ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {isLoadingTemplates && <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Loading templates...</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredTemplates.map(tpl => {
                    const isBuiltin = tpl.id.startsWith("tpl-builtin");
                    return (
                      <div key={tpl.id} className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 hover:border-indigo-500/30 hover:shadow-lg dark:hover:shadow-indigo-950/50 transition group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{tpl.name}</h3>
                              {isBuiltin && <span className="text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full uppercase">Built-in</span>}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Tag className="w-2.5 h-2.5 text-slate-400" />
                              <span className="text-[9px] text-slate-400 font-mono">{tpl.category}</span>
                            </div>
                          </div>
                          {!isBuiltin && (
                            <button
                              onClick={() => handleDeleteTemplate(tpl.id, isBuiltin)}
                              className="p-1.5 rounded-lg text-slate-300 dark:text-slate-700 hover:text-red-400 hover:bg-red-500/5 transition cursor-pointer opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg px-3 py-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Subject</p>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold truncate">{tpl.subject}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono line-clamp-3 leading-relaxed flex-1">{tpl.body.slice(0, 140)}{tpl.body.length > 140 ? "…" : ""}</p>
                        <button
                          id={`use-template-${tpl.id}`}
                          onClick={() => handleUseTemplate(tpl)}
                          className="w-full py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-500/20 transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <PenLine className="w-3 h-3" /> Use Template
                        </button>
                      </div>
                    );
                  })}
                </div>

                {!isLoadingTemplates && filteredTemplates.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center"><LayoutTemplate className="w-7 h-7 text-slate-400" /></div>
                    <p className="text-sm font-bold text-slate-400">No templates</p>
                    <p className="text-xs text-slate-500">Save a composed email as a template to reuse it.</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Save Template Dialog ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showSaveTemplateDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950 cursor-pointer" onClick={() => setShowSaveTemplateDialog(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 z-10"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-emerald-400" /> Save as Template
                </h3>
                <button onClick={() => setShowSaveTemplateDialog(false)} className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Template Name <span className="text-red-400">*</span></label>
                  <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="E.g. Monthly Report" autoFocus className="w-full px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500/50 transition" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Category</label>
                  <select value={templateCategory} onChange={e => setTemplateCategory(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-800 dark:text-slate-100 outline-none cursor-pointer">
                    {["General","Report","Meeting","Project","Marketing","HR","Finance","Legal","Support"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveTemplate} disabled={isSavingTemplate || !templateName.trim()} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer">
                  {isSavingTemplate ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5" /> Save Template</>}
                </button>
                <button onClick={() => setShowSaveTemplateDialog(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 hover:text-white transition cursor-pointer">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
