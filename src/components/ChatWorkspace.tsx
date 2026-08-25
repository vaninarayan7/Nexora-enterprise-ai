import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Sparkles, 
  Trash2, 
  Cpu, 
  Copy, 
  Check, 
  Volume2, 
  CornerDownLeft, 
  Paperclip,
  FileText,
  AlertCircle,
  Clock,
  User,
  X,
  ChevronRight,
  Database,
  Mic,
  MicOff,
  Languages,
  Download,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  FileDown,
  BookOpen,
  Shield,
  Zap,
  Pause,
  Play,
  Square,
  Loader2,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Message, KnowledgeDoc, WorkspacePersona, WorkspaceSettings, PromptTemplate } from "../types";

interface ChatWorkspaceProps {
  messages: Message[];
  activePersona: WorkspacePersona;
  settings: WorkspaceSettings;
  docs: KnowledgeDoc[];
  isGenerating: boolean;
  onSendMessage: (content: string) => void;
  onClearSession: () => void;
  onAddDocFromChat: (name: string, content: string) => void;
  chatDraft?: string;
  onClearDraft?: () => void;
  templates?: PromptTemplate[];
}

export default function ChatWorkspace({
  messages,
  activePersona,
  settings,
  docs,
  isGenerating,
  onSendMessage,
  onClearSession,
  onAddDocFromChat,
  chatDraft = "",
  onClearDraft = () => {},
  templates = []
}: ChatWorkspaceProps) {
  const [inputText, setInputText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);
  const [activeLanguage, setActiveLanguage] = useState<"en" | "te" | "hi">("en");
  const [isListening, setIsListening] = useState(false);
  const [bookmarkedMessages, setBookmarkedMessages] = useState<string[]>([]);
  const [messageRatings, setMessageRatings] = useState<Record<string, "up" | "down" | null>>({});
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [revealedCitations, setRevealedCitations] = useState<Record<string, boolean>>({});

  // Local search in conversation states & text highlighter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNonMatching, setFilterNonMatching] = useState(false);

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return <span>{text}</span>;
    try {
      const escaped = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const parts = text.split(new RegExp(`(${escaped})`, "gi"));
      return (
        <span>
          {parts.map((part, i) => 
            part.toLowerCase() === search.toLowerCase() ? (
              <mark key={i} className="bg-amber-200 dark:bg-amber-500/55 text-slate-950 dark:text-white px-1 rounded font-bold shadow-sm">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </span>
      );
    } catch (e) {
      return <span>{text}</span>;
    }
  };
  
  // MediaRecorder states for high-fidelity audio snippets & transcription
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setTranscriptionError(null);
      setAudioBlob(null);
      setAudioUrl(null);
      audioChunksRef.current = [];
      setRecordingDuration(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/mp4";
        if (!MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = ""; // use default
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // stop the audio stream tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Failed to access microphone:", err);
      setTranscriptionError("Microphone access denied or unsupported in this browser.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      if (isRecording) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    audioChunksRef.current = [];
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setRecordingDuration(0);
    setTranscriptionError(null);
    setIsPlayingPreview(false);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(",")[1];
          const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              audio: base64Data,
              mimeType: audioBlob.type || "audio/webm"
            })
          });

          const data = await response.json();
          if (response.ok && data.success) {
            const text = data.transcription;
            if (text && text !== "Speech is unclear or empty.") {
              setInputText(prev => prev ? prev + " " + text : text);
              cancelRecording();
            } else {
              setTranscriptionError("We couldn't detect any spoken words. Try speaking louder or closer to the microphone.");
            }
          } else {
            throw new Error(data.error || "Failed to transcribe recording.");
          }
        } catch (innerErr: any) {
          console.error("Transcription fetch error:", innerErr);
          setTranscriptionError(innerErr.message || "An error occurred during transcription.");
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (err: any) {
      console.error("FileReader error:", err);
      setTranscriptionError("Failed to read audio data.");
      setIsTranscribing(false);
    }
  };

  const togglePlayPreview = () => {
    if (!audioUrl) return;
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(audioUrl);
      previewAudioRef.current.onended = () => {
        setIsPlayingPreview(false);
      };
    }

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync injected prompt draft from external Prompt Library tab
  useEffect(() => {
    if (chatDraft) {
      setInputText(chatDraft);
      onClearDraft();
    }
  }, [chatDraft, onClearDraft]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Clean attachments on persona/session change
  useEffect(() => {
    setAttachedDocIds([]);
  }, [activePersona]);

  // Handle standard clipboard copy
  const handleCopyText = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Browser-native premium speech synthesis (100% functional, client-side, instant)
  const handleSpeakText = (text: string, msgId: string) => {
    if (window.speechSynthesis) {
      if (isSpeakingId === msgId) {
        window.speechSynthesis.cancel();
        setIsSpeakingId(null);
        return;
      }
      window.speechSynthesis.cancel();
      // Remove markdown before speaking
      const plainText = text.replace(/[*#`_\-]/g, "");
      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.onend = () => setIsSpeakingId(null);
      utterance.onerror = () => setIsSpeakingId(null);
      setIsSpeakingId(msgId);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Initialize browser-native SpeechRecognition for multilang STT
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      
      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev ? prev + " " + transcript : transcript);
      };
      recognitionRef.current = rec;
    }
  }, []);

  // Sync lang with speech recognition
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = activeLanguage === "te" ? "te-IN" : activeLanguage === "hi" ? "hi-IN" : "en-US";
    }
  }, [activeLanguage]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Safari.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const toggleBookmark = (msgId: string) => {
    setBookmarkedMessages(prev => 
      prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
    );
  };

  const rateMessage = (msgId: string, rating: "up" | "down") => {
    setMessageRatings(prev => ({
      ...prev,
      [msgId]: prev[msgId] === rating ? null : rating
    }));
  };

  const handleExportMarkdown = () => {
    const header = `# Nexora AI Workspace Discussion - ${activePersona.name}\nExported on: ${new Date().toLocaleString()}\n\n---\n\n`;
    const body = messages.map(m => {
      const roleName = m.role === "user" ? "User" : activePersona.name;
      return `### **${roleName}** (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n\n`;
    }).join("\n---\n\n");
    
    const blob = new Blob([header + body], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `nexora-session-${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSend = () => {
    if (!inputText.trim() && attachedDocIds.length === 0) return;
    
    let finalPrompt = inputText;
    
    // Add translation instructions based on active language selection
    if (activeLanguage === "te") {
      finalPrompt += "\n\n(Please provide your complete response in Telugu / తెలుగు language only)";
    } else if (activeLanguage === "hi") {
      finalPrompt += "\n\n(Please provide your complete response in Hindi / हिंदी language only)";
    }

    // If docs are attached in chat directly, append metadata or reference them
    if (attachedDocIds.length > 0) {
      const selectedDocs = docs.filter(d => attachedDocIds.includes(d.id));
      if (selectedDocs.length > 0) {
        finalPrompt += "\n\n(Direct Reference to attached Workspace Documents: " + 
          selectedDocs.map(d => `"${d.name}"`).join(", ") + ")";
      }
    }

    onSendMessage(finalPrompt);
    setInputText("");
    setAttachedDocIds([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Drag and drop mechanics
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      parseAndAddFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      parseAndAddFile(files[0]);
    }
  };

  const parseAndAddFile = (file: File) => {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onAddDocFromChat(file.name, text);
    };
    reader.readAsText(file);
  };

  const toggleAttachment = (docId: string) => {
    setAttachedDocIds(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const suggestions = [
    { label: "Conduct a SWOT analysis on a product idea", text: "I have a new product idea: an offline-first privacy focused note taking app. Can you conduct a quick SWOT analysis on this?" },
    { label: "Design a clean landing page layout schema", text: "Outline a clean, minimalist design layout schema for an enterprise AI workspace landing page. Use specific visual guidelines like container boundaries, mathematical line scales, and exact neutral color limits." },
    { label: "Draft a modern marketing slogan", text: "Create 5 snappy, modern, non-cliché slogan variations for a premium developer toolkit." },
    { label: "Refactor code with comprehensive error boundary", text: "Can you provide a robust React functional component that loads mock documents, with complete try-catch blocks and shimmer loading skeletons?" }
  ];

  const getFollowUpSuggestions = () => {
    if (messages.length === 0) return [];
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return [];
    
    const content = lastMsg.content.toLowerCase();
    if (content.includes("swot") || content.includes("strength") || content.includes("threat")) {
      return [
        "What are the key execution steps for this product?",
        "Can you help draft a risk mitigation plan?",
        "Compare this with standard cloud storage options."
      ];
    }
    if (content.includes("landing") || content.includes("design") || content.includes("layout")) {
      return [
        "What fonts would you recommend pairing with Playfair Display?",
        "How do we optimize loading speeds for high-resolution assets?",
        "Draft a color palette specification based on these rules."
      ];
    }
    return [
      "Can you summarize the main takeaways of this response?",
      "How would this integrate into our existing HR workflow?",
      "Could you explain this concept in simpler terms?"
    ];
  };

  const filteredMessages = messages.filter((m) => {
    if (!searchQuery.trim()) return true;
    return m.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const displayedMessages = filterNonMatching ? filteredMessages : messages;

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col flex-1 h-full min-h-0 overflow-hidden bg-transparent relative transition-colors duration-300 ${
        isDragOver ? "ring-2 ring-emerald-500/50" : ""
      }`}
    >
      {/* File Drag Overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/90 dark:bg-slate-950/90 z-40 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm pointer-events-none"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
              <Paperclip className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Upload to Knowledge Base</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              Drop any text or markdown document here to automatically parse and index it into your active session context.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Navigation Bar */}
      {messages.length > 0 && (
        <div className="px-6 py-3 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 z-10 transition-colors duration-250">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search active conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-8 py-2 bg-slate-50/40 dark:bg-[#0c0d10]/30 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors"
                title="Clear Search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
            {searchQuery && (
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/50 px-2.5 py-1 rounded-lg">
                {filteredMessages.length} of {messages.length} Match{filteredMessages.length !== 1 ? "es" : ""}
              </span>
            )}
            
            <label className="flex items-center gap-2 cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 select-none transition-colors">
              <input
                type="checkbox"
                checked={filterNonMatching}
                onChange={(e) => setFilterNonMatching(e.target.checked)}
                className="accent-emerald-500 w-4 h-4 rounded cursor-pointer border-slate-300 dark:border-slate-700 focus:ring-0"
              />
              <span className="text-[10px] uppercase tracking-widest font-black">Filter Unmatched</span>
            </label>

            <span className="text-slate-300 dark:text-slate-800 hidden sm:inline text-[10px]">|</span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-black uppercase rounded-lg text-slate-500 hover:text-indigo-500 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                title="Export Session as Markdown"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>

              <button
                onClick={onClearSession}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-black uppercase rounded-lg text-slate-500 hover:text-red-500 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Panel */}
      <div className={`flex-1 overflow-y-auto px-6 py-8 min-h-0 ${messages.length === 0 ? "flex flex-col items-center justify-center" : "space-y-6"}`}>
        {messages.length === 0 ? (
          /* Onboarding Empty State */
          <div className="max-w-2xl w-full mx-auto flex flex-col items-center justify-center text-center py-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center premium-glow-emerald mb-5"
            >
              <Sparkles className="w-7 h-7" />
            </motion.div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
              Welcome to the Nexora Workspace
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
              Experience responsive intelligence powered by the standard <strong>{settings.modelName}</strong>. 
              Configure custom system rules, upload documents to ground your assistant, and toggle specialty strategic agents.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl text-left">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputText(s.text)}
                  className="flex flex-col p-3 rounded-xl bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-800/60 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 cursor-pointer transition-all duration-200 group relative overflow-hidden"
                >
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                    {s.label}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate w-full">
                    {s.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Active Chat Thread */
          <div className="max-w-3xl w-full mx-auto space-y-6">
            {displayedMessages.length === 0 ? (
              <div className="py-16 text-center max-w-sm mx-auto space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                  <Search className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">No matches found</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed font-semibold">
                    We couldn't find any messages containing "{searchQuery}" in this active session.
                  </p>
                </div>
                <button
                  onClick={() => { setSearchQuery(""); setFilterNonMatching(false); }}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg uppercase tracking-wider cursor-pointer transition-colors shadow-sm"
                >
                  Clear search query
                </button>
              </div>
            ) : (
              displayedMessages.map((message) => {
              const isUser = message.role === "user";
              const isAssistant = message.role === "assistant";
              
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {/* Left avatar for assistant */}
                  {isAssistant && (
                    <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-gradient-to-tr ${activePersona.accentClass.split(" ")[0]} ${activePersona.accentClass.split(" ")[1]} text-white text-xs font-bold`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble container */}
                  <div className={`flex flex-col max-w-[85%] group`}>
                    <div 
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isUser 
                          ? "bg-slate-900 dark:bg-emerald-500 text-white rounded-tr-none" 
                          : "bg-white dark:bg-[#111318] text-slate-800 dark:text-slate-100 border border-slate-200/50 dark:border-slate-800/60 rounded-tl-none"
                      }`}
                    >
                      {/* Message Content Rendered */}
                      <div className="whitespace-pre-wrap font-sans font-normal text-left break-words">
                        {highlightText(message.content, searchQuery)}
                      </div>

                      {/* Confidence Score Progress Bar */}
                      {isAssistant && message.citations && message.citations.length > 0 && (() => {
                        const maxScore = Math.max(...message.citations.map(c => c.score));
                        const confidenceScore = Math.min(100, Math.round(maxScore * 100));
                        
                        let barColor = "bg-amber-500";
                        let textColor = "text-amber-600 dark:text-amber-400";
                        let bgTrackColor = "bg-amber-500/10";
                        let ratingText = "Moderate";
                        
                        if (confidenceScore >= 80) {
                          barColor = "bg-emerald-500";
                          textColor = "text-emerald-600 dark:text-emerald-400";
                          bgTrackColor = "bg-emerald-500/10";
                          ratingText = "Excellent Support";
                        } else if (confidenceScore >= 60) {
                          barColor = "bg-indigo-500";
                          textColor = "text-indigo-600 dark:text-indigo-400";
                          bgTrackColor = "bg-indigo-500/10";
                          ratingText = "Strong Support";
                        } else if (confidenceScore < 45) {
                          barColor = "bg-rose-500";
                          textColor = "text-rose-600 dark:text-rose-400";
                          bgTrackColor = "bg-rose-500/10";
                          ratingText = "Low Support";
                        }
                        
                        return (
                          <div className="mt-3 p-2.5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40 rounded-xl text-left space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9px] font-black flex items-center gap-1">
                                <Shield className="w-3.5 h-3.5 text-indigo-500" />
                                Grounding Confidence
                              </span>
                              <span className={`font-mono font-black ${textColor}`}>
                                {confidenceScore}% ({ratingText})
                              </span>
                            </div>
                            <div className={`w-full h-1.5 rounded-full ${bgTrackColor} overflow-hidden`}>
                              <div 
                                className={`h-full ${barColor} rounded-full transition-all duration-500`}
                                style={{ width: `${confidenceScore}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Display retrieved RAG Citations with interactive reveal */}
                      {isAssistant && message.citations && message.citations.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-slate-100/50 dark:border-slate-800/50 text-left">
                          <button
                            onClick={() => setRevealedCitations(prev => ({ ...prev, [message.id]: !prev[message.id] }))}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-slate-50 hover:bg-emerald-500/10 dark:bg-slate-900/40 dark:hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200/50 dark:border-slate-800/50 rounded-full transition-all cursor-pointer shadow-sm"
                            title="Click to reveal source documents"
                            id={`ref-btn-${message.id}`}
                          >
                            <Database className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Ref: {message.citations.length} Source{message.citations.length > 1 ? "s" : ""}</span>
                            <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${revealedCitations[message.id] ? "rotate-90 text-emerald-500" : "text-slate-400"}`} />
                          </button>

                          {/* Revealed Citations List */}
                          <AnimatePresence>
                            {revealedCitations[message.id] && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2.5 space-y-2 overflow-hidden"
                              >
                                {message.citations.map((cit, cidx) => (
                                  <div 
                                    key={cidx} 
                                    className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800/50 text-xs text-slate-600 dark:text-slate-300 space-y-1"
                                  >
                                    <div className="flex items-center justify-between font-bold text-slate-750 dark:text-slate-200">
                                      <span className="flex items-center gap-1.5 truncate">
                                        <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span className="truncate text-[11px] font-black">{cit.docName}</span>
                                      </span>
                                      <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">
                                        {(cit.score * 100).toFixed(1)}% match
                                      </span>
                                    </div>
                                    <p className="font-mono text-[10px] leading-relaxed pl-3 border-l-2 border-emerald-500/30 text-slate-500 dark:text-slate-400 select-text break-words whitespace-pre-wrap">
                                      {cit.text}
                                    </p>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Advanced RAG indicator: Query Fusion Expansion */}
                      {isAssistant && message.expandedQueries && message.expandedQueries.length > 0 && (
                        <div className="mt-3 p-2.5 bg-slate-50/65 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/40 rounded-xl text-left">
                          <span className="text-[9px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block mb-1">
                            Query Fusion Semantics
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {message.expandedQueries.map((q, idx) => (
                              <span key={idx} className="text-[9px] font-extrabold text-slate-600 dark:text-slate-350 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
                                "{q}"
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Advanced RAG indicator: Prompt Context Compression */}
                      {isAssistant && message.originalTokenCount !== undefined && message.compressedTokenCount !== undefined && (
                        <div className="mt-2.5 p-2.5 bg-indigo-500/[0.01] dark:bg-indigo-500/[0.02] border border-indigo-500/10 dark:border-indigo-500/15 rounded-xl text-left flex items-center justify-between gap-3 text-[10px] font-bold">
                          <div className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[9px] font-black">Context Optimizer:</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[10px]">
                            <span className="text-slate-400 dark:text-slate-500 line-through">{message.originalTokenCount} tokens</span>
                            <span className="text-indigo-400 dark:text-indigo-500">→</span>
                            <span className="text-indigo-500 dark:text-indigo-400 font-black">{message.compressedTokenCount} tokens</span>
                            <span className="bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[8px] font-black font-sans">
                              -{Math.round(((message.originalTokenCount - message.compressedTokenCount) / message.originalTokenCount) * 100)}% Cost
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Advanced RAG indicator: Grounding Self-Audit */}
                      {isAssistant && (message.groundingScore !== undefined || message.relevanceScore !== undefined) && (
                        <div className="mt-2.5 p-3 rounded-xl border border-indigo-500/15 dark:border-indigo-500/20 bg-indigo-500/[0.01] text-left space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              Factual Grounding Audit
                            </span>
                            <span className="text-[8px] font-black font-mono text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Shield Active
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-0.5">
                            <div className="p-2 rounded-lg bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40">
                              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Faithfulness</span>
                              <div className="flex items-end gap-1 mt-0.5">
                                <span className={`text-xs font-black ${message.groundingScore && message.groundingScore >= 90 ? "text-emerald-500" : "text-amber-500"}`}>
                                  {message.groundingScore}%
                                </span>
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-0.5">Grounding</span>
                              </div>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/40">
                              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Query Relevance</span>
                              <div className="flex items-end gap-1 mt-0.5">
                                <span className={`text-xs font-black ${message.relevanceScore && message.relevanceScore >= 90 ? "text-emerald-500" : "text-indigo-500"}`}>
                                  {message.relevanceScore}%
                                </span>
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-0.5">Accuracy</span>
                              </div>
                            </div>
                          </div>

                          {message.evaluationReport && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans font-medium bg-slate-50/30 dark:bg-slate-950/30 p-2 rounded-lg border border-slate-200/30 dark:border-slate-800/30">
                              {message.evaluationReport}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Display referenced model for assistant */}
                      {isAssistant && message.modelUsed && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            {message.modelUsed}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quick Micro-interactions block below message bubble */}
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopyText(message.content, message.id)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          title="Copy message to clipboard"
                        >
                          {copiedId === message.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleSpeakText(message.content, message.id)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          title="TTS audio player"
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${isSpeakingId === message.id ? "text-emerald-500 animate-pulse" : ""}`} />
                        </button>
                        
                        {/* Bookmark Button */}
                        <button
                          onClick={() => toggleBookmark(message.id)}
                          className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                            bookmarkedMessages.includes(message.id)
                              ? "text-amber-550 dark:text-amber-400"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          }`}
                          title="Bookmark/Save Message"
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${bookmarkedMessages.includes(message.id) ? "fill-amber-500/25" : ""}`} />
                        </button>

                        {/* Thumbs Up Feedback */}
                        <button
                          onClick={() => rateMessage(message.id, "up")}
                          className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                            messageRatings[message.id] === "up"
                              ? "text-emerald-550 dark:text-emerald-450"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          }`}
                          title="Good Response"
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${messageRatings[message.id] === "up" ? "fill-emerald-500/15" : ""}`} />
                        </button>

                        {/* Thumbs Down Feedback */}
                        <button
                          onClick={() => rateMessage(message.id, "down")}
                          className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                            messageRatings[message.id] === "down"
                              ? "text-red-500"
                              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          }`}
                          title="Poor Response"
                        >
                          <ThumbsDown className={`w-3.5 h-3.5 ${messageRatings[message.id] === "down" ? "fill-red-500/15" : ""}`} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right avatar for user */}
                  {isUser && (
                    <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              );
            })
          )}

            {/* AI thinking state */}
            {isGenerating && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 justify-start"
              >
                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-gradient-to-tr ${activePersona.accentClass.split(" ")[0]} ${activePersona.accentClass.split(" ")[1]} text-white text-xs font-bold`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex flex-col space-y-2 max-w-[80%]">
                  <div className="px-5 py-3.5 bg-white dark:bg-[#111318] border border-slate-200/50 dark:border-slate-800/60 rounded-2xl rounded-tl-none flex flex-col space-y-2 min-w-[200px]">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>AI is thinking...</span>
                    </div>
                    {/* Shimmer layout */}
                    <div className="h-3 w-40 shimmer-bg rounded" />
                    <div className="h-3 w-48 shimmer-bg rounded" />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Control Input & Context Attachment Drawer */}
      <div className="p-4 bg-white/80 dark:bg-[#111318]/80 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-800/60 transition-colors z-20">
        <div className="max-w-3xl mx-auto space-y-3">
          
          {/* Dynamic Suggested Follow-up Questions */}
          {!isGenerating && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
            <div className="flex flex-wrap gap-1.5 px-1 pb-1">
              {getFollowUpSuggestions().map((sug, sidx) => (
                <button
                  key={sidx}
                  onClick={() => {
                    const promptText = sug;
                    setInputText("");
                    const langInstruction = activeLanguage === "te" 
                      ? "\n\n(Please provide your complete response in Telugu / తెలుగు language only)" 
                      : activeLanguage === "hi" 
                        ? "\n\n(Please provide your complete response in Hindi / हिंदी language only)" 
                        : "";
                    onSendMessage(promptText + langInstruction);
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-350 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all text-left cursor-pointer"
                >
                  ✨ {sug}
                </button>
              ))}
            </div>
          )}

          {/* Docs context attaching panel (only if docs exist) */}
          {docs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> ATTACH CONTEXT:
              </span>
              {docs.map((doc) => {
                const isAttached = attachedDocIds.includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleAttachment(doc.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                      isAttached
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/80 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    <FileText className={`w-3 h-3 ${isAttached ? "text-emerald-500" : "text-slate-400"}`} />
                    <span className="truncate max-w-[120px]">{doc.name}</span>
                    {isAttached && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* High-Fidelity Voice Snippet Recorder Panel */}
          {(isRecording || audioUrl || isTranscribing || transcriptionError) && (
            <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/95 dark:to-slate-950/50 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl space-y-2 text-left shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isRecording ? "bg-red-500/15 text-red-500 animate-pulse" : "bg-indigo-500/10 text-indigo-500"}`}>
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider block">
                      Voice Snippet Studio
                    </span>
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {isRecording ? "Recording audio snippet..." : audioUrl ? "Voice snippet ready for transcription" : "Voice Recorder ready"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Timer */}
                  <span className="font-mono text-xs font-black text-slate-600 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-800/60 px-2 py-0.5 rounded">
                    {formatDuration(recordingDuration)}
                  </span>
                  
                  {/* Discard button */}
                  <button
                    onClick={cancelRecording}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded cursor-pointer transition-colors"
                    title="Discard recording"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status and Error Alerts */}
              {transcriptionError && (
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{transcriptionError}</span>
                </div>
              )}

              {/* Action and controls strip */}
              <div className="flex items-center gap-2">
                {/* 1. If currently recording: show STOP button */}
                {isRecording && (
                  <button
                    onClick={stopRecording}
                    className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black rounded-lg cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1 uppercase tracking-wider"
                  >
                    <Square className="w-3 h-3 fill-white" />
                    <span>Stop & Compile</span>
                  </button>
                )}

                {/* 2. If finished recording & have playable audio URL */}
                {audioUrl && !isRecording && (
                  <>
                    {/* Play/Pause preview */}
                    <button
                      onClick={togglePlayPreview}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-black rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1 uppercase tracking-wider"
                    >
                      {isPlayingPreview ? (
                        <>
                          <Pause className="w-3 h-3 text-slate-600 dark:text-slate-300 fill-slate-600 dark:fill-slate-300" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 text-slate-600 dark:text-slate-300 fill-slate-600 dark:fill-slate-300" />
                          <span>Playback</span>
                        </>
                      )}
                    </button>

                    {/* Transcribe trigger */}
                    <button
                      onClick={transcribeAudio}
                      disabled={isTranscribing}
                      className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-850 disabled:text-slate-400 text-white text-[10px] font-black rounded-lg cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1 uppercase tracking-wider"
                    >
                      {isTranscribing ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Transcribing Audio...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>Transcribe Voice to Input</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Core Text Input element */}
          <div className="relative flex items-center gap-2 bg-white dark:bg-[#1c1f26] border border-slate-200 dark:border-slate-800/80 rounded-2xl px-4 py-2.5 transition-shadow focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500/50">
            {/* Direct document loader hook */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".txt,.md,.json,.html,.css,.js,.ts" 
              className="hidden" 
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Parse document file into context"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Speech-to-Text continuous dictation trigger */}
            <button
              onClick={toggleListen}
              className={`flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                isListening 
                  ? "bg-emerald-500/15 text-emerald-500 animate-pulse ring-1 ring-emerald-500/35" 
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              title={isListening ? "Speech Recognition Listening... click to stop" : "Live Speech Dictation (STT)"}
            >
              {isListening ? <Mic className="w-4 h-4 text-emerald-500" /> : <MicOff className="w-4 h-4" />}
            </button>

            {/* High-Fidelity Voice Snippet MediaRecorder trigger */}
            <button
              onClick={() => {
                if (isRecording) {
                  stopRecording();
                } else if (audioUrl) {
                  cancelRecording();
                } else {
                  startRecording();
                }
              }}
              className={`flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                isRecording 
                  ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20" 
                  : audioUrl 
                    ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              title={isRecording ? "Recording... Click to Stop" : "Record High-Fidelity Voice Snippet (MediaRecorder)"}
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Language Selector dropdown */}
            <div className="flex items-center gap-1 shrink-0 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-lg px-2 py-1">
              <Languages className="w-3.5 h-3.5 text-emerald-500" />
              <select
                value={activeLanguage}
                onChange={(e) => setActiveLanguage(e.target.value as any)}
                className="bg-transparent text-[11px] font-extrabold text-slate-600 dark:text-slate-400 outline-none border-none cursor-pointer pr-1"
                title="Translation target language"
              >
                <option value="en">English</option>
                <option value="te">తెలుగు</option>
                <option value="hi">हिंदी</option>
              </select>
            </div>

            {/* Quick insert prompts dropdown popover */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className={`flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                  showTemplateMenu
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850"
                }`}
                title="Quickly insert system prompt template"
              >
                <BookOpen className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showTemplateMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowTemplateMenu(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.95 }}
                      className="absolute bottom-12 left-0 w-80 max-h-80 overflow-y-auto bg-white dark:bg-[#111318] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-3 z-50 text-left space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          QUICK INSERT PROMPT
                        </span>
                        <button
                          onClick={() => setShowTemplateMenu(false)}
                          className="text-[9px] font-black hover:text-red-500 text-slate-400 uppercase tracking-wider"
                        >
                          Close
                        </button>
                      </div>

                      {templates.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs">
                          No prompts in your library. Save templates in the "Prompt Library" tab!
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {templates.map((tpl) => (
                            <button
                              key={tpl.id}
                              onClick={() => {
                                setInputText(prev => prev ? prev + "\n" + tpl.prompt : tpl.prompt);
                                setShowTemplateMenu(false);
                              }}
                              className="w-full p-2 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex flex-col gap-0.5 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                                  {tpl.title}
                                </span>
                                <span className="text-[7px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
                                  {tpl.category}
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 line-clamp-1">
                                {tpl.description}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening... speak now." : `Message ${activePersona.name}...`}
              rows={Math.min(5, inputText.split("\n").length || 1)}
              className="flex-1 max-h-[160px] bg-transparent outline-none border-none text-slate-800 dark:text-slate-100 text-sm py-1.5 resize-none placeholder-slate-400 dark:placeholder-slate-500"
            />

            {/* Send button with micro animation */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={(!inputText.trim() && attachedDocIds.length === 0) || isGenerating}
              className="flex items-center justify-center p-2.5 rounded-xl bg-slate-900 dark:bg-emerald-500 text-white hover:opacity-95 transition-opacity disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
          
          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium px-1">
            <span>Shift + Enter for new line. Speak in your native language (English, Telugu, Hindi supported).</span>
            <span>Ref: {inputText.length} chars</span>
          </div>
        </div>
      </div>
    </div>
  );
}
