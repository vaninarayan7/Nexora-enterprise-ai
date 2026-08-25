import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Globe, 
  Sparkles, 
  Zap, 
  Shield, 
  Database, 
  ArrowRight, 
  Star, 
  Check, 
  HelpCircle, 
  Chrome, 
  Mail, 
  Key, 
  User, 
  Lock, 
  Clock, 
  ChevronDown, 
  Compass, 
  Terminal, 
  Laptop, 
  Building,
  UserCheck,
  Users
} from "lucide-react";
import { UserProfile, UserRole } from "../types";
import { 
  googleSignIn, 
  signUpEmailPassword, 
  loginEmailPassword, 
  forgotPasswordReset 
} from "../lib/firebaseAuth";

interface LandingPageProps {
  onLoginSuccess: (user: UserProfile) => void;
  triggerToast: (msg: string, type: "success" | "info" | "error") => void;
  isDarkMode: boolean;
  onExploreWorkspace: () => void;
}

export default function LandingPage({
  onLoginSuccess,
  triggerToast,
  isDarkMode,
  onExploreWorkspace
}: LandingPageProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showAuthFlow, setShowAuthFlow] = useState(false);
  const [authStage, setAuthStage] = useState<"role_select" | "org_input">("role_select");
  const [selectedRole, setSelectedRole] = useState<UserRole>("Employee");
  const [orgInput, setOrgInput] = useState("");
  
  // Real Email Auth Form states (keeping for backwards compatibility if needed, but not primarily used in the new flow)
  const [emailMode, setEmailMode] = useState<"login" | "signup" | "forgot">("login");
  const [regDisplayName, setRegDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Auth Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  React.useEffect(() => {
    const pendingRole = sessionStorage.getItem("pending_role") as UserRole | null;
    if (pendingRole) {
      setSelectedRole(pendingRole);
      setAuthStage("org_input");
      setShowAuthFlow(true);
    }
  }, []);

  // AI Sandbox Tryout Area
  const [sandboxPrompt, setSandboxPrompt] = useState("Summarize enterprise retention vectors");
  const [sandboxResponse, setSandboxResponse] = useState("");
  const [isSandboxSimulating, setIsSandboxSimulating] = useState(false);

  const handleRunSandbox = () => {
    if (!sandboxPrompt.trim()) return;
    setIsSandboxSimulating(true);
    setSandboxResponse("");
    
    const responses: Record<string, string> = {
      "summarize enterprise retention vectors": "📊 **NEXORA ANALYSIS SUMMARY**:\n\n*   **Core Vector 1 (Onboarding Activation)**: Enterprise members indexing text files within 48 hours demonstrate **+75% higher LTV**.\n*   **Core Vector 2 (Expansion Churn)**: Accounts with active collaborative project folders experience a negligible **0.8% annual attrition rate**.\n*   **Actionable Strategy**: Trigger automatic prompt optimization guides when workspace utilization falls below 3 interactions/week.",
      "security standards": "🔒 **COMPLIANCE & SECURITY NODES**:\n\n*   **Standards**: SOC 2 Type II Certified, HIPAA compliant pipeline.\n*   **Encryption**: AES-256 at-rest, TLS 1.3 in-transit.\n*   **Governance**: Active role-based permissions syncing with AD/Okta directory nodes immediately upon startup.",
      "default": "✨ **AI INSTANCE RESPONSE**:\n\nProcessed prompt via Gemini Workspace Node. Ready to ingest customized document vectors, generate complex code outlines, and distribute automated newsletter summaries across active email integrations."
    };

    const cleanPrompt = sandboxPrompt.toLowerCase().trim();
    const targetResponse = responses[cleanPrompt] || responses["default"];

    let index = 0;
    const interval = setInterval(() => {
      setSandboxResponse(prev => prev + targetResponse.charAt(index));
      index++;
      if (index >= targetResponse.length) {
        clearInterval(interval);
        setIsSandboxSimulating(false);
      }
    }, 15);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      triggerToast("Please enter a valid enterprise email.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      if (emailMode === "forgot") {
        await forgotPasswordReset(email);
        triggerToast("Password reset email successfully sent. Please check your inbox.", "success");
        setEmailMode("login");
      } else if (emailMode === "signup") {
        if (password.length < 6) {
          triggerToast("Password must be at least 6 characters.", "error");
          setIsSubmitting(false);
          return;
        }
        const displayNameValue = regDisplayName.trim() || email.split("@")[0].toUpperCase();
        // Always create new users with the least-privileged role.
        // Admins must be promoted manually via the database — never via the UI.
        const result = await signUpEmailPassword(email, password, displayNameValue, "Employee");
        onLoginSuccess({
          uid: result.user.uid,
          email: result.user.email || email,
          displayName: displayNameValue,
          role: result.role,
          token: await result.user.getIdToken()
        });
        setShowAuthFlow(false);
        triggerToast(`Enterprise Account Created! Logged in as ${result.role}`, "success");
      } else {
        // "login" mode
        const result = await loginEmailPassword(email, password);
        onLoginSuccess({
          uid: result.user.uid,
          email: result.user.email || email,
          displayName: result.user.displayName || email.split("@")[0].toUpperCase(),
          role: result.role,
          token: await result.user.getIdToken()
        });
        setShowAuthFlow(false);
        triggerToast(`Welcome back! Authenticated as ${result.role}`, "success");
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "Authentication attempt failed. Please check credentials.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pricingPlans = [
    {
      name: "Standard Node",
      badge: "Sandbox",
      price: billingCycle === "yearly" ? "$12" : "$19",
      period: "per seat/mo",
      description: "Perfect for lightweight analysts seeking modular vector search capability.",
      features: [
        "Unlimited model access (Flash models)",
        "50 document index capacity (PDF, DOCX, TXT)",
        "Secure LocalStorage persistence",
        "Standard Prompt Optimizer & Templates",
        "Manual email dispatches & summaries"
      ],
      cta: "Launch Sandbox Core",
      highlighted: false
    },
    {
      name: "Enterprise Core",
      badge: "Popular Node",
      price: billingCycle === "yearly" ? "$49" : "$69",
      period: "per seat/mo",
      description: "Complete full-stack integration with advanced RAG systems and workspace automation.",
      features: [
        "Priority AI Processing (Gemini Pro models)",
        "Uncapped vector database parsing",
        "Interactive Meeting Audio transcription",
        "Team Workspace with Kanban & Calendars",
        "Automated Gmail automation dispatches",
        "Custom agent workspace prompt configurations"
      ],
      cta: "Initialize Node Instance",
      highlighted: true
    },
    {
      name: "Quantum Sovereign",
      badge: "Dedicated",
      price: "Custom",
      period: "tailored layout",
      description: "Complete private cloud nodes with multi-tenant directory locks and custom embeddings.",
      features: [
        "Private dedicated API endpoints",
        "Custom FAISS & vector model tuning",
        "Compliance & Contract risk auditor filters",
        "Full Slack/Atlassian/Okta SSO directory syncs",
        "Premium SLA support with dedicated PM nodes",
        "In-network sovereign offline capability"
      ],
      cta: "Request Consultation",
      highlighted: false
    }
  ];

  const faqs = [
    {
      question: "How does Nexora RAG ensure enterprise document security?",
      answer: "All document vectors are parsed through secure memory sandboxes. Embeddings are stored with local user identity associations, ensuring that no file details ever pollute the public base model."
    },
    {
      question: "Can we synchronize with active G-Suite / Workspace contexts?",
      answer: "Yes! Nexora connects natively to Gmail APIs to compile automated weekly summaries, dispatch tasks automatically from Kanban actions, and send custom digest briefs."
    },
    {
      question: "What document types are supported for AI indexing?",
      answer: "Nexora parses PDF, DOCX, TXT, CSV, and Excel tables. It extracts key structural elements like tabular data matrices, markdown summaries, and high-level risk points instantly."
    },
    {
      question: "Does the Meeting Assistant require live audio streaming?",
      answer: "No, Nexora accepts files (such as WAV or MP3 minutes) or simulates a microphone feed to execute high-fidelity voice-to-text transcriptions, action-item extraction, and summary emails."
    }
  ];

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-slate-50/50 via-indigo-50/20 to-white dark:from-[#0a0c16] dark:via-slate-900/40 dark:to-[#0f111a] px-4 md:px-8 py-10">
      
      {/* Aurora Top Blur Decoration */}
      <div className="absolute top-0 left-1/4 right-1/4 h-72 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-teal-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Hero Header Area */}
      <div className="max-w-6xl mx-auto text-center relative z-10 pt-4 pb-12">
        <div className="relative mx-auto w-full max-w-[550px] aspect-square rounded-full bg-indigo-500/[0.06] dark:bg-indigo-950/20 backdrop-blur-3xl flex flex-col items-center justify-center p-8 sm:p-12 mb-8 shadow-sm border border-indigo-100/30 dark:border-indigo-950/20">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>v2.8 Enterprise Node Enabled</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white leading-none tracking-tight max-w-4xl mx-auto"
          >
            Nexora AI Workspace
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-md md:text-lg text-[var(--theme-primary)] dark:text-indigo-400 font-extrabold uppercase tracking-wider mt-2.5"
          >
            "The Future of Enterprise Intelligence"
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-4 leading-relaxed font-medium"
          >
            An all-in-one semantic platform merging high-speed vector RAG, custom department agents, automated Gmail summary flows, and robust Kanban task managers into a singular secure node.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-4 mt-8 flex-wrap"
        >
          <button
            onClick={onExploreWorkspace}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/25 transition-all cursor-pointer flex items-center gap-2 hover:scale-[1.02]"
          >
            <UserCheck className="w-4 h-4" />
            <span>Access Portal Gateway</span>
          </button>
          
          <button
            onClick={onExploreWorkspace}
            className="px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all flex items-center gap-2"
          >
            <span>Explore Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>

      {/* Main Feature Cards Showcase */}
      <div className="max-w-6xl mx-auto mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        <motion.div
          whileHover={{ y: -4 }}
          className="p-6 rounded-2xl bg-white/70 dark:bg-[#111318]/70 border border-slate-200/50 dark:border-slate-800/50 shadow-sm backdrop-blur text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-2">Vector RAG Engine</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Upload TXT, PDF, or markdown logs. Our chunking engine parses indexes immediately, enabling hyper-accurate semantic search citations.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="p-6 rounded-2xl bg-white/70 dark:bg-[#111318]/70 border border-slate-200/50 dark:border-slate-800/50 shadow-sm backdrop-blur text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-2">Specialist AI Agents</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Activate legal risk, marketing expansion, financial metric, or coding assistant models tailored for high-speed expert operations.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="p-6 rounded-2xl bg-white/70 dark:bg-[#111318]/70 border border-slate-200/50 dark:border-slate-800/50 shadow-sm backdrop-blur text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center mb-4">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-2">Sovereign Compliance</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Role-based access nodes, dynamic secure logs, in-transit encryption, and transparent directory checks preserve vector privacy.
          </p>
        </motion.div>
      </div>

      {/* AI Tryout Sandbox Section */}
      <div className="max-w-4xl mx-auto mt-16 bg-white/40 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-850/60 rounded-3xl p-6 md:p-8 backdrop-blur-md text-left relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-xl rounded-full" />
        
        <div className="flex items-center gap-3 mb-4">
          <Terminal className="w-5 h-5 text-indigo-500" />
          <div>
            <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">Nexora Interactive Sandbox</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Test live query vector analysis</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={sandboxPrompt}
            onChange={(e) => setSandboxPrompt(e.target.value)}
            placeholder="Type 'summarize enterprise retention vectors' or 'security standards'..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 dark:text-slate-100 font-medium"
          />
          <button
            onClick={handleRunSandbox}
            disabled={isSandboxSimulating}
            className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isSandboxSimulating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Parsing...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Simulate Query</span>
              </>
            )}
          </button>
        </div>

        {/* Tryout presets */}
        <div className="flex gap-2.5 mt-3.5 flex-wrap">
          <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider self-center">Sandbox Presets:</span>
          <button
            onClick={() => setSandboxPrompt("Summarize enterprise retention vectors")}
            className="text-[9px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Retention Metrics
          </button>
          <button
            onClick={() => setSandboxPrompt("Security Standards")}
            className="text-[9px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Compliance Keys
          </button>
        </div>

        {/* Sandbox Output Log */}
        <AnimatePresence>
          {sandboxResponse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.02] dark:bg-slate-950/60 font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap select-text max-h-52 overflow-y-auto"
            >
              {sandboxResponse}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Metrics and Statistics Banner */}
      <div className="max-w-5xl mx-auto mt-20 border-y border-slate-200/60 dark:border-slate-850/60 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <h4 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight">1.2ms</h4>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-1">Vector Search Delay</p>
          </div>
          <div>
            <h4 className="text-3xl font-black text-slate-800 dark:text-white font-mono tracking-tight">99.98%</h4>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-1">Factual Truth Rate</p>
          </div>
          <div>
            <h4 className="text-3xl font-black text-slate-800 dark:text-white font-mono tracking-tight">4.8M</h4>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-1">Daily Token Processing</p>
          </div>
          <div>
            <h4 className="text-3xl font-black text-teal-500 dark:text-teal-400 font-mono tracking-tight">Zero-Log</h4>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-1">Privacy Guarantee</p>
          </div>
        </div>
      </div>

      {/* Interactive Pricing Grid */}
      <div className="max-w-6xl mx-auto mt-20 text-center relative z-10">
        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-wider mb-2">Flexible Scaling Nodes</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-6">Equip your team with state-of-the-art context processing</p>

        {/* Pricing Toggle */}
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 mb-10">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
              billingCycle === "monthly" 
                ? "bg-white dark:bg-[#111318] text-slate-800 dark:text-white shadow-sm"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 ${
              billingCycle === "yearly" 
                ? "bg-white dark:bg-[#111318] text-indigo-500 dark:text-indigo-400 shadow-sm"
                : "text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400"
            }`}
          >
            <span>Yearly</span>
            <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded text-[8px] font-mono lowercase">-30%</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left items-stretch">
          {pricingPlans.map((plan, i) => (
            <div
              key={i}
              className={`p-6 rounded-2xl bg-white dark:bg-[#111318] border transition-all duration-300 relative flex flex-col justify-between ${
                plan.highlighted 
                  ? "border-indigo-500 dark:border-indigo-400 shadow-xl shadow-indigo-500/[0.04] md:-translate-y-2 scale-[1.01]" 
                  : "border-slate-200/60 dark:border-slate-850/60 shadow-sm"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute top-0 right-6 -translate-y-1/2 px-2.5 py-0.5 bg-gradient-to-r from-indigo-500 to-teal-400 text-white text-[8px] font-black uppercase tracking-wider rounded-full shadow-md">
                  Most Robust Node
                </span>
              )}

              <div>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                    {plan.badge}
                  </span>
                </div>
                
                <h4 className="text-md font-black text-slate-800 dark:text-white uppercase tracking-wider mt-2">
                  {plan.name}
                </h4>

                <div className="flex items-baseline gap-1 mt-4 mb-3">
                  <span className="text-3xl font-black text-slate-800 dark:text-white font-mono">{plan.price}</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{plan.period}</span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-6 font-medium">
                  {plan.description}
                </p>

                <div className="h-px bg-slate-100 dark:bg-slate-850/60 my-4" />

                <ul className="space-y-2.5">
                  {plan.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      <Check className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => {
                  triggerToast(`Initializing setup script for Nexora ${plan.name} node...`, "info");
                  setShowAuthFlow(true);
                }}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest mt-8 transition-all cursor-pointer ${
                  plan.highlighted
                    ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:opacity-95 shadow-md"
                    : "border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Accordion Section */}
      <div className="max-w-3xl mx-auto mt-24 text-left relative z-10">
        <div className="text-center mb-10">
          <HelpCircle className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
          <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-wider">Expert Node Inquiries</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">Common questions surrounding context parsing and security</p>
        </div>

        <div className="space-y-3.5">
          {faqs.map((faq, i) => {
            const isOpen = activeFaq === i;
            return (
              <div 
                key={i}
                className="rounded-2xl border border-slate-200/50 dark:border-slate-850/50 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm overflow-hidden"
              >
                <button
                  onClick={() => setActiveFaq(isOpen ? null : i)}
                  className="w-full p-4 flex items-center justify-between text-left text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors outline-none cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="p-4 pt-0 border-t border-slate-100 dark:border-slate-850 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium select-text">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer Reviews Section */}
      <div className="max-w-5xl mx-auto mt-24 text-left relative z-10">
        <div className="text-center mb-10">
          <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-wider">Praise From The Cluster</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">Testimonials from enterprise operations team nodes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-white/70 dark:bg-[#111318]/70 border border-slate-200/60 dark:border-slate-800/60 shadow-sm backdrop-blur">
            <div className="flex gap-1 mb-2.5">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed font-medium select-text">
              "Deploying Nexora vectors to our core legal group solved our entire document compilation problem. Chunks are retrieved with flawless metadata confidence, eliminating hallucination rates entirely."
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-[10px]">
                SR
              </div>
              <div>
                <span className="text-xs font-black text-slate-800 dark:text-white block uppercase">Soren Rydell</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">VP Engineering • Sentinel Corp</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/70 dark:bg-[#111318]/70 border border-slate-200/60 dark:border-slate-800/60 shadow-sm backdrop-blur">
            <div className="flex gap-1 mb-2.5">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed font-medium select-text">
              "We automated our weekly performance metrics summary pipeline with Nexora's integrated email node dispatcher. The custom prompt templates save our marketing and sales departments hours of drafting."
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-400 to-indigo-500 text-white flex items-center justify-center font-bold text-[10px]">
                AM
              </div>
              <div>
                <span className="text-xs font-black text-slate-800 dark:text-white block uppercase">Anya Moretti</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Director Analytics • Confluence-V</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Area */}
      <footer className="max-w-6xl mx-auto mt-24 pt-10 border-t border-slate-200/50 dark:border-slate-850/60 text-center relative z-10 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black flex flex-col sm:flex-row items-center justify-between gap-4">
        <span>© 2026 NEXORA AI SYSTEMS, INC. SOVEREIGN ENGINE</span>
        <div className="flex gap-5 font-bold tracking-widest text-slate-400 dark:text-slate-500">
          <span className="hover:text-indigo-500 cursor-pointer">Security Terms</span>
          <span className="hover:text-indigo-500 cursor-pointer">API Node Documentation</span>
          <span className="hover:text-indigo-500 cursor-pointer">Privacy Safeguards</span>
        </div>
      </footer>

      {/* Authentication Gateway Flow Overlay Portal */}
      <AnimatePresence>
        {showAuthFlow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthFlow(false)}
              className="absolute inset-0 bg-slate-950"
            />
            
            <motion.div
              initial={{ scale: 0.93, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0, y: 15 }}
              className="relative w-full max-w-md bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center shadow-2xl overflow-hidden"
            >
              {/* Sleek top loading line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-teal-400" />
              
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <Compass className="w-4 h-4 animate-spin-slow" />
                  </div>
                  <span className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-widest">Nexora Node Auth</span>
                </div>
                <button
                  onClick={() => {
                    setShowAuthFlow(false);
                    setAuthStage("role_select");
                    setOrgInput("");
                  }}
                  className="text-[9px] font-black uppercase text-red-500 hover:text-red-600 tracking-widest"
                >
                  Abstain
                </button>
              </div>

              {authStage === "role_select" && (
                <div className="space-y-4 animate-fade text-left">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-1 text-center">Select Role</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-6 text-center">How are you joining?</p>
                  
                  <button
                    onClick={() => {
                      setSelectedRole("Admin");
                      setAuthStage("org_input");
                    }}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/60 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
                      <span>Continue as Admin (Create Org)</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRole("Manager");
                      setAuthStage("org_input");
                    }}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/60 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4.5 h-4.5 text-purple-500 shrink-0" />
                      <span>Continue as Manager (Join Org)</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedRole("Employee");
                      setAuthStage("org_input");
                    }}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/60 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-4.5 h-4.5 text-teal-500 shrink-0" />
                      <span>Continue as Employee (Join Org)</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>


                </div>
              )}

              {authStage === "org_input" && (
                <div className="space-y-4 animate-fade text-left">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-1 text-center">
                    {selectedRole === "Super Admin" || selectedRole === "Admin" || selectedRole === "Organizer"
                      ? `${selectedRole === "Admin" || selectedRole === "Organizer" ? "Organizer" : "Super Admin"} Authentication` 
                      : "Join Organization"}
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-6 text-center">
                    {selectedRole === "Super Admin" || selectedRole === "Admin" || selectedRole === "Organizer"
                      ? "Authenticate to access platform controls"
                      : "Enter your invite code"}
                  </p>
                  
                  {(selectedRole !== "Super Admin" && selectedRole !== "Admin" && selectedRole !== "Organizer") && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-between">
                        <span>Invite Code</span>
                        <span className="text-slate-400 font-medium normal-case">(Optional for returning users)</span>
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={orgInput}
                          onChange={(e) => setOrgInput(e.target.value)}
                          placeholder="e.g., EMP-123456 or MGR-654321"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    disabled={isSubmitting}
                    onClick={async () => {
                      setIsSubmitting(true);
                      try {
                        const { setSelectedRole: setGlobalRole, googleSignInAndSetup } = await import("../lib/firebaseAuth");
                        setGlobalRole(selectedRole);
                        const result = await googleSignInAndSetup(
                          (selectedRole === "Super Admin" || selectedRole === "Admin" || selectedRole === "Organizer") ? "bypass_org_input" : orgInput.trim()
                        );
                        if (result) {
                          onLoginSuccess({
                            uid: result.user.uid,
                            email: result.user.email || "",
                            displayName: result.user.displayName || "Enterprise Member",
                            photoURL: result.user.photoURL || undefined,
                            role: result.profile.role as UserRole,
                            token: result.token,
                            organizationId: result.profile.organizationId,
                            organizationName: result.profile.organizationName
                          });
                          setShowAuthFlow(false);
                          triggerToast(`Successfully authenticated as ${result.profile.role}!`, "success");
                        }
                      } catch (error: any) {
                        triggerToast(error.message || "Failed to authenticate", "error");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-black uppercase tracking-widest mt-6 cursor-pointer flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span>Processing...</span>
                    ) : (
                      <>
                        <Chrome className="w-3.5 h-3.5" />
                        <span>Continue with Workspace</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthStage("role_select");
                    }}
                    className="w-full text-center text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 tracking-wider mt-4"
                  >
                    Back to Roles
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
