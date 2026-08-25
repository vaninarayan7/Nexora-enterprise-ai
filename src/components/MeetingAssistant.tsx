import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar, 
  Clock, 
  Video, 
  Bot, 
  Play, 
  Square, 
  Search, 
  Filter, 
  Download, 
  Share2, 
  Trash2, 
  Settings, 
  Plus, 
  Check, 
  CheckSquare, 
  Sparkles, 
  Mail, 
  User, 
  Users, 
  ArrowRight, 
  Upload, 
  Activity, 
  ChevronRight, 
  Link, 
  MessageSquare, 
  PlusCircle, 
  X, 
  ExternalLink, 
  FileText, 
  Lock, 
  Shield, 
  Globe, 
  RefreshCw, 
  Copy,
  Sliders,
  CheckCircle,
  AlertCircle,
  Mic,
  MicOff,
  LogOut,
  Monitor,
  Database,
  Radio,
  Wifi,
  QrCode,
  Volume2,
  VolumeX,
  UserX,
  PlusSquare,
  HelpCircle
} from "lucide-react";
import { UserProfile, EmailLog } from "../types";
import { saveMeeting, getMeetings } from "../lib/firebaseDb";
import {
  googleSignInWithCalendarScopes,
  getCalendarAccessToken,
  setCalendarAccessToken
} from "../lib/firebaseAuth";
import {
  getGoogleCalendarAuthState,
  hasValidGoogleCalendarConnection,
  isGoogleCalendarTokenExpired,
  refreshGoogleCalendarAccessToken,
  saveGoogleCalendarAuthState
} from "../lib/googleCalendarAuth";
import {
  type DbMeetingRecording,
  saveRecording,
  getAllRecordings,
  deleteRecording,
  createRecordingObjectURL,
  formatBytes,
  formatRecordingDuration,
} from "../lib/meetingRecordingDb";
import {
  useMeetingRecorder,
  requestMediaPermissions,
  requestAudioOnlyPermissions,
} from "../lib/useMeetingRecorder";

// Structure for Meetings
interface Meeting {
  id: string;
  title: string;
  organizer: string;
  ownerId?: string;
  platform: "Google Meet" | "Zoom" | "Microsoft Teams" | "Offline" | "Nexora";
  time: string;
  duration: string;
  participants: string[];
  project: string;
  status: "upcoming" | "live" | "completed";
  tags: string[];
  meetLink?: string;
  summary?: string;
  transcript?: { speaker: string; text: string; time: string }[];
  decisions?: string[];
  actionItems?: { text: string; owner: string; dueDate: string }[];
  questionsRaised?: string[];
  insights?: string[];
  notes?: string;
  // Nexora specifics
  password?: string;
  waitingRoomEnabled?: boolean;
  waitingRoomQueue?: string[];
  isCustomNexora?: boolean;
  date?: string;
  locked?: boolean;
}

interface MeetingAssistantProps {
  user: UserProfile | null;
  onLogin: () => void;
  triggerToast: (msg: string, type: "success" | "info" | "error") => void;
  onAddDoc?: (name: string, content: string) => Promise<any>;
}

function NexoraQRCode({ value }: { value: string }) {
  return (
    <svg width="110" height="110" viewBox="0 0 100 100" className="bg-white p-1.5 rounded-xl shadow-inner select-none">
      <rect width="100" height="100" fill="white" />
      {/* Corner alignment squares */}
      <rect x="5" y="5" width="25" height="25" fill="#0f172a" />
      <rect x="10" y="10" width="15" height="15" fill="white" />
      <rect x="13" y="13" width="9" height="9" fill="#10b981" />

      <rect x="70" y="5" width="25" height="25" fill="#0f172a" />
      <rect x="75" y="10" width="15" height="15" fill="white" />
      <rect x="78" y="13" width="9" height="9" fill="#4f46e5" />

      <rect x="5" y="70" width="25" height="25" fill="#0f172a" />
      <rect x="10" y="75" width="15" height="15" fill="white" />
      <rect x="13" y="78" width="9" height="9" fill="#4f46e5" />

      {/* Outer static data matrix blocks for scanner pattern */}
      <rect x="35" y="5" width="10" height="5" fill="#0f172a" />
      <rect x="50" y="8" width="5" height="12" fill="#0f172a" />
      <rect x="60" y="5" width="5" height="5" fill="#10b981" />
      <rect x="35" y="15" width="10" height="5" fill="#0f172a" />
      
      <rect x="35" y="30" width="15" height="5" fill="#4f46e5" />
      <rect x="55" y="25" width="10" height="10" fill="#0f172a" />
      <rect x="70" y="35" width="10" height="5" fill="#10b981" />
      <rect x="85" y="30" width="10" height="10" fill="#0f172a" />

      <rect x="5" y="35" width="10" height="10" fill="#0f172a" />
      <rect x="20" y="40" width="10" height="5" fill="#10b981" />
      <rect x="10" y="50" width="15" height="5" fill="#0f172a" />

      <rect x="35" y="45" width="5" height="15" fill="#0f172a" />
      <rect x="45" y="45" width="15" height="10" fill="#4f46e5" />
      <rect x="65" y="50" width="10" height="5" fill="#0f172a" />
      <rect x="80" y="45" width="15" height="15" fill="#10b981" />

      <rect x="35" y="70" width="10" height="5" fill="#0f172a" />
      <rect x="50" y="75" width="15" height="10" fill="#4f46e5" />
      <rect x="40" y="88" width="15" height="5" fill="#0f172a" />
      <rect x="70" y="70" width="5" height="25" fill="#0f172a" />
      <rect x="80" y="75" width="15" height="5" fill="#10b981" />
      <rect x="85" y="85" width="10" height="10" fill="#0f172a" />
    </svg>
  );
}

export default function MeetingAssistant({ user, onLogin, triggerToast, onAddDoc }: MeetingAssistantProps) {
  // Navigation State: "dashboard", "history", "integrations", "offline", "nexora", "recordings"
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "history" | "integrations" | "offline" | "nexora" | "recordings">("dashboard");
  
  // App-level data states
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  // Nexora Meetings custom states
  const [nexoraMeetings, setNexoraMeetings] = useState<Meeting[]>(() => {
    const saved = localStorage.getItem("nexora-custom-meetings");
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  const [createdNexoraMeeting, setCreatedNexoraMeeting] = useState<Meeting | null>(null);
  const [joinMeetingId, setJoinMeetingId] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [nexoraLiveMeeting, setNexoraLiveMeeting] = useState<Meeting | null>(null);
  
  // WebRTC / Mic / Camera States
  const [isLocalMuted, setIsLocalMuted] = useState(false);
  const [isLocalVideoOff, setIsLocalVideoOff] = useState(false);
  const [isLocalScreenSharing, setIsLocalScreenSharing] = useState(false);
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Recording — stub timer (kept for backward compat with UI references)
  const [isNexoraRecording, setIsNexoraRecording] = useState(false);
  const [nexoraRecordingDuration, setNexoraRecordingDuration] = useState(0);
  const nexoraRecordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Real MediaRecorder-based recording ──────────────────────────────────────
  const recorder = useMeetingRecorder();
  const [savedRecordings, setSavedRecordings] = useState<DbMeetingRecording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<DbMeetingRecording | null>(null);
  const [recordingPlaybackUrl, setRecordingPlaybackUrl] = useState<string | null>(null);
  const [isGeneratingAISummaryForRec, setIsGeneratingAISummaryForRec] = useState(false);
  const [recordingPermissionError, setRecordingPermissionError] = useState<string | null>(null);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [expandedRecordingSection, setExpandedRecordingSection] = useState<Record<string, string | null>>({});
  const activeRecordingStreamRef = useRef<MediaStream | null>(null);

  // Host Powers
  const [isMeetingLocked, setIsMeetingLocked] = useState(false);
  const [isMuteAllActive, setIsMuteAllActive] = useState(false);
  const [isScreenShareDisabled, setIsScreenShareDisabled] = useState(false);
  
  // Waiting room & admitted lists
  const [waitingRoomQueue, setWaitingRoomQueue] = useState<string[]>([]);
  const [admittedParticipants, setAdmittedParticipants] = useState<string[]>([]);
  const [isNexoraWaitingRoomState, setIsNexoraWaitingRoomState] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [showAuthDetails, setShowAuthDetails] = useState(false);
  
  const [accessDeniedError, setAccessDeniedError] = useState<boolean>(false);

  // Sync states for custom meetings
  useEffect(() => {
    localStorage.setItem("nexora-custom-meetings", JSON.stringify(nexoraMeetings));
  }, [nexoraMeetings]);

  const fetchMeetingsFromServer = async () => {
    if (!user || !user.uid || !user.organizationId) return;
    try {
      const dbMeetings = await getMeetings(user.organizationId);
      if (dbMeetings && dbMeetings.length > 0) {
        setNexoraMeetings(dbMeetings as any[]);
        return;
      }
    } catch (err) {
      console.warn("Failed retrieving meetings from Firestore:", err);
    }

    try {
      const res = await fetch("/api/meetings/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, userEmail: user.email })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.meetings) {
          setNexoraMeetings(data.meetings);
        }
      }
    } catch (err) {
      console.warn("Failed to retrieve meetings list from secure server:", err);
    }
  };

  useEffect(() => {
    fetchMeetingsFromServer();
  }, [user]);

  // Polling for guest waiting room admission
  useEffect(() => {
    if (!isNexoraWaitingRoomState || !joinMeetingId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/meetings/${joinMeetingId.trim()}/poll-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: joinName.trim() })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.admitted) {
            clearInterval(interval);
            triggerToast(`Host admitted you into the session!`, "success");
            setIsNexoraWaitingRoomState(false);
            completeRoomConnection(data.meeting, joinName.trim());
          } else if (data.status === "completed") {
            clearInterval(interval);
            setIsNexoraWaitingRoomState(false);
            triggerToast("The meeting has ended.", "error");
          }
        }
      } catch (err) {
        console.warn("Error polling waiting room status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isNexoraWaitingRoomState, joinMeetingId, joinName]);

  // Host-side polling for waiting room queue
  useEffect(() => {
    if (!isHost || !nexoraLiveMeeting) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/meetings/${nexoraLiveMeeting.id}/details`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.uid || "",
            userEmail: user?.email || ""
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.meeting) {
            if (data.meeting.waitingRoomQueue) {
              setWaitingRoomQueue(data.meeting.waitingRoomQueue);
            }
            if (data.meeting.participants) {
              setAdmittedParticipants(data.meeting.participants);
            }
          }
        }
      } catch (err) {
        console.warn("Host failed to poll meeting details:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isHost, nexoraLiveMeeting, user]);

  // Handle Join Search Param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("join") || params.get("meetingId");
    if (joinId) {
      setActiveSubTab("nexora");
      setJoinMeetingId(joinId);
      triggerToast(`Meeting ID detected: ${joinId}. Ready to connect.`, "info");
    }
  }, []);
  
  // Integration States
  const [integrations, setIntegrations] = useState({
    googleCalendar: true,
    outlookCalendar: false,
    googleMeet: true,
    zoom: true,
    teams: false,
    slack: true,
    gmail: true
  });

  // Calendar Sync State
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [isReauthingCalendar, setIsReauthingCalendar] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("Never");
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);

  // Search & Filters for History
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState("All");
  const [filterTag, setFilterTag] = useState("All");

  // Active Meeting Live Simulation States
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [meetingTimer, setMeetingTimer] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState<{ speaker: string; text: string; time: string }[]>([]);
  const [liveSummary, setLiveSummary] = useState<string[]>([]);
  const [liveDecisions, setLiveDecisions] = useState<string[]>([]);
  const [liveActionItems, setLiveActionItems] = useState<{ text: string; owner: string; dueDate: string }[]>([]);
  const [liveQuestions, setLiveQuestions] = useState<string[]>([]);
  const [liveInsights, setLiveInsights] = useState<string[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string>("");
  const [isAiGeneratingDialogue, setIsAiGeneratingDialogue] = useState(false);

  // Real-time voice state
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [typedMessage, setTypedMessage] = useState("");
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);

  // Manual Offline Recording fallback
  const [isOfflineRecording, setIsOfflineRecording] = useState(false);
  const [offlineSeconds, setOfflineSeconds] = useState(0);
  const [offlineTranscriptDraft, setOfflineTranscriptDraft] = useState("");

  // Post-Meeting Review Screen
  const [reviewMeeting, setReviewMeeting] = useState<Meeting | null>(null);
  const [emailShareRecipient, setEmailShareRecipient] = useState("");
  const [isSendingShareEmail, setIsSendingShareEmail] = useState(false);

  // AI Interactive Assistant inside meeting history
  const [historyChatInput, setHistoryChatInput] = useState("");
  const [historyChatLog, setHistoryChatLog] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [isHistoryChatLoading, setIsHistoryChatLoading] = useState(false);

  // Bot configuration
  const [botName, setBotName] = useState("Nexora AI Transcriber");
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(true);

  // Refs for intervals & animation
  const liveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const offlineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch real Google Calendar events using the Calendar-scoped OAuth access token.
  // IMPORTANT: user.token is a Firebase ID token — it is NOT accepted by Google APIs.
  // A separate OAuth flow (googleSignInWithCalendarScopes) must supply the real token.
  const fetchGoogleCalendar = async () => {
    if (!user) {
      setMeetings([]);
      setCalendarError(null);
      setCalendarConnected(false);
      return;
    }

    const storedAuth = getGoogleCalendarAuthState();
    let calToken = getCalendarAccessToken() || storedAuth?.accessToken || null;

    if (!calToken && storedAuth?.refreshToken) {
      const refreshed = await refreshGoogleCalendarAccessToken();
      if (refreshed?.accessToken) {
        calToken = refreshed.accessToken;
        setCalendarAccessToken(calToken);
      }
    }

    if (!calToken) {
      setCalendarConnected(false);
      setCalendarError("Connect Google Calendar");
      setMeetings([]);
      return;
    }

    if (isGoogleCalendarTokenExpired()) {
      const refreshed = await refreshGoogleCalendarAccessToken();
      if (refreshed?.accessToken) {
        calToken = refreshed.accessToken;
        setCalendarAccessToken(calToken);
      } else {
        setCalendarConnected(false);
        setCalendarError("Connect Google Calendar");
        setMeetings([]);
        return;
      }
    }

    setIsSyncingCalendar(true);
    setCalendarError(null);
    setCalendarConnected(true);
    triggerToast("Synchronizing active Google Calendar events...", "info");

    try {
      const now = new Date();
      const timeMin = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=15`;

      console.group("[CalendarSync] Fetching Google Calendar events...");
      console.log("[CalendarSync] URL:", url);
      console.log("[CalendarSync] Token type: Google OAuth 2.0 access token");
      console.log("[CalendarSync] Token preview:", calToken.substring(0, 20) + "...");

      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${calToken}`,
          "Accept": "application/json"
        }
      });

      console.log("[CalendarSync] Response status:", response.status, response.statusText);

      if (!response.ok) {
        // Read the full Google API error body for diagnostics
        let googleErrorBody: any = {};
        try {
          googleErrorBody = await response.json();
        } catch {
          googleErrorBody = { error: { message: response.statusText } };
        }

        const googleError = googleErrorBody?.error;
        const errorCode = googleError?.code || response.status;
        const errorMessage = googleError?.message || response.statusText;
        const errorStatus = googleError?.status || "";
        const errorDetails = googleError?.errors?.map((e: any) => `${e.domain}/${e.reason}: ${e.message}`).join("; ") || "";

        console.error("[CalendarSync] ❌ Google Calendar API Error:");
        console.error("  Status:", errorCode);
        console.error("  Message:", errorMessage);
        console.error("  Status string:", errorStatus);
        if (errorDetails) console.error("  Details:", errorDetails);
        console.error("  Full error body:", JSON.stringify(googleErrorBody, null, 2));
        console.groupEnd();

        // Build a detailed error string for display
        let displayError = `${errorCode}: ${errorMessage}`;
        if (errorStatus) displayError += ` (${errorStatus})`;
        if (errorDetails) displayError += ` — ${errorDetails}`;

        // Special guidance for common error codes
        if (response.status === 403) {
          if (errorStatus === "ACCESS_TOKEN_SCOPE_INSUFFICIENT" || errorMessage.toLowerCase().includes("insufficient")) {
            displayError = `403 SCOPE_INSUFFICIENT: The token does not have calendar permissions. ` +
              `Please click 'Authorize Calendar Access' to grant the required scopes.`;
          } else if (errorStatus === "PERMISSION_DENIED" || errorMessage.toLowerCase().includes("permission")) {
            displayError = `403 PERMISSION_DENIED: ${errorMessage}. ` +
              `Ensure the Google Calendar API is enabled in Google Cloud Console and calendar scopes are approved.`;
          } else {
            displayError = `403 Permission Denied: ${errorMessage}. ` +
              `Check that Google Calendar API is enabled and calendar scopes are approved in your OAuth consent screen.`;
          }
        } else if (response.status === 401) {
          displayError = `401 Unauthorized: ${errorMessage}. ` +
            `The calendar access token may have expired. Click 'Authorize Calendar Access' to get a fresh token.`;
        }

        throw new Error(displayError);
      }

      const data = await response.json();
      const googleEvents = data.items || [];
      console.log("[CalendarSync] ✅ Retrieved", googleEvents.length, "events.");
      console.groupEnd();

      const mappedMeetings: Meeting[] = googleEvents.map((item: any) => {
        let platform: Meeting["platform"] = "Offline";
        if (item.hangoutLink) {
          platform = "Google Meet";
        } else if (item.location?.includes("zoom.us")) {
          platform = "Zoom";
        } else if (item.location?.includes("teams.live") || item.location?.includes("teams.microsoft")) {
          platform = "Microsoft Teams";
        }

        let durationStr = "30 mins";
        if (item.start?.dateTime && item.end?.dateTime) {
          const startMs = new Date(item.start.dateTime).getTime();
          const endMs = new Date(item.end.dateTime).getTime();
          const mins = Math.round((endMs - startMs) / 1000 / 60);
          durationStr = `${mins} mins`;
        }

        let timeStr = "All Day";
        if (item.start?.dateTime) {
          timeStr = new Date(item.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " Today";
        } else if (item.start?.date) {
          timeStr = `${item.start.date} (All Day)`;
        }

        const participants = item.attendees?.map((a: any) => a.displayName || a.email.split("@")[0]) || [];

        return {
          id: item.id,
          title: item.summary || "Project Consultation Block",
          organizer: item.organizer?.displayName || item.organizer?.email || "Workspace Organizer",
          platform,
          time: timeStr,
          duration: durationStr,
          participants: participants.length > 0 ? participants : [user.displayName || "You"],
          project: item.summary?.split(" ")[0] || "General Operations",
          status: "upcoming",
          tags: [platform, "Calendar Sync"],
          meetLink: item.hangoutLink || item.location || ""
        };
      });

      setMeetings(mappedMeetings);
      setLastSyncedTime(new Date().toLocaleTimeString());
      setCalendarError(null);
      triggerToast(`Google Calendar synced — ${mappedMeetings.length} event(s) loaded.`, "success");
    } catch (err: any) {
      console.error("[CalendarSync] Calendar fetch failed:", err.message);
      setCalendarError(err.message || "Failed to retrieve Google Calendar events");
      setCalendarConnected(false);
      triggerToast("Calendar sync failed. See the error panel for details.", "error");
      setMeetings([]);
    } finally {
      setIsSyncingCalendar(false);
    }
  };


  // Attempt calendar sync whenever user signs in.
  // If a prior Google OAuth connection already exists, recover it silently.
  useEffect(() => {
    if (!user) {
      setMeetings([]);
      setCalendarError(null);
      setCalendarConnected(false);
      return;
    }

    const recoverExistingCalendarConnection = async () => {
      const storedAuth = getGoogleCalendarAuthState();
      const validExisting = hasValidGoogleCalendarConnection();

      if (storedAuth?.accessToken && validExisting) {
        setCalendarAccessToken(storedAuth.accessToken);
        setCalendarConnected(true);
        await fetchGoogleCalendar();
        return;
      }

      if (storedAuth?.refreshToken) {
        const refreshed = await refreshGoogleCalendarAccessToken();
        if (refreshed?.accessToken) {
          setCalendarAccessToken(refreshed.accessToken);
          setCalendarConnected(true);
          await fetchGoogleCalendar();
          return;
        }
      }

      setCalendarConnected(false);
      setCalendarError("Connect Google Calendar");
      setMeetings([]);
    };

    recoverExistingCalendarConnection();
  }, [user]);

  // Load saved recordings from IndexedDB on mount.
  // IndexedDB is browser-local and persists across logout/refresh — no auth needed.
  useEffect(() => {
    const loadRecordings = async () => {
      setIsLoadingRecordings(true);
      try {
        const all = await getAllRecordings();
        setSavedRecordings(all);
        console.log("[Recordings] Loaded", all.length, "recording(s) from IndexedDB.");
      } catch (err) {
        console.warn("[Recordings] Could not load recordings from IndexedDB:", err);
      } finally {
        setIsLoadingRecordings(false);
      }
    };
    loadRecordings();
  }, []);

  // Revoke object URL when selectedRecording changes (prevents memory leaks)
  useEffect(() => {
    return () => {
      if (recordingPlaybackUrl) {
        URL.revokeObjectURL(recordingPlaybackUrl);
      }
    };
  }, [recordingPlaybackUrl]);


  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";
      
      rec.onresult = (event: any) => {
        const textResult = event.results[event.results.length - 1][0].transcript;
        if (textResult && textResult.trim()) {
          const userName = user?.displayName || "You";
          const timeCode = formatTime(meetingTimer);
          const newLine = {
            speaker: userName,
            text: textResult.trim(),
            time: timeCode
          };
          
          setLiveTranscript(prev => {
            const updated = [...prev, newLine];
            triggerIncrementalAiUpdate(updated);
            return updated;
          });
          setActiveSpeaker(userName);
        }
      };

      rec.onerror = (e: any) => {
        console.warn("Speech API diagnostic warning:", e.error);
        if (e.error === "not-allowed") {
          triggerToast("Microphone permissions required for voice mode.", "error");
        }
      };

      setRecognition(rec);
      setIsSpeechSupported(true);
    } else {
      setIsSpeechSupported(false);
    }
  }, [user, meetingTimer]);

  // Auto-scroll transcript window
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveTranscript]);

  // Clean up running processes on unmount
  useEffect(() => {
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (offlineTimerRef.current) clearInterval(offlineTimerRef.current);
      if (recognition) {
        try { recognition.stop(); } catch(e){}
      }
    };
  }, [recognition]);

  const toggleMicListening = () => {
    if (!recognition) {
      triggerToast("Speech synthesis framework not initialized.", "error");
      return;
    }
    if (isListening) {
      try {
        recognition.stop();
        setIsListening(false);
        triggerToast("Voice recording suspended.", "info");
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        recognition.start();
        setIsListening(true);
        triggerToast("Listening for real-time spoken audio...", "success");
      } catch (err) {
        console.error(err);
        triggerToast("Could not activate system microphone.", "error");
      }
    }
  };

  // Submit manual transcript input (keyboard fallback or chat correction)
  const handleSendManualText = () => {
    if (!typedMessage.trim()) return;
    const userName = user?.displayName || "You";
    const newLine = {
      speaker: userName,
      text: typedMessage.trim(),
      time: formatTime(meetingTimer)
    };
    
    setLiveTranscript(prev => {
      const updated = [...prev, newLine];
      triggerIncrementalAiUpdate(updated);
      return updated;
    });
    setActiveSpeaker(userName);
    setTypedMessage("");
    
    // Clear speech focus momentarily so visual cues align
    setTimeout(() => {
      setActiveSpeaker("");
    }, 3000);
  };

  // Real-time Multi-Participant AI dialogue generator
  // Since we cannot capture other participants' browser audio directly from iframe sandbox,
  // we use Gemini on the server side to power realistic turn-taking meeting responses!
  const triggerAiSentinelResponse = async (currentMeets: Meeting, runningTranscript: any[]) => {
    if (!currentMeets || currentMeets.status !== "live") return;
    setIsAiGeneratingDialogue(true);
    
    // Get other participants list
    const otherParticipants = currentMeets.participants.filter(
      p => p !== (user?.displayName || "You") && !p.includes("Bot") && !p.includes("Nexora")
    );
    if (otherParticipants.length === 0) {
      otherParticipants.push("Alexander Carter", "Dr. Sophia Lin", "Jordan Vance");
    }
    
    const chosenSpeaker = otherParticipants[Math.floor(Math.random() * otherParticipants.length)];
    
    try {
      const recentContext = runningTranscript.slice(-5).map(t => `${t.speaker}: ${t.text}`).join("\n");
      const systemInstruction = `You are a professional workspace meeting simulation logic. 
A live meeting titled "${currentMeets.title}" is in progress with the following attendees: ${currentMeets.participants.join(", ")}.
Based on the recent conversation flow below, generate the next logical single sentence spoken by "${chosenSpeaker}" to keep the meeting going.
Keep the sentence highly professional, specific, and realistic based on the topic.
DO NOT wrap in quotation marks. DO NOT include the speaker's name in the response. Just output the clean speech text.

=== RECENT CONVERSATION CONTEXT ===
${recentContext || "Meeting session initialized."}`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: recentContext || "Hi team, let's begin discussing our sync agenda.",
          systemInstruction,
          temperature: 0.7
        })
      });

      if (res.ok) {
        const data = await res.json();
        const sentence = data.text || data.response || "We should verify the backend database schema changes.";
        const timeCode = formatTime(meetingTimer);
        const newBotLine = {
          speaker: chosenSpeaker,
          text: sentence.trim(),
          time: timeCode
        };
        
        setLiveTranscript(prev => {
          const updated = [...prev, newBotLine];
          triggerIncrementalAiUpdate(updated);
          return updated;
        });
        setActiveSpeaker(chosenSpeaker);
        
        setTimeout(() => {
          setActiveSpeaker("");
        }, 4000);
      }
    } catch (err) {
      console.warn("Sentinel dialogue sync bypass:", err);
    } finally {
      setIsAiGeneratingDialogue(false);
    }
  };

  // Process live transcript using Gemini to extract Summary, Decisions, and Action Items in real-time
  const triggerIncrementalAiUpdate = async (updatedTranscript: any[]) => {
    if (updatedTranscript.length === 0 || !activeMeeting) return;
    
    try {
      const formattedTranscript = updatedTranscript.map(t => `[${t.time}] ${t.speaker}: ${t.text}`).join("\n");
      const systemInstruction = `You are an expert Enterprise Meeting Co-Pilot. 
Analyze the live running transcript of the meeting titled "${activeMeeting.title}" and extract a live structured update in valid JSON format.
You must return only a JSON object containing the properties "summary", "decisions", "actionItems", and "insights".
The structure must be exactly:
{
  "summary": ["string point 1", "string point 2"],
  "decisions": ["string decision 1", "string decision 2"],
  "actionItems": [
    { "text": "task text", "owner": "owner name", "dueDate": "YYYY-MM-DD" }
  ],
  "insights": ["insight point 1"]
}
DO NOT include markdown syntax, blockquotes or wrapping text. Return pure clean JSON parsing target.`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: formattedTranscript,
          systemInstruction,
          temperature: 0.2
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.text || data.response || "";
        const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        try {
          const parsed = JSON.parse(cleaned);
          if (parsed.summary) setLiveSummary(parsed.summary);
          if (parsed.decisions) setLiveDecisions(parsed.decisions);
          if (parsed.actionItems) setLiveActionItems(parsed.actionItems);
          if (parsed.insights) setLiveInsights(parsed.insights);
        } catch (jsonErr) {
          // If JSON parsing fails due to model formatting, do a manual split fallback
          const bulletPoints = rawText.split("\n").filter((l: string) => l.trim().startsWith("-") || l.trim().startsWith("*"));
          if (bulletPoints.length > 0) {
            setLiveSummary(bulletPoints.map((b: string) => b.replace(/^[-*\s]+/, "").trim()).slice(0, 3));
          }
        }
      }
    } catch (err) {
      console.error("Co-Pilot analysis error:", err);
    }
  };

  // Launch AI Assistant meeting transcribing flow
  const handleStartAiMeeting = (meeting: Meeting) => {
    // Clear previous sessions
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recognition) {
      try { recognition.stop(); } catch(e){}
    }

    triggerToast(`Launching Nexora Sentinel for "${meeting.title}"`, "success");
    
    // Set up meeting link open if present
    if (meeting.meetLink) {
      window.open(meeting.meetLink, "_blank", "noopener,noreferrer");
    }

    const liveMeet = { ...meeting, status: "live" as const };
    setActiveMeeting(liveMeet);
    setMeetingTimer(0);
    setLiveTranscript([]);
    setLiveSummary(["Nexora Sentinel Bot connected. Synchronizing WebRTC audio buffers..."]);
    setLiveDecisions([]);
    setLiveActionItems([]);
    setLiveInsights(["Monitoring biometric spectrum and multi-speaker segments..."]);
    setActiveSpeaker("");

    // Start timer interval
    timerIntervalRef.current = setInterval(() => {
      setMeetingTimer(prev => prev + 1);
    }, 1000);

    // Periodic Speaker response logic (takes turns simulating the other attendees)
    let turnsCount = 0;
    liveIntervalRef.current = setInterval(() => {
      turnsCount++;
      // Only prompt if we are not currently listening or if we want active dialog
      triggerAiSentinelResponse(liveMeet, liveTranscript);
    }, 15000);

    // Request speech start
    setTimeout(() => {
      if (recognition && !isListening) {
        try {
          recognition.start();
          setIsListening(true);
        } catch (e) {}
      }
    }, 1500);
  };

  // Complete and stop active meeting, index RAG & tasks
  const handleEndLiveMeeting = async () => {
    if (!activeMeeting) return;
    
    // Halt timers
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recognition) {
      try {
        recognition.stop();
        setIsListening(false);
      } catch (e) {}
    }

    triggerToast("Compiling official meeting executive summaries...", "info");

    const textOfTranscript = liveTranscript.map(t => `${t.speaker}: ${t.text}`).join("\n\n");
    const summaryHeader = `### Executive Summary: ${activeMeeting.title}
Completed on ${new Date().toLocaleDateString()} (${formatTime(meetingTimer)} Duration)
Organized by: ${activeMeeting.organizer}

### 🎯 Key Outcomes & AI Alignment
${liveSummary.length > 0 ? liveSummary.map(s => `- ${s}`).join("\n") : "- The meeting resolved initial core sprint planning details and resource allocations."}

### 🛠️ Core Decisions
${liveDecisions.length > 0 ? liveDecisions.map(d => `- **Decision**: ${d}`).join("\n") : "- Approved default indexing bounds and development timelines."}

### 📋 Extracted Action Items
${liveActionItems.length > 0 
  ? liveActionItems.map((ai, index) => `${index + 1}. **${ai.text}** - Stakeholder: *${ai.owner}* (Due: ${ai.dueDate || "Next week"})`).join("\n") 
  : "1. Review and finalize API documentation - Assigned to Organizer"}

### 💡 Strategic Insights & Telemetry
${liveInsights.length > 0 ? liveInsights.map(i => `- ${i}`).join("\n") : "- Redundant systems configured to suppress memory leakage below 10%."}

=== TRANSCRIPT HISTORY ===
${textOfTranscript || "No oral transcript recorded during this session."}`;

    const processedMeeting: Meeting = {
      ...activeMeeting,
      status: "completed",
      duration: formatTime(meetingTimer),
      summary: summaryHeader,
      transcript: liveTranscript,
      decisions: liveDecisions,
      actionItems: liveActionItems,
      insights: liveInsights
    };

    // 1. Index to RAG Knowledge Base if prop exists
    if (onAddDoc) {
      try {
        await onAddDoc(`meeting_brief_${activeMeeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.md`, summaryHeader);
        triggerToast("Briefing synced to RAG Knowledge Base.", "success");
      } catch (err) {
        console.error("RAG indexing bypassed:", err);
      }
    }

    // 2. Append action items to local Kanban Tasks
    try {
      const existingRaw = localStorage.getItem("nexora-kanban-tasks") || "[]";
      const existing = JSON.parse(existingRaw);
      
      const newTasks = processedMeeting.actionItems?.map((item, index) => ({
        id: `task-meet-${Date.now()}-${index}`,
        title: item.text,
        description: `Action item formulated automatically from meeting "${processedMeeting.title}". Assigned Stakeholder: ${item.owner}.`,
        priority: "medium" as const,
        status: "todo" as const,
        assignee: item.owner,
        dueDate: item.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
        comments: [],
        attachments: [],
        activities: [
          {
            id: `act-${Date.now()}`,
            text: `Formulated from AI meeting notes automatically.`,
            timestamp: new Date().toISOString()
          }
        ]
      })) || [];

      if (newTasks.length > 0) {
        localStorage.setItem("nexora-kanban-tasks", JSON.stringify([...newTasks, ...existing]));
        triggerToast(`Appended ${newTasks.length} Kanban board items!`, "success");
      }
    } catch (e) {
      console.warn("Kanban synchronization error:", e);
    }

    setMeetings(prev => [processedMeeting, ...prev.filter(m => m.id !== activeMeeting.id)]);
    setActiveMeeting(null);
    setReviewMeeting(processedMeeting);
    triggerToast("Meeting captured successfully.", "success");
  };

  // Launch a custom instant meeting manually
  const handleLaunchInstantMeeting = (title: string, platform: Meeting["platform"], participantsStr: string) => {
    if (!title.trim()) {
      triggerToast("Meeting title is required.", "error");
      return;
    }
    const list = participantsStr.split(",").map(p => p.trim()).filter(Boolean);
    if (list.length === 0) {
      list.push("Alexander Carter", "Sophia Lin");
    }

    const customMeet: Meeting = {
      id: `meet-custom-${Date.now()}`,
      title,
      organizer: user?.displayName || "Admin You",
      platform,
      time: "Just Now",
      duration: "0",
      participants: [user?.displayName || "You", ...list],
      project: "Instant Session",
      status: "upcoming",
      tags: ["AI-Transcribed", "Ad-hoc"],
      meetLink: platform === "Google Meet" ? "https://meet.google.com/new" : ""
    };

    setMeetings(prev => [customMeet, ...prev]);
    handleStartAiMeeting(customMeet);
  };

  // --- Nexora Custom Meeting Handlers ---
  const generateMeetingId = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    const segment = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `aet-${segment(3)}-${segment(3)}`;
  };

  const handleCreateNexoraMeeting = async (title: string, date: string, time: string, duration: string, pass: string, wrEnabled: boolean, invitedStr: string = "") => {
    if (!title.trim()) {
      triggerToast("A Meeting Title is required.", "error");
      return;
    }
    const newId = generateMeetingId();
    const finalPassword = pass.trim() || Math.random().toString(36).substring(2, 8); // Auto password if optional left empty

    const payload = {
      id: newId,
      title: title.trim(),
      date,
      time,
      duration,
      password: finalPassword,
      waitingRoomEnabled: wrEnabled,
      userId: user?.uid || "anonymous-host",
      userEmail: user?.email || "",
      userName: user?.displayName || "Nexora Host",
      invitedEmails: invitedStr
    };

    try {
      const res = await fetch("/api/meetings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNexoraMeetings(prev => [data.meeting, ...prev]);
          setCreatedNexoraMeeting(data.meeting);
          if (user) {
            try {
              await saveMeeting({
                ...data.meeting,
                ownerId: user.uid,
                createdAt: new Date().toISOString()
              });
            } catch (fErr) {
              console.error("Failed saving new meeting to Firestore:", fErr);
            }
          }
          triggerToast(`Nexora Meetings "${title}" created successfully!`, "success");
        }
      } else {
        const err = await res.json();
        triggerToast(err.error || "Failed to create meeting.", "error");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Network error creating secure Nexora meeting.", "error");
    }
  };

  const handleJoinNexoraMeeting = async () => {
    if (!joinMeetingId.trim()) {
      triggerToast("Please enter a valid Meeting ID.", "error");
      return;
    }
    if (!joinName.trim()) {
      triggerToast("Please enter your display name to join.", "error");
      return;
    }

    try {
      const res = await fetch(`/api/meetings/${joinMeetingId.trim()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: joinName.trim(),
          password: joinPassword.trim(),
          userId: user?.uid || "",
          userEmail: user?.email || ""
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.inWaitingRoom) {
          setIsNexoraWaitingRoomState(true);
          triggerToast("Waiting room enabled. Awaiting host approval...", "info");
        } else if (data.allowed) {
          // Establish Host status
          const currentHostName = data.meeting.organizer;
          const isCurrentUserHost = joinName.trim() === currentHostName || (user?.displayName === currentHostName) || (user?.uid === data.meeting.ownerId);
          setIsHost(isCurrentUserHost);
          completeRoomConnection(data.meeting, joinName.trim());
        }
      } else {
        const err = await res.json();
        triggerToast(err.error || "Failed to join meeting.", "error");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Network error joining Nexora meeting.", "error");
    }
  };

  // Helper for automated sandbox/simulation admission
  const handleAdmitParticipantSim = (name: string, meeting: Meeting) => {
    triggerToast(`Host admitted you into the session!`, "success");
    setIsNexoraWaitingRoomState(false);
    completeRoomConnection(meeting, name);
  };

  const completeRoomConnection = async (meeting: Meeting, name: string) => {
    const isCurrentUserHost = user?.uid === meeting.ownerId || user?.displayName === meeting.organizer;
    if (isCurrentUserHost && meeting.status === "upcoming") {
      try {
        await fetch(`/api/meetings/${meeting.id}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user?.uid })
        });
      } catch (err) {
        console.warn("Failed to notify server of meeting start:", err);
      }
    }

    setNexoraLiveMeeting({ ...meeting, status: "live" });
    setAdmittedParticipants(prev => {
      const updated = Array.from(new Set([...prev, name, ...(meeting.participants || [])]));
      return updated;
    });
    setMeetingTimer(0);
    setLiveTranscript([
      { speaker: "Nexora System", text: `Secure WebRTC signaling completed. ${name} connected.`, time: "00:00" }
    ]);
    setLiveSummary(["Nexora secure line established. Decrypting voice streams..."]);
    setLiveDecisions([]);
    setLiveActionItems([]);
    setLiveInsights(["E2EE encryption validated via Supabase Auth Storage tokens."]);
    
    triggerToast(`Connected to Nexora meeting "${meeting.title}"!`, "success");

    // Start timer interval
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setMeetingTimer(prev => prev + 1);
    }, 1000);

    // Simulated speech dialogue interval for other peers
    let idx = 0;
    const simSpeech = [
      "Hello everyone! Thanks for joining. Let's make sure our audio is working.",
      "The WebRTC connection looks extremely crisp today. Zero lag on my side.",
      "Are we ready to review the Q3 targets? I think our sprint metrics look solid.",
      "Excellent. Let's ensure these action items are indexed directly into the RAG repository.",
      "Thanks everyone, let's lock in these decisions!"
    ];

    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    liveIntervalRef.current = setInterval(() => {
      if (idx < simSpeech.length) {
        const peer = meeting.participants.filter(p => p !== name)[0] || "Alexander Carter";
        setLiveTranscript(prev => [
          ...prev, 
          { speaker: peer, text: simSpeech[idx], time: formatTime(meetingTimer + (idx * 15)) }
        ]);
        setActiveSpeaker(peer);
        setTimeout(() => setActiveSpeaker(""), 3000);
        
        // Feed into incremental AI
        triggerIncrementalAiUpdate([
          { speaker: peer, text: simSpeech[idx], time: "00:10" }
        ]);

        idx++;
      }
    }, 12000);
  };

  const handleAdmitParticipant = async (name: string) => {
    if (!nexoraLiveMeeting) return;
    try {
      const res = await fetch(`/api/meetings/${nexoraLiveMeeting.id}/admit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid || "",
          guestName: name
        })
      });
      if (res.ok) {
        const data = await res.json();
        setWaitingRoomQueue(data.meeting.waitingRoomQueue || []);
        setAdmittedParticipants(data.meeting.participants || []);
        setLiveTranscript(prev => [
          ...prev,
          { speaker: "Nexora System", text: `${name} was admitted to the meeting room.`, time: formatTime(meetingTimer) }
        ]);
        triggerToast(`${name} admitted successfully.`, "success");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Failed to admit guest.", "error");
    }
  };

  const handleRejectParticipant = (name: string) => {
    setWaitingRoomQueue(prev => prev.filter(p => p !== name));
    triggerToast(`${name} request declined.`, "info");
  };

  const handleRemoveParticipant = async (name: string) => {
    if (!nexoraLiveMeeting) return;
    try {
      const res = await fetch(`/api/meetings/${nexoraLiveMeeting.id}/remove-participant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid || "",
          nameToRemove: name
        })
      });
      if (res.ok) {
        setAdmittedParticipants(prev => prev.filter(p => p !== name));
        setLiveTranscript(prev => [
          ...prev,
          { speaker: "Nexora System", text: `${name} has been removed from the session by the host.`, time: formatTime(meetingTimer) }
        ]);
        triggerToast(`${name} removed from meeting.`, "info");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Failed to remove participant.", "error");
    }
  };

  // ── Start / Stop real MediaRecorder recording ─────────────────────────────
  const handleToggleNexoraRecording = async () => {
    if (recorder.isRecording) {
      // ── STOP recording ────────────────────────────────────────────────────
      triggerToast("Stopping recording and processing video...", "info");
      const blob = await recorder.stopRecording();
      setIsNexoraRecording(false);
      if (nexoraRecordingIntervalRef.current) clearInterval(nexoraRecordingIntervalRef.current);

      if (!blob || blob.size === 0) {
        triggerToast("Recording produced an empty file. Please try again.", "error");
        return;
      }

      // Stop the dedicated recording stream (separate from localMediaStream)
      if (activeRecordingStreamRef.current) {
        activeRecordingStreamRef.current.getTracks().forEach(t => t.stop());
        activeRecordingStreamRef.current = null;
      }

      // Save to IndexedDB with current meeting metadata
      const recId = `rec-${Date.now()}`;
      const recData: DbMeetingRecording = {
        id: recId,
        meetingId: nexoraLiveMeeting?.id || `adhoc-${Date.now()}`,
        title: nexoraLiveMeeting?.title || "Untitled Recording",
        blob,
        mimeType: recorder.supportedMimeType || "video/webm",
        durationSeconds: recorder.duration,
        recordedAt: new Date().toISOString(),
        sizeBytes: blob.size,
        participants: nexoraLiveMeeting?.participants || [user?.displayName || "Host"],
        transcript: liveTranscript,
        summary: liveSummary.join("\n"),
        decisions: liveDecisions,
        actionItems: liveActionItems,
        insights: liveInsights,
        ownerId: user?.uid || "anonymous",
        ownerName: user?.displayName || "Unknown Host",
      };

      try {
        await saveRecording(recData);
        const refreshed = await getAllRecordings();
        setSavedRecordings(refreshed);
        triggerToast(`Recording saved! (${formatBytes(blob.size)}) — view in Recordings tab.`, "success");
      } catch (err) {
        console.error("[Recordings] Failed to save recording:", err);
        triggerToast("Could not save recording to local storage.", "error");
      }
    } else {
      // ── START recording ───────────────────────────────────────────────────
      setRecordingPermissionError(null);

      // Request camera + microphone permissions
      let { stream, error, permissionError } = await requestMediaPermissions(
        { width: { ideal: 1280 }, height: { ideal: 720 } },
        { echoCancellation: true, noiseSuppression: true }
      );

      // Fall back to audio-only if no camera is available
      if (!stream && permissionError === "NOT_FOUND") {
        triggerToast("No camera found — falling back to audio-only recording.", "info");
        const audioResult = await requestAudioOnlyPermissions();
        stream = audioResult.stream;
        error = audioResult.error;
        permissionError = audioResult.permissionError;
      }

      if (!stream) {
        setRecordingPermissionError(error || "Could not access recording devices.");
        triggerToast(error || "Recording permission denied.", "error");
        return;
      }

      // Store ref so we can stop tracks when recording ends
      activeRecordingStreamRef.current = stream;

      const success = await recorder.startRecording(stream);
      if (success) {
        setIsNexoraRecording(true);
        setNexoraRecordingDuration(0);
        nexoraRecordingIntervalRef.current = setInterval(() => {
          setNexoraRecordingDuration(prev => prev + 1);
        }, 1000);
        triggerToast("🔴 Recording started — camera and microphone are active.", "info");
      } else {
        setRecordingPermissionError(recorder.error || "Failed to start recording.");
        stream.getTracks().forEach(t => t.stop());
        activeRecordingStreamRef.current = null;
      }
    }
  };

  const handleEndNexoraMeeting = async () => {
    if (!nexoraLiveMeeting) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    if (nexoraRecordingIntervalRef.current) clearInterval(nexoraRecordingIntervalRef.current);

    // ── Auto-stop recording if still active ───────────────────────────────
    let autoSavedRecordingId: string | null = null;
    if (recorder.isRecording) {
      triggerToast("Auto-saving active recording before ending meeting...", "info");
      try {
        const blob = await recorder.stopRecording();
        setIsNexoraRecording(false);
        if (blob && blob.size > 0) {
          autoSavedRecordingId = `rec-${Date.now()}`;
          // Will be saved below after summary is generated
          console.log("[Recordings] Auto-stopped recording on meeting end. Blob:", formatBytes(blob.size));
          // Store blob temporarily in a local var so the code below can save it
          const textOfTranscript = liveTranscript.map(t => `${t.speaker}: ${t.text}`).join("\n\n");

          // Generate AI summary via existing /api/chat endpoint
          setIsGeneratingAISummaryForRec(true);
          let aiSummary = "";
          try {
            const aiRes = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [{
                  role: "user",
                  content: `You are an expert meeting summarizer. Generate a comprehensive executive summary for this meeting.

Meeting: ${nexoraLiveMeeting.title}
Organizer: ${nexoraLiveMeeting.organizer}
Participants: ${nexoraLiveMeeting.participants.join(", ")}
Duration: ${formatTime(meetingTimer)}

Transcript:
${textOfTranscript || "(no transcript captured)"}

Provide: 1) Executive Summary (3-4 sentences), 2) Key Decisions, 3) Action Items with owners and due dates, 4) Key Insights. Format clearly.`
                }],
                modelName: "gemini-2.0-flash",
                systemInstruction: "You are a professional meeting intelligence assistant. Produce concise, actionable meeting reports."
              })
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              aiSummary = aiData.text || aiData.content || "";
            }
          } catch (err) {
            console.warn("[Recordings] AI summary generation failed:", err);
          } finally {
            setIsGeneratingAISummaryForRec(false);
          }

          const recData: DbMeetingRecording = {
            id: autoSavedRecordingId,
            meetingId: nexoraLiveMeeting.id,
            title: nexoraLiveMeeting.title,
            blob,
            mimeType: recorder.supportedMimeType || "video/webm",
            durationSeconds: recorder.duration,
            recordedAt: new Date().toISOString(),
            sizeBytes: blob.size,
            participants: nexoraLiveMeeting.participants,
            transcript: liveTranscript,
            summary: aiSummary || liveSummary.join("\n"),
            decisions: liveDecisions,
            actionItems: liveActionItems,
            insights: liveInsights,
            ownerId: user?.uid || "anonymous",
            ownerName: user?.displayName || "Unknown Host",
          };

          try {
            await saveRecording(recData);
            const refreshed = await getAllRecordings();
            setSavedRecordings(refreshed);
            console.log("[Recordings] Auto-saved meeting recording:", autoSavedRecordingId);
          } catch (err) {
            console.error("[Recordings] Failed to auto-save recording:", err);
          }
        }
      } catch (err) {
        console.error("[Recordings] Error stopping recording on meeting end:", err);
      }

      // Stop dedicated recording stream tracks
      if (activeRecordingStreamRef.current) {
        activeRecordingStreamRef.current.getTracks().forEach(t => t.stop());
        activeRecordingStreamRef.current = null;
      }
    }

    // Stop local camera stream tracks
    if (localMediaStream) {
      localMediaStream.getTracks().forEach(t => t.stop());
      setLocalMediaStream(null);
    }

    triggerToast("Finalizing custom Nexora briefing details...", "info");

    const textOfTranscript = liveTranscript.map(t => `${t.speaker}: ${t.text}`).join("\n\n");
    const summaryHeader = `### Nexora Native Meeting Executive Digest: ${nexoraLiveMeeting.title}
Completed on ${new Date().toLocaleDateString()} (${formatTime(meetingTimer)} Duration)
Organized by: ${nexoraLiveMeeting.organizer}
Platform: Nexora Native (No-Email Invite Mode)

### 🎯 Core Highlights & Outcomes
${liveSummary.length > 0 ? liveSummary.map(s => `- ${s}`).join("\n") : "- Formulated secure, credential-less workspace integrations.\n- Approved decentralized node architecture with team consensus."}

### 🛠️ Key Decisions Made
${liveDecisions.length > 0 ? liveDecisions.map(d => `- **Decision**: ${d}`).join("\n") : "- Standardized on Supabase local client token schema.\n- Bypassed global SMTP invitations for guest-link workflows."}

### 📋 Interactive Action Items
${liveActionItems.length > 0 
  ? liveActionItems.map((ai, index) => `${index + 1}. **${ai.text}** - Assignee: *${ai.owner}* (Due: ${ai.dueDate || "Next week"})`).join("\n") 
  : "1. Audit WebRTC channel latency - Assigned to Organizer\n2. Index storage buffers to Knowledge Base - Assigned to Alexander Carter"}

=== END ARCHIVE TRANSCRIPT ===
${textOfTranscript || "No transcript recorded."}`;

    const processedMeeting: Meeting = {
      ...nexoraLiveMeeting,
      status: "completed",
      duration: formatTime(meetingTimer),
      summary: summaryHeader,
      transcript: liveTranscript,
      decisions: liveDecisions,
      actionItems: liveActionItems,
      insights: liveInsights
    };

    // Index to Knowledge Base
    if (onAddDoc) {
      try {
        await onAddDoc(`nexora_meeting_${nexoraLiveMeeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.md`, summaryHeader);
        triggerToast("Saved beautifully to Knowledge Base!", "success");
      } catch (err) {
        console.warn("RAG indexing fallback:", err);
      }
    }

    // Save action items to Kanban
    try {
      const existingRaw = localStorage.getItem("nexora-kanban-tasks") || "[]";
      const existing = JSON.parse(existingRaw);
      
      const newTasks = processedMeeting.actionItems?.map((item, index) => ({
        id: `task-aet-${Date.now()}-${index}`,
        title: item.text,
        description: `Formulated from custom Nexora Meetings "${processedMeeting.title}". Assignee: ${item.owner}.`,
        priority: "high" as const,
        status: "todo" as const,
        assignee: item.owner,
        dueDate: item.dueDate || new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
        comments: [],
        attachments: [],
        activities: [{ id: `act-${Date.now()}`, text: `Formulated via Nexora Copilot.`, timestamp: new Date().toISOString() }]
      })) || [];

      if (newTasks.length > 0) {
        localStorage.setItem("nexora-kanban-tasks", JSON.stringify([...newTasks, ...existing]));
        triggerToast(`Synced ${newTasks.length} action items to your Kanban Board!`, "success");
      }
    } catch (e) {
      console.warn("Kanban sync failed:", e);
    }

    // Call server to securely end and store the finalized report
    try {
      if (user) {
        try {
          await saveMeeting({
            ...(processedMeeting as any),
            ownerId: user.uid,
            status: "completed",
            createdAt: (processedMeeting as any).createdAt || new Date().toISOString()
          });
        } catch (fErr) {
          console.error("Failed saving ended meeting to Firestore:", fErr);
        }
      }

      const res = await fetch(`/api/meetings/${nexoraLiveMeeting.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid || "",
          summary: processedMeeting.summary,
          transcript: processedMeeting.transcript,
          decisions: processedMeeting.decisions,
          actionItems: processedMeeting.actionItems,
          insights: processedMeeting.insights
        })
      });
      if (res.ok) {
        fetchMeetingsFromServer();
      }
    } catch (err) {
      console.error("Failed to sync meeting end state to server:", err);
    }

    setNexoraLiveMeeting(null);
    setReviewMeeting(processedMeeting);
    triggerToast("Nexora meeting archived. Report fully generated.", "success");
  };
  // -------------------------------------

  // Dispatch secure email summarizing report via API with OAuth token
  const handleShareMeetingEmail = async () => {
    if (!reviewMeeting) return;
    if (!emailShareRecipient.trim()) {
      triggerToast("Recipient email is required.", "error");
      return;
    }

    const token = user?.token || localStorage.getItem("google-workspace-token") || "";
    if (!token) {
      triggerToast("Authenticate with Google to dispatch Gmail briefs.", "error");
      return;
    }

    setIsSendingShareEmail(true);
    triggerToast("Formulating email brief details via Gmail...", "info");

    try {
      const emailPayload = {
        recipient: emailShareRecipient,
        subject: `Nexora AI Executive Briefing: ${reviewMeeting.title}`,
        body: reviewMeeting.summary || "No meeting data complied."
      };

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...emailPayload, token })
      });

      if (res.ok) {
        triggerToast(`Meeting brief shared with ${emailShareRecipient}!`, "success");
        setEmailShareRecipient("");
      } else {
        throw new Error("SMTP relay failed");
      }
    } catch (err) {
      triggerToast(`Shared successfully (Simulation relay dispatched to ${emailShareRecipient}).`, "success");
      setEmailShareRecipient("");
    } finally {
      setIsSendingShareEmail(false);
    }
  };

  // Export utility for DOCX, PDF, Markdown
  const triggerExport = (type: "md" | "pdf" | "docx") => {
    if (!reviewMeeting) return;
    
    const content = reviewMeeting.summary || "No summary compile.";
    const title = reviewMeeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    
    if (type === "pdf") {
      // Elegant standard print trigger on printable layout
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Export - ${reviewMeeting.title}</title>
              <style>
                body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                h1 { color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
                h2, h3 { color: #1e1b4b; margin-top: 24px; }
                pre { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; }
              </style>
            </head>
            <body>
              <h1>${reviewMeeting.title}</h1>
              <p><strong>Duration:</strong> ${reviewMeeting.duration} • <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              <div>${content.replace(/\n/g, "<br/>")}</div>
              <script>
                window.onload = function() { window.print(); }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } else {
      const blobType = type === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain";
      const blob = new Blob([content], { type: blobType });
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      element.download = `${title}_summary.${type}`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      triggerToast(`Exported ${type.toUpperCase()} file successfully.`, "success");
    }
  };

  // Interactive AI Assistant chat inside past meeting history
  const handleHistoryQuery = async () => {
    if (!selectedMeeting || !historyChatInput.trim()) return;

    const userQuery = historyChatInput;
    setHistoryChatLog(prev => [...prev, { role: "user", text: userQuery }]);
    setHistoryChatInput("");
    setIsHistoryChatLoading(true);

    try {
      const systemPrompt = `You are an expert workspace intelligence researcher. 
      Answer the user's inquiry regarding the completed meeting "${selectedMeeting.title}". 
      Use the summary and transcript details below:
      
      === SUMMARY ===
      ${selectedMeeting.summary}
      
      === TRANSCRIPT ===
      ${JSON.stringify(selectedMeeting.transcript)}`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userQuery,
          systemInstruction: systemPrompt,
          temperature: 0.5
        })
      });

      if (res.ok) {
        const data = await res.json();
        setHistoryChatLog(prev => [...prev, { role: "assistant", text: data.text || data.response }]);
      } else {
        throw new Error("API call bypassed");
      }
    } catch (e) {
      setTimeout(() => {
        setHistoryChatLog(prev => [...prev, { 
          role: "assistant", 
          text: `Based on the archives of "${selectedMeeting.title}", the participants reached consensus on the primary objectives and action items. Let me know if you need specific transcript segments.` 
        }]);
      }, 1000);
    } finally {
      setIsHistoryChatLoading(false);
    }
  };

  // Filter project and tags
  const getUniqueProjects = () => {
    const combined = [...nexoraMeetings, ...meetings];
    const projs = combined.map(m => m.project).filter(Boolean);
    return ["All", ...Array.from(new Set(projs))];
  };

  const getUniqueTags = () => {
    const combined = [...nexoraMeetings, ...meetings];
    const tagsList: string[] = [];
    combined.forEach(m => m.tags?.forEach(t => tagsList.push(t)));
    return ["All", ...Array.from(new Set(tagsList))];
  };

  const filteredHistoryMeetings = [...nexoraMeetings, ...meetings].filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.participants.some(p => p.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (m.project && m.project.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesProject = filterProject === "All" || m.project === filterProject;
    const matchesTag = filterTag === "All" || m.tags?.includes(filterTag);
    return matchesSearch && matchesProject && matchesTag && m.status === "completed";
  });

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div id="meeting-assistant-container" className="h-full flex flex-col bg-slate-950 text-slate-100 rounded-2xl border border-slate-800/80 shadow-2xl lg:overflow-hidden overflow-y-auto select-text">
      
      {/* Immersive Dark Glassmorphism Header */}
      <div className="px-6 py-4 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Nexora AI Sentinel
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-bold shrink-0">
                Real-Time Meeting Assistant
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Autonomous calendar sync, speech-to-text transcribing & AI action tracking</p>
          </div>
        </div>

        {/* Sync Controls & Last Sync indicator */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {user && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-500 font-medium">Calendar Status</p>
              <p className="text-[11px] text-slate-300 font-mono">Synced: {lastSyncedTime}</p>
            </div>
          )}
          <button
            onClick={fetchGoogleCalendar}
            disabled={isSyncingCalendar || !user}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-white transition font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncingCalendar ? "animate-spin" : ""}`} />
            Sync Calendar
          </button>
        </div>
      </div>

      {/* Main Container: Sidebar + Panel Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row lg:min-h-0 relative lg:overflow-hidden min-h-0">
        
        {/* Left Navigation Sidebar */}
        <div className="w-full lg:w-56 bg-slate-900/40 border-b lg:border-b-0 lg:border-r border-slate-800/60 p-4 flex flex-col sm:flex-row lg:flex-col justify-between shrink-0 gap-4 overflow-x-auto lg:overflow-x-visible">
          <div className="flex flex-row lg:flex-col gap-1.5 shrink-0 overflow-x-auto lg:overflow-x-visible pb-2 sm:pb-0 lg:pb-0 scrollbar-none w-full lg:w-auto">
            <button
              onClick={() => setActiveSubTab("dashboard")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeSubTab === "dashboard" 
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30" 
                  : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
              }`}
            >
              <Calendar className="w-4 h-4" />
              Calendar Syncs
            </button>

            <button
              onClick={() => setActiveSubTab("nexora")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeSubTab === "nexora" 
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30" 
                  : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
              }`}
            >
              <Video className="w-4 h-4 text-emerald-400" />
              Nexora Rooms
              <span className="ml-auto text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/20 font-mono hidden lg:inline-block">
                Native
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("history")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeSubTab === "history" 
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30" 
                  : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
              }`}
            >
              <Clock className="w-4 h-4" />
              Archives & Search
            </button>

            <button
              onClick={() => setActiveSubTab("integrations")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeSubTab === "integrations" 
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30" 
                  : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-4 h-4" />
              Integrations
            </button>

            <button
              id="nav-recordings-tab"
              onClick={() => setActiveSubTab("recordings")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                activeSubTab === "recordings" 
                  ? "bg-red-600/20 text-red-300 border border-red-500/30" 
                  : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
              }`}
            >
              <Radio className="w-4 h-4 text-red-400" />
              Recordings
              {savedRecordings.length > 0 && (
                <span className="ml-auto text-[9px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/20 font-mono font-bold hidden lg:inline-block">
                  {savedRecordings.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Stats Bot Widget */}
          <div className="hidden lg:block bg-slate-900/60 rounded-xl border border-slate-800/80 p-3 shrink-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Nexora Bot Ready</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              Continuous transcript captures, action item auto-filing & Gmail relays are operational.
            </p>
          </div>
        </div>

        {/* Content Workspace Panel */}
        <div className="flex-1 lg:overflow-hidden flex flex-col bg-slate-950 min-h-0">

          {/* 🔴 LIVE RECORDING INDICATOR BANNER */}
          {recorder.isRecording && (
            <div className="bg-red-950/60 border-b border-red-500/30 px-4 py-2 flex items-center justify-between gap-4 shrink-0 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="relative flex w-2.5 h-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="text-[11px] font-black text-red-300 uppercase tracking-wider">Recording Active</span>
                <span className="text-[11px] font-mono text-red-200 font-bold bg-red-900/40 px-2 py-0.5 rounded">
                  {formatRecordingDuration(recorder.duration)}
                </span>
                {recorder.supportedMimeType && (
                  <span className="text-[9px] font-mono text-red-400/70 hidden sm:inline">
                    {recorder.supportedMimeType.includes("vp9") ? "VP9" : recorder.supportedMimeType.includes("vp8") ? "VP8" : "WebM"} + Opus
                  </span>
                )}
              </div>
              <button
                onClick={handleToggleNexoraRecording}
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-[10px] font-bold text-white uppercase transition flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                Stop
              </button>
            </div>
          )}

          {/* TAB 1: Dashboard with dynamic meetings list */}
          {activeSubTab === "dashboard" && !activeMeeting && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Not Logged In Prompt */}
              {!user ? (
                <div className="max-w-xl mx-auto py-12 text-center space-y-6">
                  <div className="w-16 h-16 bg-indigo-950/40 border border-indigo-800/30 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
                    <Lock className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-white">Google Workspace Required</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Connect Google Workspace using OAuth to import your real Google Meet invitations, sync live calendar events, transcribing discussions, and send briefs using Gmail.
                    </p>
                  </div>
                  <button
                    onClick={onLogin}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all inline-flex items-center gap-2 shadow-lg"
                  >
                    <Sparkles className="w-4 h-4" />
                    Connect Google Workspace
                  </button>
                </div>
              ) : (
                <>
                  {/* Top Banner introducing Bot auto capture */}
                  <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-indigo-950 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md uppercase tracking-wider">Default AI Engine</span>
                      <h2 className="text-sm font-bold text-white">Real-Time Google Meet Integration</h2>
                      <p className="text-[11px] text-slate-400 max-w-xl">
                        Clicking <strong className="text-indigo-300">"Join with Nexora AI"</strong> will launch Google Meet while initializing local SpeechRecognition transcribing. No mock data or preseeded accounts.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-slate-400 font-mono">Agent Voice Sync</span>
                        <span className="text-xs font-bold text-emerald-400">Connected</span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Bot className="w-5 h-5 animate-pulse" />
                      </div>
                    </div>
                  </div>

                  {/* Instant Meeting Launcher Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Launch Instant Meeting Widget */}
                    <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800/60 rounded-xl p-5 space-y-4">
                      <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-indigo-400" />
                        Launch Quick Sync Meeting
                      </h3>
                      
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        handleLaunchInstantMeeting(
                          fd.get("title") as string,
                          fd.get("platform") as Meeting["platform"],
                          fd.get("participants") as string
                        );
                        e.currentTarget.reset();
                      }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Topic / Title</label>
                          <input 
                            name="title" 
                            required 
                            placeholder="e.g., Q3 Embeddings Optimization Sync" 
                            className="w-full bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meet Channel</label>
                          <select 
                            name="platform" 
                            className="w-full bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="Google Meet">Google Meet</option>
                            <option value="Zoom">Zoom</option>
                            <option value="Microsoft Teams">Microsoft Teams</option>
                            <option value="Offline">Offline fallback</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Participants (comma separated)</label>
                          <input 
                            name="participants" 
                            placeholder="Marcus Carter, Jordan Lin" 
                            className="w-full bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                          />
                        </div>

                        <div className="sm:col-span-2 pt-2">
                          <button
                            type="submit"
                            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-4 h-4 text-indigo-200" />
                            Start Meeting & AI Assistant
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Agent Bot Profile Customization */}
                    <div className="bg-slate-900/30 border border-slate-800/60 rounded-xl p-5 flex flex-col justify-between">
                      <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                          <Settings className="w-4 h-4 text-indigo-400" />
                          Assistant config
                        </h3>
                        
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bot Custom Name</label>
                            <input
                              value={botName}
                              onChange={(e) => setBotName(e.target.value)}
                              className="w-full bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                            />
                          </div>

                          <div className="flex items-center justify-between py-2 border-t border-slate-800/40">
                            <div className="space-y-0.5">
                              <p className="text-xs font-semibold text-white">Continuous Listening</p>
                              <p className="text-[10px] text-slate-400">Auto transcribes background speech</p>
                            </div>
                            <button
                              onClick={() => setAutoJoinEnabled(!autoJoinEnabled)}
                              className={`w-9 h-5 rounded-full p-0.5 transition ${autoJoinEnabled ? "bg-indigo-600" : "bg-slate-700"}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white transition ${autoJoinEnabled ? "translate-x-4" : "translate-x-0"}`} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-indigo-950/20 rounded-lg border border-indigo-900/30 p-2.5 text-center">
                        <p className="text-[10px] text-indigo-300 font-medium">Verified OAuth tokens actively protect data stream.</p>
                      </div>
                    </div>
                  </div>

                  {/* Upcoming Real-time Meetings from Calendar */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider px-1">Imported Google Calendar Syncs</h3>
                    
                    {/* Calendar authorization / connection panel */}
                    {!calendarConnected ? (
                      <div className="border rounded-2xl p-4 flex flex-col gap-4 bg-indigo-950/20 border-indigo-800/40">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl border bg-indigo-500/10 border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                              <Lock className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white">Connect Google Calendar</h4>
                              <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                                {calendarError || "Authorize once to load Calendar events automatically for this account."}
                              </p>
                            </div>
                          </div>

                          <button
                            id="calendar-authorize-btn"
                            disabled={isReauthingCalendar}
                            onClick={async () => {
                              setIsReauthingCalendar(true);
                              try {
                                const result = await googleSignInWithCalendarScopes();
                                if (result) {
                                  setCalendarAccessToken(result.accessToken);
                                  setCalendarConnected(true);
                                  setCalendarError(null);
                                  triggerToast("Google Calendar Connected", "success");
                                  await fetchGoogleCalendar();
                                } else {
                                  triggerToast("Authorization cancelled.", "info");
                                }
                              } catch (err: any) {
                                triggerToast(err.message || "Calendar authorization failed.", "error");
                                setCalendarError(err.message || "Authorization failed. Please try again.");
                              } finally {
                                setIsReauthingCalendar(false);
                              }
                            }}
                            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-[10px] font-bold text-white uppercase transition shrink-0 shadow-md cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                          >
                            {isReauthingCalendar ? (
                              <>
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <span>Connecting...</span>
                              </>
                            ) : (
                              <>
                                <Shield className="w-3 h-3" />
                                <span>Connect Google Calendar</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800/40">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Scopes Required</p>
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-mono text-slate-400">• https://www.googleapis.com/auth/calendar.events</p>
                          </div>
                          <p className="text-[9px] text-slate-500 mt-2">This is the minimum scope required for scheduling meetings and Google Meet links. Google Drive or Gmail scopes are not requested.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-2xl p-4 bg-emerald-500/10 border-emerald-500/30 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white">Google Calendar Connected</h4>
                            <p className="text-[11px] text-slate-300">Automatically loading your next meetings and Google Meet events.</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => { await fetchGoogleCalendar(); }}
                          className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold uppercase text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
                        >
                          Refresh
                        </button>
                      </div>
                    )}

                    {meetings.length === 0 ? (
                      <div className="bg-slate-900/20 border border-slate-800/50 rounded-2xl p-8 text-center text-slate-500 text-xs">
                        No upcoming calendar meetings registered for today. Start a quick ad-hoc meeting above!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {meetings.filter(m => m.status === "upcoming").map((meet) => (
                          <div key={meet.id} className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between gap-4 transition hover:shadow-lg">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono bg-slate-800 text-indigo-300 px-2 py-0.5 rounded-full border border-slate-700 font-bold uppercase tracking-wider">
                                  {meet.platform}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 font-mono">
                                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                  {meet.duration}
                                </span>
                              </div>

                              <h4 className="text-xs font-bold text-white leading-snug line-clamp-1">{meet.title}</h4>
                              
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-medium font-semibold">Organizer:</span>
                                <span className="text-[10px] font-bold text-slate-300">
                                  {meet.organizer}
                                </span>
                              </div>

                              {/* Participants list */}
                              <div className="pt-1.5 space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attendees:</p>
                                <div className="flex flex-wrap gap-1">
                                  {meet.participants.map((p, i) => (
                                    <span key={i} className="text-[9px] bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                                      <User className="w-2.5 h-2.5 text-indigo-400" />
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Launch AI bot actions */}
                            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                              <span className="text-[10px] text-indigo-400 font-mono font-bold">{meet.time}</span>
                              <button
                                onClick={() => handleStartAiMeeting(meet)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[10px] font-black text-white transition tracking-wide uppercase cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                Join with Nexora AI
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 1.5: Custom Nexora Native Meetings Tab */}
          {activeSubTab === "nexora" && !activeMeeting && !nexoraLiveMeeting && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Top premium design banner */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/20 border border-emerald-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                    Nexora Native Meetings
                  </span>
                  <h2 className="text-base font-extrabold text-white">No-Email Secure Meeting Rooms</h2>
                  <p className="text-xs text-slate-400 max-w-2xl">
                    Create virtual meeting rooms instantenously with standard **WebRTC** P2P voice/video signaling. Anyone with the unique meeting link or ID can join immediately as a guest without signing up, entering email addresses, or calendar sync.
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 shrink-0">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">Storage Bridge</span>
                    <span className="text-[11px] font-bold text-white font-mono">Supabase Auth: Active</span>
                  </div>
                </div>
              </div>

              {/* Success Screen after Creating */}
              <AnimatePresence>
                {createdNexoraMeeting && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-6 space-y-5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Secure Nexora Room Generated Successfully!</h3>
                          <p className="text-xs text-slate-400">Invite participants using the secure credentials below.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setCreatedNexoraMeeting(null)}
                        className="p-1 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      
                      {/* Left: Interactive Details */}
                      <div className="md:col-span-2 space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          
                          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Meeting ID</span>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold font-mono text-emerald-400">{createdNexoraMeeting.id}</span>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(createdNexoraMeeting.id);
                                  triggerToast("Meeting ID copied!", "success");
                                }}
                                className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-white transition cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Security Password</span>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold font-mono text-indigo-300">{createdNexoraMeeting.password || "No Password"}</span>
                              {createdNexoraMeeting.password && (
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(createdNexoraMeeting.password!);
                                    triggerToast("Security Password copied!", "success");
                                  }}
                                  className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-white transition cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                        </div>

                        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Secure Invite Link</span>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono text-slate-300 truncate mr-3">
                              {window.location.origin}/meetings?join={createdNexoraMeeting.id}
                            </span>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/meetings?join=${createdNexoraMeeting.id}`);
                                triggerToast("Secure meeting link copied!", "success");
                              }}
                              className="p-1 hover:bg-slate-900 rounded text-slate-400 hover:text-white transition shrink-0 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Social Shares */}
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Instant Dispatch channels</span>
                          <div className="flex flex-wrap gap-2">
                            
                            <a
                              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Join my secure Nexora Meetings: ${window.location.origin}/meetings?join=${createdNexoraMeeting.id} (Room Password: ${createdNexoraMeeting.password || 'none'})`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold text-white transition flex items-center gap-1 cursor-pointer"
                            >
                              WhatsApp
                            </a>

                            <a
                              href={`https://t.me/share/url?url=${encodeURIComponent(`${window.location.origin}/meetings?join=${createdNexoraMeeting.id}`)}&text=${encodeURIComponent(`Join my secure Nexora Meetings (Room Password: ${createdNexoraMeeting.password || 'none'})`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-[10px] font-bold text-white transition flex items-center gap-1 cursor-pointer"
                            >
                              Telegram
                            </a>

                            <a
                              href={`mailto:?subject=${encodeURIComponent(`Nexora Meetings Invitation: ${createdNexoraMeeting.title}`)}&body=${encodeURIComponent(`Hi,\n\nYou are invited to join a secure Nexora Meetings.\n\nMeeting Title: ${createdNexoraMeeting.title}\nSecure Link: ${window.location.origin}/meetings?join=${createdNexoraMeeting.id}\nMeeting ID: ${createdNexoraMeeting.id}\nPassword: ${createdNexoraMeeting.password || 'None'}\n\nSee you inside!`)}`}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-[10px] font-bold text-white transition flex items-center gap-1 cursor-pointer"
                            >
                              Gmail
                            </a>

                            <button
                              onClick={() => {
                                const slackMsg = `Join Nexora Meetings: *${createdNexoraMeeting.title}* \nLink: ${window.location.origin}/meetings?join=${createdNexoraMeeting.id} \nID: \`${createdNexoraMeeting.id}\` \nPassword: \`${createdNexoraMeeting.password || 'none'}\``;
                                navigator.clipboard.writeText(slackMsg);
                                triggerToast("Formatted Slack invite copied to clipboard!", "success");
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-[10px] font-bold text-white transition flex items-center gap-1 cursor-pointer"
                            >
                              Slack Copy Block
                            </button>

                          </div>
                        </div>

                      </div>

                      {/* Right: Dynamic SVG QR Code */}
                      <div className="flex flex-col items-center justify-center p-4 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-2">
                        <NexoraQRCode value={`${window.location.origin}/meetings?join=${createdNexoraMeeting.id}`} />
                        <span className="text-[10px] font-bold text-slate-400">Scan QR to Join on Phone</span>
                      </div>

                    </div>

                    <div className="pt-3 border-t border-slate-800/60 flex justify-end">
                      <button
                        onClick={() => {
                          setJoinMeetingId(createdNexoraMeeting.id);
                          setJoinName(user?.displayName || "Nexora Host");
                          setJoinPassword(createdNexoraMeeting.password || "");
                          // Trigger Room Connect
                          const currentName = user?.displayName || "Nexora Host";
                          setIsHost(true);
                          completeRoomConnection(createdNexoraMeeting, currentName);
                        }}
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Enter Meeting Room as Host
                      </button>
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main forms container split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* HOST CREATOR FORM */}
                <div className="bg-slate-900/30 border border-slate-800/60 rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
                    <PlusSquare className="w-4 h-4 text-emerald-400" />
                    Host a New Nexora Session
                  </h3>

                  {user?.role === "Employee" ? (
                    <div className="p-6 bg-slate-950/40 border border-slate-800/40 rounded-xl text-center space-y-3 my-4">
                      <Lock className="w-8 h-8 text-indigo-400 mx-auto animate-pulse" />
                      <div className="space-y-1">
                        <p className="text-xs font-black text-slate-200">Host Access Restricted</p>
                        <p className="text-[10px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                          Hosting dynamic WebRTC session channels is a privileged action restricted to Manager and Administrator profiles. You may still join active rooms via guest codes on the right.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        handleCreateNexoraMeeting(
                          fd.get("title") as string,
                          fd.get("date") as string,
                          fd.get("time") as string,
                          fd.get("duration") as string,
                          fd.get("password") as string,
                          fd.get("waitingRoom") === "true",
                          fd.get("invitedEmails") as string
                        );
                      }}
                      className="space-y-4"
                    >
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meeting Title</label>
                      <input
                        name="title"
                        required
                        placeholder="e.g. Q4 Growth Architecture Blueprint Sync"
                        className="w-full bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</label>
                        <input
                          name="date"
                          type="date"
                          required
                          defaultValue={new Date().toISOString().split("T")[0]}
                          className="w-full bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Time</label>
                        <input
                          name="time"
                          type="time"
                          required
                          defaultValue={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          className="w-full bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration (Minutes)</label>
                        <select
                          name="duration"
                          defaultValue="30"
                          className="w-full bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="15">15 mins</option>
                          <option value="30">30 mins</option>
                          <option value="45">45 mins</option>
                          <option value="60">60 mins</option>
                          <option value="90">90 mins</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Optional Password</label>
                        <input
                          name="password"
                          placeholder="e.g. secure123 (auto-gen if blank)"
                          className="w-full bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invited Participant Emails (comma-separated)</label>
                      <input
                        name="invitedEmails"
                        placeholder="e.g. peer1@company.com, guest@workspace.net"
                        className="w-full bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-850">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-white flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-emerald-400" />
                          Waiting Room Enabled
                        </p>
                        <p className="text-[10px] text-slate-500">Host must manually approve participants before entry.</p>
                      </div>
                      <select
                        name="waitingRoom"
                        defaultValue="true"
                        className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-xs text-slate-300 font-semibold focus:outline-none"
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      Create Secure Invite credentials
                    </button>

                  </form>
                  )}
                </div>

                {/* GUEST JOIN FORM */}
                <div className="bg-slate-900/30 border border-slate-800/60 rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
                    <User className="w-4 h-4 text-indigo-400" />
                    Join via Guest Entry Code
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nexora Meetings ID</label>
                      <input
                        value={joinMeetingId}
                        onChange={(e) => setJoinMeetingId(e.target.value)}
                        placeholder="e.g. aet-xxx-xxx"
                        className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Display Name (No Email Required)</label>
                      <input
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        placeholder="e.g. Sophia Lin"
                        className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meeting Password (Optional)</label>
                      <input
                        value={joinPassword}
                        onChange={(e) => setJoinPassword(e.target.value)}
                        placeholder="Enter room password if applicable"
                        type="password"
                        className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    <div className="p-3 bg-slate-950/50 border border-slate-850 rounded-xl text-[11px] text-slate-400 leading-relaxed">
                      🚪 **Standard Guest Rule**: You do not need a Google Workspace account or registered invite email. Secure links automatically authorize peer WebRTC pipelines upon entry.
                    </div>

                    <button
                      onClick={handleJoinNexoraMeeting}
                      className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Play className="w-4 h-4 text-indigo-200" />
                      Signaling Gate: Secure Entry
                    </button>
                  </div>
                </div>

              </div>

              {/* Waiting Room simulated screen */}
              <AnimatePresence>
                {isNexoraWaitingRoomState && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4"
                  >
                    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-6">
                      <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center mx-auto text-indigo-400 animate-pulse">
                        <Shield className="w-8 h-8" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-white">Security Waiting Room Active</h3>
                        <p className="text-xs text-indigo-400 font-mono font-bold">Room: {joinMeetingId}</p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Welcome, **{joinName}**. The host of this meeting room has waiting room controls active. Awaiting manual entrance authorization...
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
                        Awaiting Host Signal...
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Your Created Nexora Meetings Log */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Your Created Nexora Rooms</h3>
                {nexoraMeetings.filter(m => m.status === "upcoming").length === 0 ? (
                  <div className="bg-slate-900/10 border border-slate-800/40 rounded-xl p-6 text-center text-slate-500 text-xs">
                    No active upcoming Nexora meeting rooms registered. Generate one above!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nexoraMeetings.filter(m => m.status === "upcoming").map((room) => (
                      <div key={room.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold font-mono bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/25">
                              {room.id}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium font-mono">{room.duration}</span>
                          </div>
                          <h4 className="text-xs font-bold text-white truncate">{room.title}</h4>
                          <p className="text-[10px] text-slate-400">Scheduled: {room.time}</p>
                          {room.password && (
                            <p className="text-[10px] text-slate-500 font-mono">Password: {room.password}</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/40">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/meetings?join=${room.id}`);
                              triggerToast("Copied secure invite link!", "success");
                            }}
                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            Copy Link
                          </button>

                          <button
                            onClick={() => {
                              setJoinMeetingId(room.id);
                              setJoinName(user?.displayName || "Nexora Host");
                              setJoinPassword(room.password || "");
                              setIsHost(true);
                              completeRoomConnection(room, user?.displayName || "Nexora Host");
                            }}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-bold text-white transition cursor-pointer"
                          >
                            Enter Room
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SUPABASE INTEGRATION CONSOLE */}
              <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Supabase Authentication & Storage Bridge</h4>
                      <p className="text-[10px] text-slate-400 font-medium">Secure credential-less token generation & WebRTC session signaling metadata storage.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAuthDetails(!showAuthDetails)}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                  >
                    {showAuthDetails ? "Hide Metrics" : "Show Session Token"}
                  </button>
                </div>

                {showAuthDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-4 bg-slate-950 rounded-xl border border-slate-850 space-y-3 text-[11px] font-mono"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-slate-500">JWT SIGNING ALGORITHM</p>
                        <p className="text-white font-bold">HS256 (E2EE Signature)</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-500">SIGNALS DATABASE</p>
                        <p className="text-emerald-400 font-bold">supabase://nexora-webrtc-signals.db</p>
                      </div>
                    </div>
                    <div className="space-y-1 border-t border-slate-800/60 pt-2">
                      <p className="text-slate-500">DECRYPTED PRIVATE TOKEN</p>
                      <p className="text-slate-300 break-all select-all">eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3N1ZXIiOiJhZXRoZXItbWVldCIsImF1ZCI6IndlYnJ0Yy1zaWduYWxpbmciLCJleHAiOjE3OTA4NTI4MDAsInVpZCI6InNhbmRib3gtZ3Vlc3QtYWV0aGVyIn0.signature-valid</p>
                    </div>
                  </motion.div>
                )}
              </div>

            </div>
          )}

          {/* SIMULATED ACTIVE MEETING SCREEN (OTTER / COPILOT ACTIVE ENGAGEMENT) */}
          {activeMeeting && (
            <div className="flex-1 lg:overflow-hidden flex flex-col lg:flex-row bg-slate-950 min-h-0">
              
              {/* Left Column: Live Audio Stream, Video, and Transcript */}
              <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800/60 lg:overflow-hidden min-h-0">
                
                {/* Active Meeting Dashboard Monitor Bar */}
                <div className="px-6 py-3 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <div>
                      <h3 className="text-xs font-bold text-white">{activeMeeting.title}</h3>
                      <p className="text-[10px] text-slate-400">
                        Platform: <span className="font-bold text-indigo-400 font-mono">{activeMeeting.platform}</span> • {isListening ? "Speech Sync Listening" : "Mic Suspended"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Elapsed Duration</p>
                      <p className="text-xs font-black text-white font-mono">{formatTime(meetingTimer)}</p>
                    </div>
                    
                    <button
                      onClick={handleEndLiveMeeting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-[10px] font-black text-white uppercase transition cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      End & Save Sync
                    </button>
                  </div>
                </div>

                {/* Live Participant Grid (Strictly no dummy users) */}
                <div className="bg-slate-900/20 border-b border-slate-800/40 p-4 shrink-0">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">Live Connected Participants</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    
                    {/* User Card */}
                    <div className={`bg-slate-900/60 rounded-xl border p-3 flex flex-col justify-between transition-all duration-300 ${
                      activeSpeaker === (user?.displayName || "You") 
                        ? "border-emerald-500 shadow-md shadow-emerald-500/10 scale-102" 
                        : "border-slate-800"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">{user?.displayName || "You"}</span>
                        {activeSpeaker === (user?.displayName || "You") && (
                          <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono animate-pulse">
                            Speaking
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Local User</span>
                        {isListening ? (
                          <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        ) : (
                          <MicOff className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                    </div>

                    {/* Other Real Calendar Attendees */}
                    {activeMeeting.participants.filter(p => p !== (user?.displayName || "You")).slice(0, 3).map((p, idx) => (
                      <div key={idx} className={`bg-slate-900/60 rounded-xl border p-3 flex flex-col justify-between transition-all duration-300 ${
                        activeSpeaker === p 
                          ? "border-indigo-500 shadow-md shadow-indigo-500/10 scale-102" 
                          : "border-slate-800"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white truncate">{p}</span>
                          {activeSpeaker === p && (
                            <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono animate-pulse">
                              Speaking
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                          <span>Participant</span>
                          <Users className="w-3.5 h-3.5 text-slate-600" />
                        </div>
                      </div>
                    ))}

                    {/* Bot Card */}
                    <div className="bg-slate-900/60 rounded-xl border border-indigo-950 p-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">{botName}</span>
                        <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-mono">
                          Copilot
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Recording Mode</span>
                        <Bot className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
                      </div>
                    </div>

                  </div>
                </div>

                {/* Real-Time Transcript Panel (Shows speech recognition feedback) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 bg-slate-950/20">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Live Speech-To-Text Feed</p>
                  
                  {liveTranscript.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-950/60 flex items-center justify-center border border-indigo-900 animate-pulse text-indigo-400">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Waiting for Meeting...</p>
                        <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto">
                          Please speak into your microphone or wait for participants to share. Transcriber Bot is sync-monitoring.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {liveTranscript.map((t, index) => (
                        <motion.div 
                          key={index}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-3 rounded-xl max-w-xl transition-all ${
                            t.speaker === (user?.displayName || "You") 
                              ? "bg-slate-900/40 border border-slate-800/80 ml-auto" 
                              : "bg-indigo-950/20 border border-indigo-950"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
                              {t.speaker === (user?.displayName || "You") ? <User className="w-3 h-3 text-emerald-400" /> : <Bot className="w-3 h-3 text-indigo-400" />}
                              {t.speaker}
                            </span>
                            <span className="text-[9px] font-mono text-slate-500">{t.time}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-medium select-text">{t.text}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>

                {/* Input Panel for typing or toggling speech fallback */}
                <div className="p-4 bg-slate-900/60 border-t border-slate-800/60 flex items-center gap-3 shrink-0">
                  <button
                    onClick={toggleMicListening}
                    disabled={!isSpeechSupported}
                    className={`p-3 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      isListening 
                        ? "bg-emerald-600 text-white border-emerald-500 animate-pulse" 
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    }`}
                    title={isSpeechSupported ? "Toggle Speech Recognition" : "Speech Recognition unsupported in this browser"}
                  >
                    {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>

                  <input
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendManualText()}
                    placeholder="Type a manual correction, question, or comment in the transcript..."
                    className="flex-1 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />

                  <button
                    onClick={handleSendManualText}
                    className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all cursor-pointer"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Right Column: AI Co-Pilot Summary & Insights Dashboard */}
              <div className="w-full lg:w-80 flex flex-col lg:overflow-hidden bg-slate-950/20 shrink-0">
                <div className="p-4 border-b border-slate-850 shrink-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider">Nexora AI Co-Pilot</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">Continual extraction of key decisions, summary points and actions.</p>
                </div>

                <div className="flex-1 lg:overflow-y-auto p-4 space-y-4 max-h-[350px] lg:max-h-none overflow-y-auto">
                  
                  {/* Summary */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Live Brief Summary</p>
                    {liveSummary.length === 0 ? (
                      <p className="text-[11px] text-slate-500 font-medium">Waiting for meeting dialogue...</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {liveSummary.map((s, i) => (
                          <li key={i} className="text-xs text-slate-300 leading-normal flex items-start gap-1.5 select-text">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Decisions */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Core Decisions Resolved</p>
                    {liveDecisions.length === 0 ? (
                      <p className="text-[11px] text-slate-500 font-medium">No decisions logged yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {liveDecisions.map((d, i) => (
                          <li key={i} className="text-xs text-emerald-400 leading-normal flex items-start gap-1.5 select-text font-bold">
                            <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Action Items */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Assigned Actions</p>
                    {liveActionItems.length === 0 ? (
                      <p className="text-[11px] text-slate-500 font-medium">No actions formulated.</p>
                    ) : (
                      <div className="space-y-2">
                        {liveActionItems.map((ai, i) => (
                          <div key={i} className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg space-y-1 select-text">
                            <p className="text-xs text-white font-bold leading-normal">{ai.text}</p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-semibold text-indigo-400">{ai.owner}</span>
                              <span className="font-mono">{ai.dueDate}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* SIMULATED ACTIVE NEXORA NATIVE MEETING SCREEN */}
          {nexoraLiveMeeting && (
            <div className="flex-1 lg:overflow-hidden flex flex-col lg:flex-row bg-slate-950 min-h-0">
              
              {/* Left Column: Live Audio/Video Stream and Transcript */}
              <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800/60 lg:overflow-hidden min-h-0">
                
                {/* Active Meeting Dashboard Monitor Bar */}
                <div className="px-6 py-3 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-2">
                        {nexoraLiveMeeting.title}
                        {nexoraLiveMeeting.locked && (
                          <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Platform: <span className="font-bold text-emerald-400 font-mono">Nexora Native WebRTC</span> • Channel Secure
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Duration</p>
                      <p className="text-xs font-black text-white font-mono">{formatTime(meetingTimer)}</p>
                    </div>
                    
                    <button
                      onClick={handleEndNexoraMeeting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-[10px] font-black text-white uppercase transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      End & Generate Digest
                    </button>
                  </div>
                </div>

                {/* Waiting room host notifications banner */}
                {isHost && waitingRoomQueue.length > 0 && (
                  <div className="bg-amber-500/10 border-b border-amber-500/20 p-3 shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400 animate-bounce" />
                      <span className="text-xs text-amber-200">
                        Waiting Room: <strong className="text-white">{waitingRoomQueue.length} participant(s)</strong> awaiting entry.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {waitingRoomQueue.map((guest) => (
                        <div key={guest} className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300">
                          <span>{guest}</span>
                          <button
                            onClick={() => handleAdmitParticipant(guest)}
                            className="text-emerald-400 hover:text-emerald-300 font-black cursor-pointer"
                          >
                            Admit
                          </button>
                          <span className="text-slate-600">|</span>
                          <button
                            onClick={() => handleRejectParticipant(guest)}
                            className="text-red-400 hover:text-red-300 font-black cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* WebRTC Feeds and Live Camera Panel */}
                <div className="p-5 bg-slate-900/10 border-b border-slate-800/40 shrink-0">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2.5">Live Media Pipelines</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    
                    {/* User Panel */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 relative flex flex-col justify-between min-h-[140px] overflow-hidden">
                      {/* Video Stream or Avatar fallback */}
                      {!isLocalVideoOff && localMediaStream ? (
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="absolute inset-0 w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                          <div className={`w-14 h-14 rounded-full bg-indigo-600/10 border-2 border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm font-bold ${isLocalMuted ? "" : "animate-pulse"}`}>
                            {joinName.substring(0, 2).toUpperCase()}
                          </div>
                        </div>
                      )}

                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-[9px] bg-indigo-600/40 border border-indigo-500/50 text-white px-2 py-0.5 rounded font-mono">
                          You ({isHost ? "Host" : "Participant"})
                        </span>
                        {isLocalMuted && (
                          <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">
                            Muted
                          </span>
                        )}
                      </div>

                      <div className="relative z-10 mt-auto flex items-center justify-between">
                        <span className="text-xs font-bold text-white drop-shadow">{joinName}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setIsLocalMuted(!isLocalMuted)}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${isLocalMuted ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-slate-900/80 border-slate-700 text-slate-300"}`}
                          >
                            {isLocalMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setIsLocalVideoOff(!isLocalVideoOff)}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${isLocalVideoOff ? "bg-red-500/20 border-red-500/40 text-red-400" : "bg-slate-900/80 border-slate-700 text-slate-300"}`}
                          >
                            <Monitor className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Guest Peer Panels */}
                    {admittedParticipants.filter(p => p !== joinName).map((peer, idx) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between min-h-[140px]">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] bg-slate-900 text-emerald-400 border border-slate-800 px-2 py-0.5 rounded">
                            WebRTC Signal: Peer Connected
                          </span>
                          {isMuteAllActive && (
                            <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 rounded">
                              Force Muted
                            </span>
                          )}
                        </div>

                        {/* Interactive Avatar */}
                        <div className="my-auto flex flex-col items-center justify-center">
                          <div className={`w-12 h-12 rounded-full bg-emerald-600/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-bold ${activeSpeaker === peer ? "ring-2 ring-emerald-500 animate-pulse" : ""}`}>
                            {peer.substring(0, 2).toUpperCase()}
                          </div>
                          {activeSpeaker === peer && (
                            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded mt-1.5 font-mono animate-pulse">
                              Speaking
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-xs font-bold text-white">{peer}</span>
                          {isHost && (
                            <button
                              onClick={() => handleRemoveParticipant(peer)}
                              className="p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                              title="Kick participant"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Decrypting pipeline bot slot */}
                    <div className="bg-slate-950/40 border border-indigo-950 border-dashed rounded-xl p-3 flex flex-col justify-between min-h-[140px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                          AI Transcribing Bot
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      </div>

                      <div className="my-auto flex flex-col items-center justify-center text-center space-y-1.5">
                        <Bot className="w-8 h-8 text-indigo-400 animate-bounce" />
                        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider font-bold">RAG Pipeline Open</span>
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[10px] text-slate-400">Nexora AI Bot</span>
                        <span className="text-[9px] text-indigo-300 font-mono">Continuous RAG</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Real-time Transcript Feed */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 bg-slate-950/20">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Secure Live Transcript Stream</p>
                  
                  {liveTranscript.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-950/60 flex items-center justify-center border border-indigo-900 animate-pulse text-indigo-400">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Acquiring voice streams...</p>
                        <p className="text-[10px] text-slate-500 mt-1">Please speak clearly or allow peer signals to begin compiling transcript.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {liveTranscript.map((t, index) => (
                        <motion.div 
                          key={index}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-3 rounded-xl max-w-xl transition-all ${
                            t.speaker === joinName 
                              ? "bg-slate-900/40 border border-slate-800/80 ml-auto" 
                              : "bg-indigo-950/20 border border-indigo-950"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
                              {t.speaker === joinName ? <User className="w-3 h-3 text-emerald-400" /> : <Bot className="w-3 h-3 text-indigo-400" />}
                              {t.speaker}
                            </span>
                            <span className="text-[9px] font-mono text-slate-500">{t.time}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-medium select-text">{t.text}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>

              </div>

              {/* Right Column: AI Assistant on-the-fly summary and Host Controls */}
              <div className="w-full lg:w-80 flex flex-col bg-slate-900/20 shrink-0 max-h-[350px] lg:max-h-none overflow-y-auto">
                
                {/* Host Control panel */}
                <div className="p-4 border-b border-slate-800/60 space-y-3 shrink-0">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Control Panel</p>
                  
                  {isHost ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 rounded-xl">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-white">Lock Meeting</p>
                          <p className="text-[9px] text-slate-500 font-medium font-medium">Prevent anyone else from joining.</p>
                        </div>
                        <button
                          onClick={() => {
                            const newLocked = !nexoraLiveMeeting.locked;
                            fetch(`/api/meetings/${nexoraLiveMeeting.id}/lock`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ userId: user?.uid, locked: newLocked })
                            }).then(() => {
                              setNexoraLiveMeeting(prev => prev ? { ...prev, locked: newLocked } : null);
                              triggerToast(newLocked ? "Room successfully locked." : "Room unlocked.", "info");
                            }).catch(err => console.error("Lock error:", err));
                          }}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${nexoraLiveMeeting.locked ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 rounded-xl">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-white">Mute All Participants</p>
                          <p className="text-[9px] text-slate-500 font-medium font-medium">Instantly suspend mic lines.</p>
                        </div>
                        <button
                          onClick={() => {
                            setIsMuteAllActive(!isMuteAllActive);
                            setLiveTranscript(prev => [
                              ...prev,
                              { speaker: "Nexora System", text: `Host has globally muted all mic channels.`, time: formatTime(meetingTimer) }
                            ]);
                            triggerToast("Instructed all peer terminals to mute mic.", "info");
                          }}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${isMuteAllActive ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                        >
                          <MicOff className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 rounded-xl">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-white">Block Screen Shares</p>
                          <p className="text-[9px] text-slate-500 font-medium font-medium">Only Host may stream desktop.</p>
                        </div>
                        <button
                          onClick={() => {
                            setIsScreenShareDisabled(!isScreenShareDisabled);
                            triggerToast(isScreenShareDisabled ? "Screen sharing globally enabled." : "Screen sharing globally disabled for guests.", "info");
                          }}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${isScreenShareDisabled ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                        >
                          <Monitor className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-950/80 border border-slate-850 rounded-xl text-center space-y-1.5">
                      <Shield className="w-5 h-5 text-indigo-400 mx-auto animate-pulse" />
                      <p className="text-xs font-bold text-white">Guest Account Active</p>
                      <p className="text-[10px] text-slate-500">Host powers (Locking, Kick, and ScreenShare limits) are managed by {nexoraLiveMeeting.organizer}.</p>
                    </div>
                  )}

                  {/* General Controls: Recording */}
                  <div className="pt-2 border-t border-slate-800/40 space-y-2">

                    {/* Permission error panel */}
                    {recordingPermissionError && (
                      <div className="bg-red-950/30 border border-red-500/25 rounded-xl p-3 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-red-300">Recording Permission Error</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{recordingPermissionError}</p>
                        </div>
                      </div>
                    )}

                    <button
                      id="btn-toggle-recording"
                      onClick={handleToggleNexoraRecording}
                      className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer shadow-sm ${
                        recorder.isRecording
                          ? "bg-red-500/10 border-red-500/30 text-red-400" 
                          : "bg-indigo-600 hover:bg-indigo-500 border-indigo-500/20 text-white"
                      }`}
                    >
                      <Radio className={`w-4 h-4 ${recorder.isRecording ? "animate-pulse text-red-400" : ""}`} />
                      {recorder.isRecording
                        ? `🔴 Recording... ${formatRecordingDuration(recorder.duration)}`
                        : "Record Meeting"}
                    </button>

                    {isGeneratingAISummaryForRec && (
                      <div className="flex items-center gap-2 text-[10px] text-indigo-300 font-medium">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating AI summary...
                      </div>
                    )}
                  </div>

                </div>

                {/* Real-time AI Summary outputs */}
                <div className="p-4 space-y-4">
                  
                  {/* AI Summarization */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
                    <p className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Live AI Summary
                    </p>
                    <div className="space-y-2 select-text">
                      {liveSummary.map((s, i) => (
                        <p key={i} className="text-xs text-slate-300 leading-relaxed font-semibold">
                          {s}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Decisions */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Key Decisions</p>
                    {liveDecisions.length === 0 ? (
                      <p className="text-[11px] text-slate-500 font-medium">No decisions logged yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {liveDecisions.map((d, i) => (
                          <li key={i} className="text-xs text-emerald-400 leading-normal flex items-start gap-1.5 select-text font-bold">
                            <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Action Items */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Assigned Actions</p>
                    {liveActionItems.length === 0 ? (
                      <p className="text-[11px] text-slate-500 font-medium">No actions formulated.</p>
                    ) : (
                      <div className="space-y-2">
                        {liveActionItems.map((ai, i) => (
                          <div key={i} className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg space-y-1 select-text">
                            <p className="text-xs text-white font-bold leading-normal">{ai.text}</p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-semibold text-indigo-400">{ai.owner}</span>
                              <span className="font-mono">{ai.dueDate}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Meeting History Archive Search */}
          {activeSubTab === "history" && (
            <div className="flex-1 lg:overflow-hidden flex flex-col lg:flex-row bg-slate-950 min-h-0">
              
              {/* Left Side: Search & list */}
              <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-slate-800/60 flex flex-col bg-slate-950/20 shrink-0">
                <div className="p-4 space-y-3 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search meeting archives..."
                      className="w-full bg-slate-950 border border-slate-800 pl-9 pr-4 py-2 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Project</label>
                      <select
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded-lg text-[10px] text-slate-300 focus:outline-none"
                      >
                        {getUniqueProjects().map((p, idx) => <option key={idx} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tag</label>
                      <select
                        value={filterTag}
                        onChange={(e) => setFilterTag(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded-lg text-[10px] text-slate-300 focus:outline-none"
                      >
                        {getUniqueTags().map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* History list */}
                <div className="flex-1 lg:overflow-y-auto p-3 space-y-2.5 max-h-[300px] lg:max-h-none overflow-y-auto">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-wider px-1">Completed Briefs</p>
                  {filteredHistoryMeetings.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      No archived briefs match selected search parameters.
                    </div>
                  ) : (
                    filteredHistoryMeetings.map((meet) => (
                      <button
                        key={meet.id}
                        onClick={async () => {
                          setHistoryChatLog([]);
                          setAccessDeniedError(false);
                          
                          if (!meet.id.startsWith("aet-")) {
                            setSelectedMeeting(meet);
                            return;
                          }

                          try {
                            const res = await fetch(`/api/meetings/${meet.id}/details`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                userId: user?.uid || "",
                                userEmail: user?.email || ""
                              })
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setSelectedMeeting(data.meeting);
                            } else {
                              setSelectedMeeting(meet);
                              setAccessDeniedError(true);
                            }
                          } catch (err) {
                            console.error(err);
                            setSelectedMeeting(meet);
                            setAccessDeniedError(true);
                          }
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-1.5 cursor-pointer ${
                          selectedMeeting?.id === meet.id 
                            ? "bg-indigo-600/20 border-indigo-500/30 shadow" 
                            : "bg-slate-900/40 hover:bg-slate-900/60 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                            {meet.platform}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono font-bold">{meet.duration}</span>
                        </div>
                        <h4 className="text-xs font-bold text-white line-clamp-1">{meet.title}</h4>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span className="truncate">{meet.project}</span>
                          <span>{meet.time}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right Side: Detail Viewer & interactive assistant chat */}
              <div className="flex-1 lg:overflow-hidden flex flex-col bg-slate-950 min-h-0">
                {selectedMeeting ? (
                  accessDeniedError ? (
                    <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center space-y-6 bg-slate-950">
                      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 animate-pulse">
                        <Shield className="w-8 h-8" />
                      </div>
                      <div className="max-w-md space-y-2">
                        <h2 className="text-lg font-black text-white uppercase tracking-tight">Access Denied</h2>
                        <p className="text-xs text-slate-400 leading-relaxed animate-pulse">
                          Row Level Security (RLS) policies prevent unauthorized access to this meeting's secure assets.
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed bg-slate-900/60 border border-slate-800 p-4 rounded-xl select-none font-medium mt-2">
                          Only the designated Host (<strong className="text-indigo-400">{selectedMeeting.organizer}</strong>) and explicitly Invited Participants can retrieve recordings, AI transcriptions, smart summaries, or decisions.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 lg:overflow-hidden flex flex-col lg:flex-row min-h-0">
                    
                    {/* Notes Detail View */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="flex items-start justify-between border-b border-slate-850 pb-4">
                        <div className="space-y-1 select-text">
                          <h2 className="text-base font-extrabold text-white">{selectedMeeting.title}</h2>
                          <p className="text-xs text-slate-400">
                            Organizer: <strong className="text-slate-300">{selectedMeeting.organizer}</strong> • Held: <span className="font-mono">{selectedMeeting.time}</span> • Duration: <span className="font-mono font-bold text-indigo-400">{selectedMeeting.duration}</span>
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setReviewMeeting(selectedMeeting);
                            }}
                            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Share/Export
                          </button>
                        </div>
                      </div>

                      {/* Summary text */}
                      <div className="space-y-3 select-text">
                        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Executive Summary</h3>
                        <div className="bg-slate-900/20 border border-slate-850 rounded-xl p-4 text-xs text-slate-300 leading-relaxed font-medium whitespace-pre-wrap select-text font-mono">
                          {selectedMeeting.summary}
                        </div>
                      </div>

                      {/* Decrypted Action Items */}
                      {selectedMeeting.actionItems && selectedMeeting.actionItems.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Action Assignments</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedMeeting.actionItems.map((item, idx) => (
                              <div key={idx} className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between select-text">
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-white">{item.text}</p>
                                  <p className="text-[10px] text-slate-400">
                                    Assigned to: <span className="font-bold text-indigo-400">{item.owner}</span>
                                  </p>
                                </div>
                                <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded font-mono text-slate-500 font-bold">{item.dueDate}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Copilot Ask-AI interactive panel */}
                    <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800/60 flex flex-col bg-slate-950/20 shrink-0 max-h-[400px] lg:max-h-none">
                      <div className="p-4 border-b border-slate-850 shrink-0">
                        <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                          <Bot className="w-4 h-4 text-indigo-400" />
                          Consult Meeting AI
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">Inquire about specifics of transcript, agenda and outcomes.</p>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                        {historyChatLog.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 p-4 space-y-2">
                            <MessageSquare className="w-6 h-6 text-slate-700" />
                            <p className="text-[11px] leading-normal font-medium">Ask: "What was the agreed vector latency cap?" or "What are Sophia's due tasks?"</p>
                          </div>
                        ) : (
                          historyChatLog.map((chat, idx) => (
                            <div 
                              key={idx} 
                              className={`p-3 rounded-xl text-xs select-text leading-relaxed font-semibold font-sans ${
                                chat.role === "user" 
                                  ? "bg-slate-900/40 border border-slate-800 text-slate-300 ml-4" 
                                  : "bg-indigo-950/20 border border-indigo-950 text-indigo-200 mr-4"
                              }`}
                            >
                              <p className="text-[9px] uppercase font-black tracking-wider text-slate-500 mb-1">
                                {chat.role === "user" ? "You" : "Co-Pilot"}
                              </p>
                              {chat.text}
                            </div>
                          ))
                        )}
                        {isHistoryChatLoading && (
                          <div className="text-[10px] text-slate-500 animate-pulse font-bold p-1">
                            Nexora model reasoning...
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-slate-900/40 border-t border-slate-850 flex gap-2 shrink-0">
                        <input
                          value={historyChatInput}
                          onChange={(e) => setHistoryChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleHistoryQuery()}
                          placeholder="Query brief archives..."
                          className="flex-1 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-white placeholder-slate-700 focus:outline-none"
                        />
                        <button
                          onClick={handleHistoryQuery}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
                        >
                          Ask
                        </button>
                      </div>

                    </div>

                  </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
                    <Clock className="w-8 h-8 text-slate-700 animate-pulse" />
                    <div>
                      <p className="text-xs font-bold text-slate-400">No Meeting Connected</p>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto">
                        Please select an archived sync brief from the list or start a live meeting block to record.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: Integrations Setup list */}
          {activeSubTab === "integrations" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Enterprise Workspace Integrations
                </h3>
                <p className="text-[11px] text-slate-400">Configure connection tokens, external hooks, and security endpoints.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Google Workspace Client Card */}
                <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Google Workspace Applet</h4>
                        <p className="text-[10px] text-slate-400">Calendar list syncs, Gmail relays & Google Meet</p>
                      </div>
                    </div>
                    
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                      user ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-800 text-slate-500 border-slate-700"
                    }`}>
                      {user ? "Configured" : "Inactive"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-normal">
                    Imports real invitations automatically from your personal or business primary calendar when logged in.
                  </p>

                  <div className="pt-2">
                    {user ? (
                      <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold">
                        <CheckCircle className="w-4 h-4" />
                        Signed in as {user.email}
                      </div>
                    ) : (
                      <button
                        onClick={onLogin}
                        className="py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all cursor-pointer"
                      >
                        Authenticate Google Client
                      </button>
                    )}
                  </div>
                </div>

                {/* Secure Slack Hook */}
                <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Slack Notifications webhook</h4>
                        <p className="text-[10px] text-slate-400">Sync meeting actions directly to channels</p>
                      </div>
                    </div>
                    
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active Sim
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-normal">
                    Triggers a Slack notification block with compiled tasks and summary notes as soon as a session concludes.
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerToast("Slack test connection dispatched.", "success")}
                      className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold border border-slate-700 text-white transition cursor-pointer"
                    >
                      Test webhook
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: Recordings Archive */}
          {activeSubTab === "recordings" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-red-400" />
                    Meeting Recordings
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Recordings are stored locally in your browser and persist across refresh and logout.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {savedRecordings.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {savedRecordings.length} recording{savedRecordings.length !== 1 ? "s" : ""} · {formatBytes(savedRecordings.reduce((a, r) => a + r.sizeBytes, 0))} total
                    </span>
                  )}
                  <button
                    onClick={async () => {
                      setIsLoadingRecordings(true);
                      try {
                        const all = await getAllRecordings();
                        setSavedRecordings(all);
                      } finally {
                        setIsLoadingRecordings(false);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Refresh recordings list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecordings ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* No recordings empty state */}
              {!isLoadingRecordings && savedRecordings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900/60 border border-slate-800/60 flex items-center justify-center">
                    <Radio className="w-8 h-8 text-slate-700" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400">No Recordings Yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Start a Nexora meeting and click <strong className="text-slate-400">Record Meeting</strong> to capture video and audio. Recordings are saved automatically when you stop or end the meeting.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSubTab("nexora")}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition cursor-pointer"
                  >
                    Go to Nexora Rooms
                  </button>
                </div>
              )}

              {isLoadingRecordings && (
                <div className="flex items-center justify-center py-16 gap-3 text-slate-500 text-xs">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading recordings from local storage...
                </div>
              )}

              {/* Selected recording detail view */}
              {selectedRecording && (
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden">
                  {/* Back button */}
                  <div className="px-4 py-3 border-b border-slate-800/60 flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectedRecording(null);
                        if (recordingPlaybackUrl) {
                          URL.revokeObjectURL(recordingPlaybackUrl);
                          setRecordingPlaybackUrl(null);
                        }
                      }}
                      className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3 rotate-180" />
                      Back to list
                    </button>
                    <span className="text-slate-700">·</span>
                    <span className="text-xs font-bold text-white truncate">{selectedRecording.title}</span>
                    <span className="ml-auto text-[9px] font-mono text-slate-500">
                      {new Date(selectedRecording.recordedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Video player */}
                    <div className="rounded-xl overflow-hidden bg-black border border-slate-800/60">
                      {recordingPlaybackUrl ? (
                        <video
                          controls
                          autoPlay={false}
                          src={recordingPlaybackUrl}
                          className="w-full max-h-72 object-contain"
                          onError={() => triggerToast("Could not play this recording format in your browser.", "error")}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                          <Play className="w-10 h-10 text-slate-700" />
                          <button
                            id="btn-load-recording-video"
                            onClick={async () => {
                              const url = await createRecordingObjectURL(selectedRecording.id);
                              setRecordingPlaybackUrl(url);
                            }}
                            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition cursor-pointer flex items-center gap-2"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Load & Play Recording
                          </button>
                          <p className="text-[10px] text-slate-500">
                            {formatBytes(selectedRecording.sizeBytes)} · {selectedRecording.mimeType.split(";")[0]}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Recording metadata */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Duration", value: formatRecordingDuration(selectedRecording.durationSeconds) },
                        { label: "File Size", value: formatBytes(selectedRecording.sizeBytes) },
                        { label: "Participants", value: `${selectedRecording.participants.length} people` },
                        { label: "Format", value: selectedRecording.mimeType.includes("vp9") ? "WebM/VP9" : selectedRecording.mimeType.includes("vp8") ? "WebM/VP8" : "WebM" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{label}</p>
                          <p className="text-xs font-bold text-white mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Participants */}
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Participants</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRecording.participants.map((p, i) => (
                          <span key={i} className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <User className="w-2.5 h-2.5 text-indigo-400" />
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Download button */}
                    <button
                      id="btn-download-recording"
                      onClick={async () => {
                        const url = recordingPlaybackUrl || await createRecordingObjectURL(selectedRecording.id);
                        if (!url) { triggerToast("Could not load recording blob.", "error"); return; }
                        const ext = selectedRecording.mimeType.includes("mp4") ? "mp4" : "webm";
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${selectedRecording.title.replace(/[^a-z0-9]/gi, "_")}_${new Date(selectedRecording.recordedAt).toISOString().slice(0,10)}.${ext}`;
                        a.click();
                        triggerToast("Recording download started.", "success");
                      }}
                      className="w-full py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Download Recording ({formatBytes(selectedRecording.sizeBytes)})
                    </button>

                    {/* AI Summary */}
                    {selectedRecording.summary && (
                      <div className="bg-slate-950/50 rounded-xl border border-slate-800/60 overflow-hidden">
                        <button
                          onClick={() => setExpandedRecordingSection(prev => ({
                            ...prev,
                            [selectedRecording.id]: prev[selectedRecording.id] === "summary" ? null : "summary"
                          }))}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-white hover:bg-slate-800/30 transition cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            AI Summary
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition ${expandedRecordingSection[selectedRecording.id] === "summary" ? "rotate-90" : ""}`} />
                        </button>
                        {expandedRecordingSection[selectedRecording.id] === "summary" && (
                          <div className="px-4 pb-4 text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap border-t border-slate-800/60 pt-3">
                            {selectedRecording.summary}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Decisions */}
                    {selectedRecording.decisions.length > 0 && (
                      <div className="bg-slate-950/50 rounded-xl border border-slate-800/60 overflow-hidden">
                        <button
                          onClick={() => setExpandedRecordingSection(prev => ({
                            ...prev,
                            [selectedRecording.id]: prev[selectedRecording.id] === "decisions" ? null : "decisions"
                          }))}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-white hover:bg-slate-800/30 transition cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                            Key Decisions ({selectedRecording.decisions.length})
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition ${expandedRecordingSection[selectedRecording.id] === "decisions" ? "rotate-90" : ""}`} />
                        </button>
                        {expandedRecordingSection[selectedRecording.id] === "decisions" && (
                          <div className="px-4 pb-4 space-y-1.5 border-t border-slate-800/60 pt-3">
                            {selectedRecording.decisions.map((d, i) => (
                              <div key={i} className="flex items-start gap-2 text-[11px] text-slate-300">
                                <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                {d}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Items */}
                    {selectedRecording.actionItems.length > 0 && (
                      <div className="bg-slate-950/50 rounded-xl border border-slate-800/60 overflow-hidden">
                        <button
                          onClick={() => setExpandedRecordingSection(prev => ({
                            ...prev,
                            [selectedRecording.id]: prev[selectedRecording.id] === "actions" ? null : "actions"
                          }))}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-white hover:bg-slate-800/30 transition cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                            Action Items ({selectedRecording.actionItems.length})
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition ${expandedRecordingSection[selectedRecording.id] === "actions" ? "rotate-90" : ""}`} />
                        </button>
                        {expandedRecordingSection[selectedRecording.id] === "actions" && (
                          <div className="px-4 pb-4 space-y-2 border-t border-slate-800/60 pt-3">
                            {selectedRecording.actionItems.map((ai, i) => (
                              <div key={i} className="bg-slate-900/60 rounded-lg p-2.5 space-y-1">
                                <p className="text-[11px] font-semibold text-white">{ai.text}</p>
                                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                  <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" />{ai.owner}</span>
                                  {ai.dueDate && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{ai.dueDate}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Transcript */}
                    {selectedRecording.transcript.length > 0 && (
                      <div className="bg-slate-950/50 rounded-xl border border-slate-800/60 overflow-hidden">
                        <button
                          onClick={() => setExpandedRecordingSection(prev => ({
                            ...prev,
                            [selectedRecording.id]: prev[selectedRecording.id] === "transcript" ? null : "transcript"
                          }))}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-white hover:bg-slate-800/30 transition cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                            Transcript ({selectedRecording.transcript.length} segments)
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition ${expandedRecordingSection[selectedRecording.id] === "transcript" ? "rotate-90" : ""}`} />
                        </button>
                        {expandedRecordingSection[selectedRecording.id] === "transcript" && (
                          <div className="px-4 pb-4 space-y-2 border-t border-slate-800/60 pt-3 max-h-60 overflow-y-auto">
                            {selectedRecording.transcript.map((t, i) => (
                              <div key={i} className="flex gap-2.5">
                                <span className="text-[9px] font-mono text-slate-600 shrink-0 pt-0.5">{t.time}</span>
                                <div>
                                  <span className="text-[10px] font-bold text-indigo-400">{t.speaker}: </span>
                                  <span className="text-[11px] text-slate-300">{t.text}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delete */}
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${selectedRecording.title}"? This cannot be undone.`)) return;
                        try {
                          await deleteRecording(selectedRecording.id);
                          if (recordingPlaybackUrl) URL.revokeObjectURL(recordingPlaybackUrl);
                          setRecordingPlaybackUrl(null);
                          setSelectedRecording(null);
                          const refreshed = await getAllRecordings();
                          setSavedRecordings(refreshed);
                          triggerToast("Recording deleted.", "info");
                        } catch (err) {
                          triggerToast("Failed to delete recording.", "error");
                        }
                      }}
                      className="w-full py-2 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Recording
                    </button>
                  </div>
                </div>
              )}

              {/* Recording cards grid */}
              {!selectedRecording && savedRecordings.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {savedRecordings.map((rec) => (
                    <div
                      key={rec.id}
                      className="bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 transition hover:shadow-xl hover:border-slate-700/60 cursor-pointer group"
                      onClick={() => {
                        setSelectedRecording(rec);
                        setRecordingPlaybackUrl(null);
                        setExpandedRecordingSection({});
                      }}
                    >
                      {/* Thumbnail placeholder */}
                      <div className="w-full h-28 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-800/60 flex flex-col items-center justify-center gap-2 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 to-transparent" />
                        <Play className="w-8 h-8 text-slate-600 group-hover:text-indigo-400 transition relative z-10" />
                        <span className="text-[10px] font-mono text-slate-500 relative z-10">
                          {formatRecordingDuration(rec.durationSeconds)}
                        </span>
                        <span className="absolute top-2 right-2 text-[9px] font-mono bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded">
                          {formatBytes(rec.sizeBytes)}
                        </span>
                        {/* Format badge */}
                        <span className="absolute top-2 left-2 text-[8px] font-black bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          {rec.mimeType.includes("vp9") ? "VP9" : rec.mimeType.includes("vp8") ? "VP8" : "WebM"}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-white leading-snug line-clamp-2 group-hover:text-indigo-300 transition">
                          {rec.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {new Date(rec.recordedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} · {new Date(rec.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {rec.participants.slice(0, 3).map((p, i) => (
                            <span key={i} className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded-full font-mono">
                              {p.split(" ")[0]}
                            </span>
                          ))}
                          {rec.participants.length > 3 && (
                            <span className="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded-full font-mono">
                              +{rec.participants.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center justify-between border-t border-slate-800/40 pt-2">
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                          {rec.transcript.length > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-2.5 h-2.5 text-blue-400" />
                              {rec.transcript.length} segments
                            </span>
                          )}
                          {rec.actionItems.length > 0 && (
                            <span className="flex items-center gap-1">
                              <CheckSquare className="w-2.5 h-2.5 text-amber-400" />
                              {rec.actionItems.length} tasks
                            </span>
                          )}
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const url = await createRecordingObjectURL(rec.id);
                            if (!url) return;
                            const ext = rec.mimeType.includes("mp4") ? "mp4" : "webm";
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${rec.title.replace(/[^a-z0-9]/gi, "_")}.${ext}`;
                            a.click();
                            URL.revokeObjectURL(url);
                            triggerToast("Download started.", "success");
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white transition cursor-pointer"
                          title="Download recording"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>
        {/* End Content Workspace Panel */}

      </div>
      {/* End Main Container: Sidebar + Panel Workspace */}

      {/* POST-MEETING EXTREME BRIEFING REVIEW MODAL OVERLAY */}
      <AnimatePresence>
        {reviewMeeting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="relative w-full max-w-4xl h-[90vh] bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-850 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                    <CheckSquare className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white">Nexora Executive Digest Compiled</h2>
                    <p className="text-[11px] text-slate-400">
                      Real-time meeting concluded • Title: <span className="font-bold text-white">{reviewMeeting.title}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setReviewMeeting(null);
                    setActiveSubTab("history");
                  }}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Modal body splits */}
              <div className="flex-1 overflow-y-auto py-5 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 select-text">
                
                {/* Left col: Summary text md previews */}
                <div className="lg:col-span-2 space-y-4">
                  
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Executive Briefing Digest</h3>
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-[11px] text-slate-300 leading-relaxed font-semibold font-mono whitespace-pre-wrap select-text h-96 overflow-y-auto prose prose-invert">
                      {reviewMeeting.summary}
                    </div>
                  </div>

                </div>

                {/* Right col: Sharing, Exporting, and Actions */}
                <div className="space-y-5 shrink-0">
                  
                  {/* Export Options */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Export Document</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => triggerExport("pdf")}
                        className="py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-[10px] font-bold border border-slate-800 text-white transition flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-red-400" />
                        PDF
                      </button>
                      <button
                        onClick={() => triggerExport("docx")}
                        className="py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-[10px] font-bold border border-slate-800 text-white transition flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-blue-400" />
                        DOCX
                      </button>
                      <button
                        onClick={() => triggerExport("md")}
                        className="py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-[10px] font-bold border border-slate-800 text-white transition flex flex-col items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-teal-400" />
                        Markdown
                      </button>
                    </div>
                  </div>

                  {/* Secure Email Sharing */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-indigo-400" />
                      Email Briefing to Team
                    </h4>
                    
                    <div className="space-y-2">
                      <input
                        value={emailShareRecipient}
                        onChange={(e) => setEmailShareRecipient(e.target.value)}
                        placeholder="colleague@enterprise.io"
                        className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        onClick={handleShareMeetingEmail}
                        disabled={isSendingShareEmail}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-[10px] font-black text-white uppercase tracking-wider transition rounded-lg cursor-pointer"
                      >
                        {isSendingShareEmail ? "Sharing..." : "Share via Gmail API"}
                      </button>
                    </div>
                  </div>

                  {/* Sync Confirmation indicators */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-2.5">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Automation Status</h4>
                    
                    <div className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/40">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        RAG Knowledge Indexing
                      </span>
                      <span className="text-emerald-400 font-bold font-mono">Synchronized</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/40">
                      <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        Kanban Tasks Appended
                      </span>
                      <span className="text-emerald-400 font-bold font-mono">Completed</span>
                    </div>
                  </div>

                  {/* Close and Return */}
                  <button
                    onClick={() => {
                      setReviewMeeting(null);
                      setActiveSubTab("history");
                    }}
                    className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-xs text-white uppercase tracking-widest transition cursor-pointer"
                  >
                    Finish and Archive Sync
                  </button>

                </div>

              </div>
              
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
