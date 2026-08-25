import React, { useState } from "react";
import { 
  Settings, 
  Sparkles, 
  Sliders, 
  Cpu, 
  Database, 
  CheckCircle, 
  Zap, 
  Terminal, 
  AlertTriangle,
  FileCode,
  ArrowUpRight,
  Palette,
  Plus
} from "lucide-react";
import { motion } from "motion/react";
import { WorkspaceSettings, WorkspacePersona } from "../types";
import { WORKSPACE_PERSONAS } from "./personas";
import { THEMES } from "../lib/theme";

interface SettingsTabProps {
  settings: WorkspaceSettings;
  onUpdateSettings: (settings: Partial<WorkspaceSettings>) => void;
  onTriggerPaidFlow: () => void;
  customPersonas?: WorkspacePersona[];
  onAddCustomPersona?: (persona: WorkspacePersona) => void;
}

export default function SettingsTab({
  settings,
  onUpdateSettings,
  onTriggerPaidFlow,
  customPersonas = [],
  onAddCustomPersona
}: SettingsTabProps) {
  const [pingStatus, setPingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pingTime, setPingTime] = useState<number | null>(null);

  // Custom Agent Form State
  const [showCreateAgentForm, setShowCreateAgentForm] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentBadge, setAgentBadge] = useState("");
  const [agentDesc, setAgentDesc] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentColor, setAgentColor] = useState("indigo");

  const handleCreateAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName || !agentDesc || !agentPrompt) return;

    const newPersona: WorkspacePersona = {
      id: `custom-${Date.now()}`,
      name: agentName,
      badgeText: agentBadge || "Custom",
      description: agentDesc,
      systemPrompt: agentPrompt,
      iconName: "Cpu",
      accentClass: `from-${agentColor}-500 to-violet-500 text-${agentColor}-500 bg-${agentColor}-500/10`
    };

    if (onAddCustomPersona) {
      onAddCustomPersona(newPersona);
    }

    // Auto-select the newly created persona
    onUpdateSettings({
      activePersonaId: newPersona.id,
      systemInstruction: newPersona.systemPrompt
    });

    // Reset Form
    setAgentName("");
    setAgentBadge("");
    setAgentDesc("");
    setAgentPrompt("");
    setShowCreateAgentForm(false);
  };

  const availableModels = [
    { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", description: "Default, extremely fast generalist model.", isPaid: false },
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Preview)", description: "Elite model for complex reasoning and advanced coding.", isPaid: true },
    { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", description: "Ultra-low latency model optimized for brief tasks.", isPaid: false },
  ];

  const handlePersonaSelect = (persona: WorkspacePersona) => {
    onUpdateSettings({
      activePersonaId: persona.id,
      systemInstruction: persona.systemPrompt
    });
  };

  const handleModelSelect = (modelId: string, isPaid: boolean) => {
    if (isPaid) {
      onTriggerPaidFlow();
    }
    onUpdateSettings({ modelName: modelId });
  };

  const testConnection = async () => {
    setPingStatus("loading");
    const startTime = performance.now();
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      const endTime = performance.now();
      if (data.hasApiKey) {
        setPingStatus("success");
        setPingTime(Math.round(endTime - startTime));
      } else {
        setPingStatus("error");
      }
    } catch {
      setPingStatus("error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-transparent transition-colors text-left max-w-5xl mx-auto">
      
      {/* Title block */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-full">
            SYSTEM ENGINE
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-indigo-500" />
          <span className="gemini-gradient-text">Workspace Settings</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Customize model temperatures, AI system personas, custom instructions, and inspect server latency.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left side: AI config settings sliders */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Persona selector grid */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
              Active System Persona / Agent
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...WORKSPACE_PERSONAS, ...customPersonas].map((p) => {
                const isActive = settings.activePersonaId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePersonaSelect(p)}
                    className={`p-4.5 rounded-20 border bg-white/40 dark:bg-[#111318]/40 backdrop-blur-md text-left cursor-pointer transition-all duration-200 flex flex-col justify-between h-36 relative ${
                      isActive
                        ? "border-indigo-500 bg-indigo-500/[0.02] ring-1 ring-indigo-500/30 shadow-md shadow-indigo-500/5"
                        : "border-slate-200/50 dark:border-slate-800/50 hover:border-slate-350"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">{p.name}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${p.accentClass.split(" ").slice(2).join(" ") || "text-indigo-500 bg-indigo-500/10"}`}>
                          {p.badgeText}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal line-clamp-2 font-bold uppercase tracking-wider">
                        {p.description}
                      </p>
                    </div>

                    {isActive && (
                      <span className="text-[9px] font-black text-indigo-500 flex items-center gap-1 mt-2 uppercase tracking-widest font-mono">
                        <CheckCircle className="w-3.5 h-3.5" /> Selected Profile
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Create Custom Agent Toggle Card */}
              {!showCreateAgentForm ? (
                <button
                  type="button"
                  onClick={() => setShowCreateAgentForm(true)}
                  className="p-4.5 rounded-20 border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 flex flex-col items-center justify-center text-center h-36 gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-6 h-6 text-indigo-500" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Create Custom AI Agent
                  </span>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                    Build specialized role system instructions
                  </p>
                </button>
              ) : (
                <form
                  onSubmit={handleCreateAgentSubmit}
                  className="p-4 rounded-20 border border-indigo-500/50 bg-white/80 dark:bg-[#0c0d12]/90 shadow-lg flex flex-col justify-between h-auto min-h-[144px] space-y-3.5 col-span-1 sm:col-span-2 text-left animate-fade"
                >
                  <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-850 pb-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Configure Specialized Custom AI Agent
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCreateAgentForm(false)}
                      className="text-[9px] font-black text-slate-400 dark:text-slate-500 hover:text-slate-600 uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Agent Role Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Talent Acquisition Coordinator"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Department Badge Text
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. HR, Legal, Code Node"
                        value={agentBadge}
                        onChange={(e) => setAgentBadge(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Role Description (Short)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Expert in compliance audits and recruiting pipelines..."
                        value={agentDesc}
                        onChange={(e) => setAgentDesc(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Specialized System Instructions (Demeanor & Directives)
                      </label>
                      <textarea
                        required
                        rows={3}
                        placeholder="You are the specialized Talent Acquisition Coordinator. Always format lists in Markdown with clear columns. Use supportive language..."
                        value={agentPrompt}
                        onChange={(e) => setAgentPrompt(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-150 outline-none focus:border-indigo-500 resize-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Accent Theme Color
                      </label>
                      <select
                        value={agentColor}
                        onChange={(e) => setAgentColor(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-850 dark:text-slate-150 outline-none focus:border-indigo-500"
                      >
                        <option value="indigo">Indigo Violet</option>
                        <option value="emerald">Emerald Teal</option>
                        <option value="rose">Rose Quartz</option>
                        <option value="amber">Amber Amber</option>
                        <option value="cyan">Cyan Ice</option>
                        <option value="pink">Pink Sunset</option>
                      </select>
                    </div>

                    <div className="flex items-end justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg uppercase tracking-wider transition-colors cursor-pointer w-full sm:w-auto"
                      >
                        Deploy Custom Agent
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* System instructions textarea */}
          <div className="space-y-2">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Merged System Instructions
            </h3>
            <textarea
              value={settings.systemInstruction}
              onChange={(e) => onUpdateSettings({ systemInstruction: e.target.value })}
              rows={5}
              className="w-full px-4 py-3 text-xs bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/60 rounded-20 outline-none text-slate-800 dark:text-slate-100 focus:border-indigo-500/50 resize-none font-mono leading-relaxed"
              placeholder="Provide general directives governing model demeanor and vocabulary..."
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
              System instructions are compiled with grounding indices before every text generation request.
            </p>
          </div>

          {/* Fine Tuning Sliders with beautiful glassmorphism */}
          <div className="glass-panel p-6 rounded-20 space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
              Engine Fine-Tuning
            </h3>

            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  <span>Creativity Temperature</span>
                  <span className="text-indigo-500 font-black font-mono">{settings.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.2"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) => onUpdateSettings({ temperature: Number(e.target.value) })}
                  className="w-full accent-indigo-500 h-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-black tracking-widest">
                  <span>0.0 (Deterministic)</span>
                  <span>1.2 (Highly Creative)</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  <span>Max Tokens Boundary</span>
                  <span className="text-indigo-500 font-black font-mono">{settings.maxTokens}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="8000"
                  step="500"
                  value={settings.maxTokens}
                  onChange={(e) => onUpdateSettings({ maxTokens: Number(e.target.value) })}
                  className="w-full accent-indigo-500 h-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-black tracking-widest">
                  <span>500 words</span>
                  <span>8000 words</span>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced RAG Pipelines panel */}
          <div className="glass-panel p-6 rounded-20 space-y-5">
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                Advanced LLM & RAG Pipelines
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-bold uppercase tracking-wider leading-relaxed">
                Activate cutting-edge retrieval techniques to enhance vector accuracy, compress prompt payloads, and audit model hallucination risk.
              </p>
            </div>

            <div className="space-y-4 pt-1">
              {/* Query Expansion & Fusion Toggle */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/20">
                <input
                  type="checkbox"
                  id="enableQueryExpansion"
                  checked={settings.enableQueryExpansion || false}
                  onChange={(e) => onUpdateSettings({ enableQueryExpansion: e.target.checked })}
                  className="mt-1 accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                />
                <div className="text-left">
                  <label htmlFor="enableQueryExpansion" className="text-xs font-extrabold text-slate-800 dark:text-slate-200 cursor-pointer block">
                    Query Expansion & Vector Fusion
                  </label>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 leading-normal uppercase font-bold tracking-wider">
                    Uses Gemini to synthesize multiple semantic formulations of the user's query, executing a unified multi-vector averaged grounding search.
                  </p>
                </div>
              </div>

              {/* Prompt Context Compression Toggle */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/20">
                <input
                  type="checkbox"
                  id="enablePromptCompression"
                  checked={settings.enablePromptCompression || false}
                  onChange={(e) => onUpdateSettings({ enablePromptCompression: e.target.checked })}
                  className="mt-1 accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                />
                <div className="text-left">
                  <label htmlFor="enablePromptCompression" className="text-xs font-extrabold text-slate-800 dark:text-slate-200 cursor-pointer block">
                    Prompt Context Compression
                  </label>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 leading-normal uppercase font-bold tracking-wider">
                    Summarizes and deduplicates retrieved vector documentation blocks server-side to shrink input context, saving up to 60% in token expenses.
                  </p>
                </div>
              </div>

              {/* Grounding Evaluation Audit Toggle */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/20">
                <input
                  type="checkbox"
                  id="enableGroundingEvaluation"
                  checked={settings.enableGroundingEvaluation || false}
                  onChange={(e) => onUpdateSettings({ enableGroundingEvaluation: e.target.checked })}
                  className="mt-1 accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                />
                <div className="text-left">
                  <label htmlFor="enableGroundingEvaluation" className="text-xs font-extrabold text-slate-800 dark:text-slate-200 cursor-pointer block">
                    Grounding Audit & Hallucination Shield
                  </label>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 leading-normal uppercase font-bold tracking-wider">
                    Executes an automated sub-agent audit to score response truthfulness and context alignment, flag hallucination risks, and calculate precision.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Corporate Identity & Themes panel */}
          <div className="glass-panel p-6 rounded-20 space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4.5 h-4.5 text-indigo-500" />
                Corporate Theme Identity
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-bold uppercase tracking-wider leading-relaxed">
                Choose an authoritative preset to realign primary action buttons, focused controls, and gradients.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {THEMES.map((t) => {
                const isActive = settings.activeThemeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onUpdateSettings({ activeThemeId: t.id })}
                    className={`p-4 rounded-xl border bg-white/40 dark:bg-slate-900/40 backdrop-blur-md text-left cursor-pointer transition-all duration-200 flex flex-col justify-between h-28 relative ${
                      isActive
                        ? "border-indigo-500 bg-indigo-500/[0.02] ring-1 ring-indigo-500/30"
                        : "border-slate-200/50 dark:border-slate-800/50 hover:border-slate-350"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.primary }} />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200">{t.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal line-clamp-1 font-bold uppercase tracking-wider">
                        {t.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between w-full mt-2">
                      <div className="flex gap-1.5">
                        <span className="w-4 h-1.5 rounded-full" style={{ backgroundColor: t.primary }} />
                        <span className="w-4 h-1.5 rounded-full opacity-70" style={{ backgroundColor: t.secondary }} />
                        <span className="w-4 h-1.5 rounded-full opacity-45" style={{ backgroundColor: t.gradientTo }} />
                      </div>
                      {isActive && (
                        <span className="text-[9px] font-black text-indigo-500 flex items-center gap-0.5 uppercase tracking-widest font-mono">
                          <CheckCircle className="w-3.5 h-3.5" /> Active Presets
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right side: Model selection & Telemetry Ping */}
        <div className="space-y-6">
          
          {/* Model picker list */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4.5 h-4.5 text-indigo-500" />
              AI Core Model
            </h3>

            <div className="space-y-3">
              {availableModels.map((m) => {
                const isSelected = settings.modelName === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleModelSelect(m.id, m.isPaid)}
                    className={`w-full p-4.5 rounded-20 border text-left cursor-pointer transition-all duration-150 flex flex-col justify-between backdrop-blur-md ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-500/[0.02] ring-1 ring-indigo-500/30 shadow-md shadow-indigo-500/5"
                        : "border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-[#111318]/40 hover:border-slate-350"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">{m.name}</span>
                      {m.isPaid && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-mono uppercase tracking-wider">
                          PREMIUM
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal font-bold uppercase tracking-wider">
                      {m.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language Selection Panel */}
          <div className="glass-panel p-6 rounded-20 space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span className="text-indigo-500 font-bold">A</span>
              <span>Workspace Language</span>
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider leading-relaxed">
              Choose the default system locale for briefings, reports, and agent interactions.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["en", "te", "hi"] as const).map((lang) => {
                const names = { en: "English", te: "తెలుగు", hi: "हिन्दी" };
                const isSel = settings.language === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => onUpdateSettings({ language: lang })}
                    className={`py-2 px-1 text-[10px] font-black rounded-xl border text-center transition-all cursor-pointer ${
                      isSel
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold"
                        : "border-slate-200/50 dark:border-slate-800/50 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    {names[lang]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notification Preferences Panel */}
          <div className="glass-panel p-6 rounded-20 space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
              <span>Notification Center</span>
            </h3>
            <div className="space-y-3 pt-1">
              {/* Sound Notifications */}
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 block">Audible Triggers</span>
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Sound effects on new messages</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableSoundNotifications ?? true}
                  onChange={(e) => onUpdateSettings({ enableSoundNotifications: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                />
              </div>

              {/* Email Alerts */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/40">
                <div className="text-left">
                  <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 block">Weekly Reports & Digests</span>
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Automated summary emails</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableEmailAlerts ?? true}
                  onChange={(e) => onUpdateSettings({ enableEmailAlerts: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                />
              </div>

              {/* Workspace Alerts */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/40">
                <div className="text-left">
                  <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 block">Smart Document Alerts</span>
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">Real-time vector updates</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableWorkspaceAlerts ?? true}
                  onChange={(e) => onUpdateSettings({ enableWorkspaceAlerts: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Connection Test Utility */}
          <div className="glass-panel p-6 rounded-20 space-y-4">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-indigo-500" />
              Telemetry Status
            </h3>

            <div className="space-y-3.5">
              <button
                onClick={testConnection}
                disabled={pingStatus === "loading"}
                className="w-full py-2.5 text-xs font-black rounded-xl border border-slate-200/50 dark:border-slate-800/50 hover:bg-white/40 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Test Server Latency</span>
              </button>

              {pingStatus === "loading" && (
                <div className="h-4 shimmer-bg rounded w-32 mx-auto animate-pulse" />
              )}

              {pingStatus === "success" && (
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-500/10 text-emerald-600 text-center space-y-0.5 border border-emerald-500/25">
                  <span className="text-[10px] font-black flex items-center gap-1 uppercase tracking-widest font-mono">
                    <CheckCircle className="w-3.5 h-3.5" /> API Server Live
                  </span>
                  <span className="text-[9px] font-black font-mono">ROUNDTRIP PING: {pingTime}ms</span>
                </div>
              )}

              {pingStatus === "error" && (
                <div className="flex items-center justify-center gap-1 p-3 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black border border-red-500/25 uppercase tracking-widest font-mono">
                  <AlertTriangle className="w-4 h-4" /> Connection Failure
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
