import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Search, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Terminal, 
  ArrowRight, 
  Layers, 
  HelpCircle,
  FileCode,
  Languages,
  X,
  PlusCircle,
  FolderPlus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PromptTemplate, WorkspaceSettings } from "../types";

interface PromptLibraryProps {
  templates: PromptTemplate[];
  onAddTemplate: (tpl: Omit<PromptTemplate, "id">) => void;
  onUpdateTemplate: (id: string, updated: Partial<PromptTemplate>) => void;
  onDeleteTemplate: (id: string) => void;
  onUpdateSettings: (settings: Partial<WorkspaceSettings>) => void;
  onInsertIntoChat: (promptText: string) => void;
  triggerToast: (msg: string, type?: "success" | "info" | "error") => void;
}

const CATEGORIES = ["All", "Knowledge & RAG", "Productivity", "Translations", "Technical", "Custom"];

export default function PromptLibrary({
  templates,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onUpdateSettings,
  onInsertIntoChat,
  triggerToast
}: PromptLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Variables map for dynamic inputs with default pre-seeded values
  const [variablesMap, setVariablesMap] = useState<Record<string, Record<string, string>>>({
    "p-rag-brief": { num_recommendations: "5", industry_focus: "Healthcare" },
    "p-multilang": { target_language: "Telugu (తెలుగు) & Hindi (हिंदी)" },
    "p-technical-audit": { specialty_area: "Security & Cloud", audit_priority: "OWASP Top 10" },
    "p-faq-creator": { department_name: "Customer Success", max_bullets: "3", contact_person: "HR Compliance Office" },
    "p-semantic-optimizer": { company_name: "Nexora Global" }
  });

  const getPromptVariables = (promptText: string): string[] => {
    const matches = promptText.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    const vars = matches.map(m => m.slice(2, -2).trim());
    return Array.from(new Set(vars));
  };

  const getCompiledPrompt = (promptText: string, id: string): string => {
    const vars = getPromptVariables(promptText);
    let compiled = promptText;
    const values = variablesMap[id] || {};
    vars.forEach(v => {
      const val = values[v] !== undefined && values[v] !== "" ? values[v] : `{{${v}}}`;
      const escapedV = v.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\{\\{\\s*${escapedV}\\s*\\}\\}`, "g");
      compiled = compiled.replace(regex, val);
    });
    return compiled;
  };
  
  // Modal / Creator Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Knowledge & RAG");
  const [formDescription, setFormDescription] = useState("");
  const [formPrompt, setFormPrompt] = useState("");

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    triggerToast("Prompt copied to clipboard!", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openCreateModal = () => {
    setEditingTemplateId(null);
    setFormTitle("");
    setFormCategory("Knowledge & RAG");
    setFormDescription("");
    setFormPrompt("");
    setIsFormOpen(true);
  };

  const openEditModal = (tpl: PromptTemplate) => {
    setEditingTemplateId(tpl.id);
    setFormTitle(tpl.title);
    setFormCategory(tpl.category);
    setFormDescription(tpl.description);
    setFormPrompt(tpl.prompt);
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formPrompt.trim()) {
      triggerToast("Title and Prompt content are required.", "error");
      return;
    }

    if (editingTemplateId) {
      onUpdateTemplate(editingTemplateId, {
        title: formTitle,
        category: formCategory,
        description: formDescription,
        prompt: formPrompt
      });
      triggerToast("Prompt template updated!", "success");
    } else {
      onAddTemplate({
        title: formTitle,
        category: formCategory,
        description: formDescription,
        prompt: formPrompt
      });
      triggerToast("New prompt template saved to library!", "success");
    }
    setIsFormOpen(false);
  };

  const handleApplyAsSystemInstruction = (promptText: string, title: string) => {
    onUpdateSettings({ systemInstruction: promptText });
    triggerToast(`Applied "${title}" as System Instruction!`, "success");
  };

  // Filter templates
  const filteredTemplates = templates.filter(tpl => {
    const matchesCategory = selectedCategory === "All" || tpl.category === selectedCategory || (selectedCategory === "Custom" && !tpl.isBuiltIn);
    const matchesSearch = tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tpl.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 w-full overflow-y-auto p-6 space-y-8 bg-transparent transition-colors text-left max-w-5xl mx-auto">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full">
              PROMPT MANAGEMENT
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-emerald-500" />
            <span className="gemini-gradient-text">Prompt Library</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Save, organize, and reuse common system instructions or quick message injection templates to guide your AI assistant.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 text-xs font-black rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white flex items-center gap-2 self-start sm:self-center transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Save New Template</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Categories scroll area */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-black rounded-lg transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-slate-900 dark:bg-emerald-500 text-white"
                  : "bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-900/70"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved prompts..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/60 rounded-xl outline-none text-slate-800 dark:text-slate-100 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Grid view of cards */}
      {filteredTemplates.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-20 space-y-3">
          <Layers className="w-10 h-10 text-slate-400 mx-auto opacity-65" />
          <h4 className="text-sm font-black text-slate-700 dark:text-slate-350 uppercase tracking-wider">No Prompts Found</h4>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
            Try adjusting your search filters or click "Save New Template" to add your first workspace instruction template.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTemplates.map((tpl) => {
            const vars = getPromptVariables(tpl.prompt);
            const compiledPrompt = getCompiledPrompt(tpl.prompt, tpl.id);

            return (
              <div 
                key={tpl.id}
                className="glass-panel p-5 rounded-20 flex flex-col justify-between border border-slate-200/50 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md relative hover:shadow-lg transition-all"
              >
                <div className="space-y-3.5 text-left">
                  {/* Badge header */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                      tpl.category === "Knowledge & RAG" 
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15"
                        : tpl.category === "Translations"
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/15"
                          : tpl.category === "Technical"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15"
                            : tpl.category === "Productivity"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15"
                              : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/15"
                    }`}>
                      {tpl.category}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {tpl.isBuiltIn ? (
                        <span className="text-[8px] font-black tracking-widest text-slate-400 dark:text-slate-500 font-mono uppercase">
                          SYSTEM
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => openEditModal(tpl)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer"
                            title="Edit Custom Template"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTemplate(tpl.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                            title="Delete Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title and Description */}
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-wide uppercase">
                      {tpl.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 tracking-wide uppercase">
                      {tpl.description}
                    </p>
                  </div>

                  {/* Prompt Preview Codebox */}
                  <div className="relative p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850/60">
                    <pre className="text-[11px] font-mono text-slate-600 dark:text-slate-400 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                      {compiledPrompt}
                    </pre>
                    
                    <button
                      onClick={() => handleCopy(compiledPrompt, tpl.id)}
                      className="absolute right-2 top-2 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 hover:border-emerald-500 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer shadow-sm"
                      title="Copy compiled prompt text"
                    >
                      {copiedId === tpl.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Interactive Variable Compiler inputs */}
                  {vars.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/40 dark:border-slate-800/40 space-y-2">
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
                        <Terminal className="w-3.5 h-3.5 animate-pulse" />
                        <span>Configure Prompt Variables</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {vars.map(v => (
                          <div key={v} className="flex flex-col gap-1">
                            <label className="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left">
                              {v.replace(/_/g, " ")}
                            </label>
                            <input
                              type="text"
                              value={variablesMap[tpl.id]?.[v] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVariablesMap(prev => ({
                                  ...prev,
                                  [tpl.id]: {
                                    ...(prev[tpl.id] || {}),
                                    [v]: val
                                  }
                                }));
                              }}
                              placeholder={`e.g. ${v.replace(/_/g, " ")}`}
                              className="px-2.5 py-1.5 text-[10px] bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/60 rounded-lg outline-none focus:border-indigo-500 text-slate-850 dark:text-slate-150 font-bold transition-all text-left"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action row */}
                <div className="mt-4 pt-4 border-t border-slate-150 dark:border-slate-850/40 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onInsertIntoChat(compiledPrompt)}
                    className="py-2 text-[10px] font-black rounded-xl bg-slate-900 dark:bg-emerald-500 text-white hover:opacity-95 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm shadow-slate-900/10 dark:shadow-emerald-500/10"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Insert to Chat Input</span>
                  </button>
                  <button
                    onClick={() => handleApplyAsSystemInstruction(compiledPrompt, tpl.title)}
                    className="py-2 text-[10px] font-black rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-white/60 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Apply as System Directives</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save / Edit Modal Overlay */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-slate-950"
            />
            {/* Box container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg p-6 rounded-20 bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800 text-left space-y-4 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-4.5 h-4.5 text-emerald-500" />
                  {editingTemplateId ? "Edit Saved Template" : "Save Prompt Template"}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Template Title</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Sales Report Restructuring"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 font-bold cursor-pointer"
                    >
                      {CATEGORIES.filter(c => c !== "All" && c !== "Custom").map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Short Description</label>
                    <input
                      type="text"
                      required
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="e.g. Cleans raw telemetry outputs"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Prompt Body / Instructions</label>
                  <textarea
                    required
                    rows={6}
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    placeholder="Provide full instructions. You can use standard Markdown. e.g. 'Act as a professional financial analyst...'"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 font-mono resize-none leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-black rounded-xl bg-slate-900 dark:bg-emerald-500 text-white hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>{editingTemplateId ? "Save Changes" : "Save to Library"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
