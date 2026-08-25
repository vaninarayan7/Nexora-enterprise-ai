import React, { useState, useRef, useEffect } from "react";
import { 
  FolderOpen, 
  Plus, 
  Trash2, 
  FileText, 
  HardDrive, 
  Layers, 
  CheckCircle, 
  AlertCircle, 
  Cpu, 
  Search,
  ChevronRight,
  Sparkles,
  Database,
  UploadCloud,
  Loader2,
  FileCode,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { extractTextFromFile, validateDocumentContent } from "../lib/documentIndexing";
import { KnowledgeDoc } from "../types";

interface KnowledgeBaseProps {
  docs: KnowledgeDoc[];
  onAddDoc: (name: string, content: string) => Promise<void>;
  onDeleteDoc: (id: string) => void;
  onClearDocs: () => void;
}

export default function KnowledgeBase({
  docs,
  onAddDoc,
  onDeleteDoc,
  onClearDocs
}: KnowledgeBaseProps) {
  const [docName, setDocName] = useState("");
  const [docContent, setDocContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDoc | null>(null);
  
  // Custom manual processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingState, setProcessingState] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0); // For circular progress
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // RAG Simulator states
  const [sidebarTab, setSidebarTab] = useState<"chunks" | "simulator" | "intelligence">("chunks");
  const [simulatorQuery, setSimulatorQuery] = useState("");
  const [chunkSize, setChunkSize] = useState(40); // words
  const [chunkOverlap, setChunkOverlap] = useState(10); // words
  const [activeMatchingChunks, setActiveMatchingChunks] = useState<{ text: string; score: number }[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // AI Document Intelligence states
  const [selectedIntelAction, setSelectedIntelAction] = useState<"summarize" | "extract" | "faqs" | "explain" | "report" | "translate">("summarize");
  const [selectedIntelLang, setSelectedIntelLang] = useState<"en" | "te" | "hi">("en");
  const [intelResult, setIntelResult] = useState<string>("");
  const [isIntelLoading, setIsIntelLoading] = useState(false);

  // Reset simulator when doc preview changes
  useEffect(() => {
    setSimulatorQuery("");
    setActiveMatchingChunks([]);
    setIntelResult("");
    setSidebarTab("chunks");
  }, [previewDoc]);

  // Dynamic chunking algorithm
  const getChunksOfDoc = (text: string, size: number, overlap: number) => {
    if (!text) return [];
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    
    let i = 0;
    while (i < words.length) {
      const chunkWords = words.slice(i, i + size);
      if (chunkWords.length > 0) {
        chunks.push(chunkWords.join(" "));
      }
      i += (size - overlap) > 0 ? (size - overlap) : size;
    }
    return chunks;
  };

  // Cosine-like similarity estimator based on keyword overlaps and phrase affinity
  const calculateSimilarity = (chunkText: string, query: string) => {
    if (!query.trim()) return 0;
    
    const cleanTokens = (str: string) => 
      str.toLowerCase()
         .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
         .split(/\s+/)
         .filter(Boolean);
         
    const chunkTokens = cleanTokens(chunkText);
    const queryTokens = cleanTokens(query);
    
    if (queryTokens.length === 0) return 0;
    
    let matches = 0;
    queryTokens.forEach(t => {
      if (chunkText.toLowerCase().includes(t)) {
        matches++;
      }
    });
    
    let exactPhraseMatches = 0;
    const cleanQuery = query.toLowerCase().trim();
    if (chunkText.toLowerCase().includes(cleanQuery)) {
      exactPhraseMatches = 2;
    }
    
    const overlapScore = matches / queryTokens.length;
    let score = 0;
    if (matches > 0) {
      score = 0.45 + (overlapScore * 0.4) + (exactPhraseMatches * 0.05);
    }
    
    return Math.min(0.985, score);
  };

  const runSimulation = () => {
    if (!previewDoc) return;
    setIsSimulating(true);
    // Mimic embedding similarity search processing time
    setTimeout(() => {
      const chunks = getChunksOfDoc(previewDoc.content, chunkSize, chunkOverlap);
      const scored = chunks.map(c => ({
        text: c,
        score: calculateSimilarity(c, simulatorQuery)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);
      
      setActiveMatchingChunks(scored);
      setIsSimulating(false);
    }, 600);
  };

  const handleExecuteIntelligence = async () => {
    if (!previewDoc) return;
    setIsIntelLoading(true);
    setIntelResult("");
    try {
      const response = await fetch("/api/documents/intelligence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: selectedIntelAction,
          content: previewDoc.content,
          language: selectedIntelLang
        })
      });
      const data = await response.json();
      if (data.success) {
        setIntelResult(data.result);
      } else {
        setIntelResult(`### Error\nFailed to process request: ${data.error || "Unknown server error"}`);
      }
    } catch (err: any) {
      setIntelResult(`### Connection Error\n${err.message || "Could not reach server API."}`);
    } finally {
      setIsIntelLoading(false);
    }
  };

  // Parse total size of workspace memory
  const totalCharacters = docs.reduce((acc, d) => acc + d.content.length, 0);
  const totalSizeKB = (totalCharacters / 1024).toFixed(1);
  const percentUsed = Math.min(100, (Number(totalSizeKB) / 2048) * 100); // 2MB limit

  // Simulate progress ring animation during vectorization
  const runProgressAnimation = (callback: () => void) => {
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(callback, 300);
          return 100;
        }
        return prev + 15;
      });
    }, 120);
  };

  const handleCreateDocument = async () => {
    if (!docName.trim() || !docContent.trim()) return;
    
    setIsProcessing(true);
    setProcessingState("Parsing structural lines...");
    
    runProgressAnimation(async () => {
      setProcessingState("Synchronizing with vector indexer...");
      try {
        await onAddDoc(
          docName.endsWith(".md") || docName.endsWith(".txt") ? docName : `${docName}.txt`,
          docContent
        );
        setDocName("");
        setDocContent("");
        setIsProcessing(false);
        setShowAddForm(false);
        setUploadProgress(0);
      } catch (err) {
        setIsProcessing(false);
        setUploadProgress(0);
      }
    });
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processUploadedFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processUploadedFile(files[0]);
    }
  };

  // Process dropped/selected files
  const processUploadedFile = async (file: File) => {
    setIsProcessing(true);
    setProcessingState(`Uploading "${file.name}"...`);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      
      runProgressAnimation(async () => {
        setProcessingState("Splitting into overlapping chunks...");
        try {
          await onAddDoc(file.name, text || `Raw uploaded payload from ${file.name}`);
          setIsProcessing(false);
          setUploadProgress(0);
        } catch (err) {
          setIsProcessing(false);
          setUploadProgress(0);
        }
      });
    };

    reader.onerror = () => {
      setIsProcessing(false);
      setUploadProgress(0);
    };

    reader.readAsText(file);
  };

  const filteredDocs = docs.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Math for SVG Circular Progress Ring
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (uploadProgress / 100) * circumference;

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-transparent transition-colors">
      
      {/* Left side: Docs controller */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6">
        
        {/* Title panel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 rounded-full">
                Vector Storage
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <FolderOpen className="w-6 h-6 text-indigo-500" />
              <span className="gemini-gradient-text">Nexora Knowledge Hub</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Manage enterprise specifications, reports, or policies to ground your RAG chatbot contexts.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/15 hover:opacity-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Compose Doc</span>
            </button>
            {docs.length > 0 && (
              <button
                onClick={onClearDocs}
                className="px-4 py-2 text-xs font-black text-red-500 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-all cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Drag and Drop Zone & Upload Progress Indicator */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-8 rounded-20 border-2 border-dashed transition-all cursor-pointer text-center relative overflow-hidden backdrop-blur-md ${
            isDragging 
              ? "border-indigo-500 bg-indigo-500/[0.04] scale-[0.99]" 
              : "border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-[#111318]/40 hover:border-indigo-500/50"
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            accept=".txt,.md,.json,.csv,.xml,.js,.ts"
          />

          <div className="flex flex-col items-center justify-center gap-3">
            {isProcessing ? (
              <div className="relative flex items-center justify-center h-16 w-16 mb-1">
                {/* SVG Circular Progress Meter */}
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="3.5"
                    fill="transparent"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="text-indigo-500 transition-all duration-150"
                  />
                </svg>
                {/* Embedded Centered percentage text */}
                <span className="absolute text-[10px] font-black font-mono text-slate-700 dark:text-slate-300">
                  {uploadProgress}%
                </span>
              </div>
            ) : (
              <div className="p-4 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25 mb-1 animate-pulse">
                <UploadCloud className="w-6 h-6" />
              </div>
            )}

            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
                {isProcessing ? "Vectorizing Attachment..." : "Drag & Drop Enterprise Documents"}
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-bold uppercase tracking-wider">
                {isProcessing ? processingState : "Supports PDF, DOCX, Markdown, Text, and CSV files (Max 24MB)"}
              </p>
            </div>
          </div>
        </div>

        {/* Memory status card with glassmorphism */}
        <div className="glass-panel p-5 rounded-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/10 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">RAG Vector Index Space</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                {docs.length} FILE{docs.length !== 1 ? "S" : ""} EMBEDDED • {totalSizeKB} KB OF CACHED EMBEDDINGS
              </p>
            </div>
          </div>
          <div className="w-full sm:w-48 flex flex-col gap-1.5 shrink-0">
            <div className="h-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${percentUsed}%` }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500"
              />
            </div>
            <div className="flex justify-between text-[9px] font-extrabold text-slate-400 dark:text-slate-500 font-mono tracking-wider">
              <span>{percentUsed.toFixed(1)}% CAPACITY</span>
              <span>2.0 MB CACHE LIMIT</span>
            </div>
          </div>
        </div>

        {/* Compose Add Doc manual form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden glass-panel rounded-20 p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-2">
                  <Cpu className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                  COMPOSE AI GROUNDING SPECIFICATION
                </h3>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="text-xs font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer uppercase tracking-wider"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Document Title</label>
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="e.g. operational_manual_v2.txt"
                    className="w-full px-3.5 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/80 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Document Content</label>
                  <textarea
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    placeholder="Provide detailed operating standards, metrics tables, context logs..."
                    rows={6}
                    className="w-full px-3.5 py-2 text-xs bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/80 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-bold resize-none font-mono leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider font-mono">
                  {docContent.length.toLocaleString()} CHARACTER BYTES • READY FOR RAG EMBED
                </span>

                <button
                  onClick={handleCreateDocument}
                  disabled={!docName.trim() || !docContent.trim() || isProcessing}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  <span>Vectorize Spec</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Grid list of files */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search grounding logs, reports, benchmarks..."
              className="w-full pl-11 pr-4 py-2.5 text-xs bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/60 rounded-xl outline-none text-slate-800 dark:text-slate-100 focus:border-indigo-500/50 transition-all font-semibold"
            />
          </div>

          {filteredDocs.length === 0 ? (
            <div className="p-12 text-center rounded-20 border border-dashed border-slate-200 dark:border-slate-800 bg-white/20 dark:bg-[#111318]/10">
              <FileText className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-1">No Grounding Documents Mapped</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                {searchQuery ? "No workspace documents match your active query filters." : "Grounding database is empty. Drag a document onto this panel to vectorize it instantly."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocs.map((doc) => {
                const isSelected = previewDoc?.id === doc.id;
                return (
                  <motion.div
                    whileHover={{ y: -2, scale: 1.01 }}
                    key={doc.id}
                    onClick={() => setPreviewDoc(doc)}
                    className={`p-5 rounded-20 border text-left cursor-pointer transition-all duration-200 relative group flex flex-col justify-between backdrop-blur-md ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-500/[0.02] shadow-md shadow-indigo-500/5"
                        : "border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/40 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCode className="w-4.5 h-4.5 text-indigo-500 shrink-0 animate-pulse" />
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate pr-4">
                            {doc.name}
                          </h4>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteDoc(doc.id);
                            if (previewDoc?.id === doc.id) setPreviewDoc(null);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all"
                          title="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-2 mb-4 font-bold uppercase tracking-wider">
                        {doc.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/40 dark:border-slate-800/20 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                      <span>{doc.size}</span>
                      <span className="flex items-center gap-1 text-emerald-500">
                        {doc.status === "processing" ? (
                          <>
                            Embedding <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          </>
                        ) : (
                          <>
                            Grounded <CheckCircle className="w-2.5 h-2.5" />
                          </>
                        )}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Active doc preview with glassmorphic sidebar panels */}
      <div className="w-full md:w-96 shrink-0 border-t md:border-t-0 md:border-l border-slate-200/50 dark:border-slate-800/50 glass-panel p-6 overflow-y-auto flex flex-col h-full rounded-r-none rounded-l-20">
        {previewDoc ? (
          <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-800/40 pb-3">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-wider">
                GROUNDING METRICS AUDIT
              </h3>
              <button 
                onClick={() => setPreviewDoc(null)}
                className="text-[10px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer uppercase tracking-widest"
              >
                Clear
              </button>
            </div>

            {/* Segmented control tabs */}
            <div className="flex rounded-lg bg-slate-100/80 dark:bg-slate-950/40 p-0.5 border border-slate-200/40 dark:border-slate-800/40">
              <button
                onClick={() => setSidebarTab("chunks")}
                className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                  sidebarTab === "chunks"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Chunks
              </button>
              <button
                onClick={() => setSidebarTab("simulator")}
                className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                  sidebarTab === "simulator"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Cpu className="w-2.5 h-2.5 text-indigo-500 animate-pulse shrink-0" />
                <span>RAG Simulator</span>
              </button>
              <button
                onClick={() => setSidebarTab("intelligence")}
                className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer flex items-center justify-center gap-0.5 ${
                  sidebarTab === "intelligence"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Sparkles className="w-2.5 h-2.5 text-indigo-500 animate-bounce shrink-0" />
                <span>AI Intel</span>
              </button>
            </div>

            {sidebarTab === "chunks" && (
              <div className="space-y-4 flex flex-col flex-1 min-h-0">
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/40 text-left">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block uppercase mb-1 tracking-widest">Asset Identifier</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 break-all">{previewDoc.name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/40">
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block uppercase mb-1 tracking-widest">Words Count</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {previewDoc.content.split(/\s+/).filter(Boolean).length}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/40">
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block uppercase mb-1 tracking-widest">Bytes</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
                        {previewDoc.content.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 border border-slate-200/50 dark:border-slate-800/50 rounded-xl p-4 overflow-y-auto text-left bg-white/40 dark:bg-slate-900/30 min-h-0">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block uppercase mb-2 border-b border-slate-200/40 dark:border-slate-800/40 pb-1.5 tracking-widest">
                    Source Document Chunks
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono whitespace-pre-wrap select-text">
                    {previewDoc.content}
                  </p>
                </div>
              </div>
            )}

            {sidebarTab === "simulator" && (
              <div className="space-y-4 flex flex-col flex-1 min-h-0 text-left">
                {/* Simulator controls */}
                <div className="space-y-3.5 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                  <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 block uppercase tracking-widest">
                    Simulation Hyperparameters
                  </span>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chunk Size:</span>
                      <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{chunkSize} words</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={120}
                      step={5}
                      value={chunkSize}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setChunkSize(val);
                        if (chunkOverlap >= val) {
                          setChunkOverlap(Math.max(0, val - 10));
                        }
                      }}
                      className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-200 rounded-lg dark:bg-slate-850"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chunk Overlap:</span>
                      <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{chunkOverlap} words</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.min(50, chunkSize - 5)}
                      step={5}
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(Number(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-200 rounded-lg dark:bg-slate-850"
                    />
                  </div>
                </div>

                {/* Query Input */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Test Retrieval Query
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={simulatorQuery}
                      onChange={(e) => setSimulatorQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') runSimulation();
                      }}
                      placeholder="e.g. protocol, summary, recommendations"
                      className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100 font-bold"
                    />
                    <button
                      onClick={runSimulation}
                      disabled={isSimulating || !simulatorQuery.trim()}
                      className="absolute right-1.5 top-1.5 p-1 text-slate-400 hover:text-indigo-500 disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      {isSimulating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={runSimulation}
                  disabled={isSimulating || !simulatorQuery.trim()}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-850 disabled:text-slate-400 text-white text-xs font-black rounded-xl cursor-pointer shadow-md shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
                >
                  {isSimulating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Computing Similarity Matches...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                      <span>Simulate Vector Match</span>
                    </>
                  )}
                </button>

                {/* Simulated matches list */}
                <div className="flex-1 border border-slate-200/50 dark:border-slate-800/50 rounded-xl p-4 overflow-y-auto bg-white/40 dark:bg-slate-900/30 flex flex-col min-h-0">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block uppercase mb-2.5 border-b border-slate-200/40 dark:border-slate-800/40 pb-1.5 tracking-widest">
                    Simulated Top Retrieval Matches ({activeMatchingChunks.length})
                  </span>
                  
                  {activeMatchingChunks.length > 0 ? (
                    <div className="space-y-3 min-h-0">
                      {activeMatchingChunks.map((chunk, index) => {
                        const similarityPercent = (chunk.score * 100).toFixed(1);
                        return (
                          <div 
                            key={index}
                            className="p-3 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.01] hover:bg-indigo-500/[0.03] transition-all space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-mono font-black text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Chunk #{index + 1}
                              </span>
                              <span className="text-[10px] font-mono font-black text-emerald-500 dark:text-emerald-400">
                                {similarityPercent}% match
                              </span>
                            </div>
                            
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-mono">
                              {chunk.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-6 opacity-65">
                      <Database className="w-5 h-5 text-slate-350 dark:text-slate-600 mb-1.5" />
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">No retrieval runs yet</span>
                      <p className="text-[8px] text-slate-400 dark:text-slate-500 max-w-[160px] mt-1 tracking-wider leading-relaxed">
                        Enter a keyword query above and click "Simulate Vector Match" to see matching source database segments.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {sidebarTab === "intelligence" && (
              <div className="space-y-4 flex flex-col flex-1 min-h-0 text-left">
                {/* Intel controls */}
                <div className="space-y-3.5 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                  <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 block uppercase tracking-widest">
                    Enterprise AI Intel Actions
                  </span>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Select Operation</label>
                    <select
                      value={selectedIntelAction}
                      onChange={(e) => setSelectedIntelAction(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-bold"
                    >
                      <option value="summarize">Executive Summary</option>
                      <option value="extract">Key Points & Metrics</option>
                      <option value="faqs">Generate FAQ Guide</option>
                      <option value="explain">Explain Technical Terms</option>
                      <option value="report">Corporate Strategy Report</option>
                      <option value="translate">Language Translation</option>
                    </select>
                  </div>

                  {selectedIntelAction === "translate" && (
                    <div className="space-y-1.5 animate-fade">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Target Language</label>
                      <select
                        value={selectedIntelLang}
                        onChange={(e) => setSelectedIntelLang(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-bold"
                      >
                        <option value="en">English (US)</option>
                        <option value="te">Telugu (తెలుగు)</option>
                        <option value="hi">Hindi (हिन्दी)</option>
                      </select>
                    </div>
                  )}

                  <button
                    onClick={handleExecuteIntelligence}
                    disabled={isIntelLoading}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-850 disabled:text-slate-400 text-white text-xs font-black rounded-xl cursor-pointer shadow-md shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
                  >
                    {isIntelLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing Document...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        <span>Run Intelligence Unit</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Intel output viewport */}
                <div className="flex-1 border border-slate-200/50 dark:border-slate-800/50 rounded-xl p-4 overflow-y-auto bg-white/40 dark:bg-slate-900/30 flex flex-col min-h-0">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block uppercase mb-2.5 border-b border-slate-200/40 dark:border-slate-800/40 pb-1.5 tracking-widest">
                    AI Output Stream View
                  </span>

                  {isIntelLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-75">
                      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-pulse">Running Neural Pipeline...</span>
                    </div>
                  ) : intelResult ? (
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap select-text space-y-2">
                      {intelResult}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-10 opacity-65">
                      <Sparkles className="w-5 h-5 text-slate-350 dark:text-slate-600 mb-1.5" />
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">No output generated yet</span>
                      <p className="text-[8px] text-slate-400 dark:text-slate-500 max-w-[160px] mt-1 tracking-wider leading-relaxed">
                        Select an operation and trigger the Nexora intelligence unit above.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <Layers className="w-7 h-7 text-slate-350 dark:text-slate-700 mb-2 animate-pulse" />
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">No Asset Audited</h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[200px] mt-1.5 font-bold uppercase tracking-wider leading-relaxed">
              Click any indexed document in your knowledge base grid to inspect vector text chunks and semantic properties.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
