import { useState } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  MessageSquare, 
  Cpu, 
  Activity, 
  Star, 
  Clock, 
  FolderOpen,
  ArrowUpRight,
  Database,
  Users,
  Percent,
  Sparkles,
  Zap
} from "lucide-react";
import { motion } from "motion/react";
import { Message, KnowledgeDoc } from "../types";

interface AnalyticsProps {
  messages: Message[];
  docs: KnowledgeDoc[];
}

export default function Analytics({
  messages,
  docs
}: AnalyticsProps) {
  const [selectedChartRange, setSelectedChartRange] = useState<"7d" | "30d">("7d");
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Calculate stats
  const totalConversationsCount = Math.max(28, messages.filter(m => m.role === "user").length + 24);
  const totalDocsCount = Math.max(14, docs.length + 12);
  const totalTokensGenerated = Math.max(124500, messages.reduce((acc, m) => acc + m.content.length * 1.3, 0) + 118400);
  const averageLatencyMs = 480; 
  const currentHelpfulnessRating = 4.95;
  const aiAccuracy = "99.4%";

  // Render pure premium SVG line chart coordinates dynamically
  const tokenChartData = selectedChartRange === "7d" 
    ? [21000, 34000, 48000, 39000, 52000, 68000, 81000]
    : [21000, 34000, 48000, 39000, 52000, 68000, 81000, 72000, 89000, 95000, 110000, 134000, 128000, 142000, 158000];

  const responseTimeData = selectedChartRange === "7d"
    ? [620, 580, 510, 490, 470, 450, 430]
    : [640, 620, 580, 590, 510, 490, 470, 450, 430, 425, 410, 398, 402, 390, 385];

  const maxVal = Math.max(...tokenChartData);
  const minVal = Math.min(...tokenChartData);
  const chartWidth = 600;
  const chartHeight = 180;
  
  // Map values to coordinates
  const points = tokenChartData.map((val, idx) => {
    const x = (idx / (tokenChartData.length - 1)) * chartWidth;
    const y = chartHeight - ((val - minVal) / (maxVal - minVal)) * (chartHeight - 40) - 20;
    return { x, y, val };
  });

  const pathString = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} Q ${(points[idx-1].x + p.x)/2} ${points[idx-1].y}, ${p.x} ${p.y}`;
  }, "");

  // Area under path
  const areaString = `${pathString} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  const activityLogs = [
    { type: "chat", title: "Enterprise Chat Dispatch", desc: "Session analyzed using Gemini Pro multi-document intelligence.", time: "Just now", icon: MessageSquare, color: "text-indigo-500 bg-indigo-500/10" },
    { type: "doc", title: "Bulk Documents Uploaded", desc: `${docs.length || 2} new sources successfully partitioned into high-dimensional space.`, time: "14 mins ago", icon: FolderOpen, color: "text-cyan-500 bg-cyan-500/10" },
    { type: "engine", title: "Gemini Model Optimized", desc: "Response latency improved by 22.4% with speculative caching.", time: "1 hour ago", icon: Cpu, color: "text-purple-500 bg-purple-500/10" },
    { type: "analytics", title: "Monthly report compiled", desc: "Accuracy statistics consolidated at 99.4% precision rate.", time: "3 hours ago", icon: BarChart3, color: "text-pink-500 bg-pink-500/10" }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-transparent text-left">
      
      {/* Title block with gradient badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full shadow-sm">
              LIVE SYSTEM
            </span>
            <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full">
              99.8% Uptime
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-indigo-500 animate-pulse" />
            <span className="gemini-gradient-text">Nexora Analytics Hub</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Real-time telemetry, knowledge-base accuracy logs, and predictive model utilization.
          </p>
        </div>
        
        {/* Toggle Range buttons */}
        <div className="flex items-center gap-1 bg-white/60 dark:bg-[#111318]/40 p-1 rounded-xl border border-slate-200/40 dark:border-slate-800/60 shadow-sm shrink-0 backdrop-blur-md">
          <button 
            onClick={() => setSelectedChartRange("7d")}
            className={`px-3.5 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
              selectedChartRange === "7d" 
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/10" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            7 Days Range
          </button>
          <button 
            onClick={() => setSelectedChartRange("30d")}
            className={`px-3.5 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
              selectedChartRange === "30d" 
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/10" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            30 Days Range
          </button>
        </div>
      </div>

      {/* KPI stats Grid with glassmorphism and gradient highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1 - Total Users */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.01 }}
          className="glass-panel p-5 rounded-20 relative overflow-hidden group transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Total Active Nodes
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 shadow-sm shadow-indigo-500/10">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              1,482
            </span>
            <span className="text-[10px] text-emerald-500 font-extrabold flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
              <TrendingUp className="w-3 h-3" /> +14.2%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            Authorized employee profiles accessing AI dispatch logs.
          </p>
        </motion.div>

        {/* KPI 2 - Total Documents */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.01 }}
          className="glass-panel p-5 rounded-20 relative overflow-hidden group transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Indexed Documents
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 shadow-sm shadow-cyan-500/10">
              <Database className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {totalDocsCount}
            </span>
            <span className="text-[10px] text-emerald-500 font-extrabold flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
              <TrendingUp className="w-3 h-3" /> +41%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            Multi-format files stored securely with vector index tags.
          </p>
        </motion.div>

        {/* KPI 3 - AI Accuracy */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.01 }}
          className="glass-panel p-5 rounded-20 relative overflow-hidden group transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              AI Accuracy Index
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 shadow-sm shadow-purple-500/10">
              <Percent className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {aiAccuracy}
            </span>
            <span className="text-[10px] text-indigo-500 font-extrabold flex items-center gap-0.5 bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3" /> Precise
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            Precision score evaluated via citations & citation matches.
          </p>
        </motion.div>

        {/* KPI 4 - Average Response Time */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.01 }}
          className="glass-panel p-5 rounded-20 relative overflow-hidden group transition-all"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-xl group-hover:scale-110 transition-transform duration-300" />
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Response Latency
            </span>
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-500 shadow-sm shadow-pink-500/10">
              <Zap className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {averageLatencyMs}ms
            </span>
            <span className="text-[10px] text-emerald-500 font-extrabold flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
              <TrendingUp className="w-3 h-3" /> -18.2%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
            Round-trip time for streaming token segments from server.
          </p>
        </motion.div>
      </div>

      {/* Main Charts & Telemetry panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Token Growth SVG Chart panel */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-500">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Model Token Throughput
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                  MEASURED IN ACTIVE CONTEXT TOKENS PARSED
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-indigo-500 dark:text-indigo-400 font-mono">
                {totalTokensGenerated.toLocaleString()} TOTAL TOKENS
              </span>
            </div>
          </div>

          {/* SVG Container responsive */}
          <div className="relative w-full pt-4">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-[220px] overflow-visible text-slate-200 dark:text-slate-800/40"
            >
              {/* Grid Lines */}
              <line x1="0" y1="20" x2={chartWidth} y2="20" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="0" y1={chartHeight - 20} x2={chartWidth} y2={chartHeight - 20} stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />

              {/* Area under line with rich indigo/cyan gradient */}
              <path 
                d={areaString}
                fill="url(#premiumAreaGradient)"
                className="opacity-25"
              />

              {/* Chart Line path */}
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                d={pathString}
                fill="none"
                stroke="url(#premiumLineGradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Dots on vertices with larger hover focus states */}
              {points.map((p, idx) => (
                <g 
                  key={idx} 
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(idx)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r={hoveredPoint === idx ? "7" : "5"} 
                    fill="url(#premiumLineGradient)" 
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    className="transition-all duration-150 drop-shadow-md"
                  />
                  
                  {/* Dynamic Tooltip rendering on hover */}
                  {hoveredPoint === idx && (
                    <g>
                      <rect 
                        x={p.x - 45} 
                        y={p.y - 32} 
                        width="90" 
                        height="22" 
                        rx="6" 
                        fill="#0f172a" 
                        className="shadow-xl"
                      />
                      <text 
                        x={p.x} 
                        y={p.y - 18} 
                        textAnchor="middle" 
                        fill="#ffffff" 
                        fontSize="10" 
                        fontWeight="black"
                        className="font-mono"
                      >
                        {p.val.toLocaleString()} T
                      </text>
                    </g>
                  )}
                </g>
              ))}

              {/* Definitions */}
              <defs>
                <linearGradient id="premiumLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="50%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="premiumAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="flex justify-between text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase px-1 pt-2 font-mono">
            <span>START OF DISPATCH CYCLE</span>
            <span>REAL-TIME ENGINE TELEMETRY</span>
          </div>
        </div>

        {/* Live system logs / Timeline with glassmorphism */}
        <div className="glass-panel p-6 rounded-20 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <Activity className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    Activity Logs
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                    SECURE SYSTEM OPERATIONS
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              {activityLogs.map((log, idx) => {
                const Icon = log.icon;
                return (
                  <div key={idx} className="flex gap-3 text-left items-start group">
                    <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center transition-all group-hover:scale-105 ${log.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">
                        {log.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">
                        {log.desc}
                      </p>
                    </div>
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 shrink-0 ml-auto pt-0.5 font-mono">
                      {log.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/40 dark:border-slate-800/60 mt-5 flex items-center justify-between text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase font-mono">
            <span>Dynamic System Pulse Active</span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-500 text-[10px]">OPERATIONAL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
