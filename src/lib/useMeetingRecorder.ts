// ── useMeetingRecorder — React Hook for MediaRecorder API ────────────────────
// Encapsulates the full recording lifecycle:
//   - Permission requests (camera + microphone)
//   - MediaRecorder initialization with codec fallback
//   - Chunk collection during recording
//   - Blob assembly on stop
//   - Live duration timer
//   - Graceful error messaging for all permission/device failure cases

import { useState, useRef, useCallback, useEffect } from "react";
import { getSupportedMimeType } from "./meetingRecordingDb";

export type RecordingPermissionError =
  | "NOT_ALLOWED"       // User denied camera/mic permission
  | "NOT_FOUND"         // No camera or mic detected
  | "NOT_READABLE"      // Device in use by another app
  | "OVERCONSTRAINED"   // Requested constraints not satisfiable
  | "SECURITY"          // Secure context required (needs HTTPS or localhost)
  | "UNKNOWN";

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;           // Elapsed seconds
  error: string | null;       // Human-readable error message
  permissionError: RecordingPermissionError | null;
  hasPermission: boolean | null;  // null = not yet asked
  supportedMimeType: string;
}

export interface UseMeetingRecorderReturn extends RecorderState {
  startRecording: (stream: MediaStream) => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecorder: () => void;
}

// ── Human-readable permission error messages ──────────────────────────────────
const PERMISSION_MESSAGES: Record<RecordingPermissionError, string> = {
  NOT_ALLOWED:
    "Camera and microphone access was denied. Please click the camera icon in your browser's address bar and allow access, then try again.",
  NOT_FOUND:
    "No camera or microphone was found. Check that your device is connected and not disabled in system settings.",
  NOT_READABLE:
    "Your camera or microphone is already in use by another application. Close other video apps and try again.",
  OVERCONSTRAINED:
    "The requested camera/microphone settings are not supported by your device.",
  SECURITY:
    "Recording requires a secure context (HTTPS or localhost). Please access the app over HTTPS.",
  UNKNOWN:
    "An unexpected error occurred while accessing the camera or microphone. Please refresh and try again.",
};

export function useMeetingRecorder(): UseMeetingRecorderReturn {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    error: null,
    permissionError: null,
    hasPermission: null,
    supportedMimeType: "",
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const setPartialState = (partial: Partial<RecorderState>) => {
    setState(prev => ({ ...prev, ...partial }));
  };

  // ── Start Recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async (stream: MediaStream): Promise<boolean> => {
    // Clear any previous state
    chunksRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);

    const mimeType = getSupportedMimeType();

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 })
        : new MediaRecorder(stream);

      console.log("[Recorder] MediaRecorder created. MIME:", recorder.mimeType);
    } catch (err: any) {
      console.error("[Recorder] Failed to create MediaRecorder:", err);
      setPartialState({
        error: "Your browser does not support the required video recording format. Please try Chrome or Firefox.",
        isRecording: false,
      });
      return false;
    }

    // Collect chunks as they become available
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
        console.log("[Recorder] Chunk received:", formatBytes(event.data.size));
      }
    };

    // When recording stops, assemble the final blob and resolve the promise
    recorder.onstop = () => {
      const mimeUsed = recorder.mimeType || "video/webm";
      const finalBlob = new Blob(chunksRef.current, { type: mimeUsed });
      console.log("[Recorder] ✅ Recording complete. Final blob:", formatBytes(finalBlob.size), "MIME:", mimeUsed);

      if (resolveStopRef.current) {
        resolveStopRef.current(finalBlob);
        resolveStopRef.current = null;
      }
    };

    recorder.onerror = (event: Event) => {
      console.error("[Recorder] MediaRecorder error:", event);
      setPartialState({ error: "Recording error occurred. The video may be incomplete." });
    };

    // Start recording — collect a chunk every 5 seconds for progressive saving
    recorder.start(5000);
    mediaRecorderRef.current = recorder;

    // Start live duration timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setPartialState({ duration: Math.floor((Date.now() - startTime) / 1000) });
    }, 1000);

    setPartialState({
      isRecording: true,
      isPaused: false,
      duration: 0,
      error: null,
      permissionError: null,
      hasPermission: true,
      supportedMimeType: recorder.mimeType,
    });

    console.log("[Recorder] 🔴 Recording started.");
    return true;
  }, []);

  // ── Stop Recording ──────────────────────────────────────────────────────────
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        console.warn("[Recorder] stopRecording called but recorder is inactive.");
        resolve(null);
        return;
      }

      // Store the resolver so onstop can call it with the final blob
      resolveStopRef.current = resolve;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Request final chunk and stop
      recorder.requestData();
      recorder.stop();

      setPartialState({ isRecording: false, isPaused: false });
      console.log("[Recorder] ⏹ Stop requested.");
    });
  }, []);

  // ── Pause Recording ─────────────────────────────────────────────────────────
  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setPartialState({ isPaused: true });
      console.log("[Recorder] ⏸ Recording paused.");
    }
  }, []);

  // ── Resume Recording ────────────────────────────────────────────────────────
  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "paused") {
      recorder.resume();
      // Resume timer from current duration
      const resumeBase = state.duration;
      const resumeStart = Date.now();
      timerRef.current = setInterval(() => {
        setPartialState({
          duration: resumeBase + Math.floor((Date.now() - resumeStart) / 1000),
        });
      }, 1000);
      setPartialState({ isPaused: false });
      console.log("[Recorder] ▶ Recording resumed.");
    }
  }, [state.duration]);

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      error: null,
      permissionError: null,
      hasPermission: null,
      supportedMimeType: "",
    });
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecorder,
  };
}

// ── Permission Helper ─────────────────────────────────────────────────────────
/**
 * Request camera + microphone access and map all error types to friendly messages.
 * Returns the stream on success, or null with a populated error on failure.
 */
export async function requestMediaPermissions(
  videoConstraints: MediaTrackConstraints | boolean = true,
  audioConstraints: MediaTrackConstraints | boolean = true
): Promise<{
  stream: MediaStream | null;
  error: string | null;
  permissionError: RecordingPermissionError | null;
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: audioConstraints,
    });
    console.log("[Recorder] ✅ Media permissions granted.");
    return { stream, error: null, permissionError: null };
  } catch (err: any) {
    const name: string = err?.name || "Unknown";
    console.error("[Recorder] ❌ Media permission error:", name, err?.message);

    let permissionError: RecordingPermissionError = "UNKNOWN";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      permissionError = "NOT_ALLOWED";
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      permissionError = "NOT_FOUND";
    } else if (name === "NotReadableError" || name === "TrackStartError") {
      permissionError = "NOT_READABLE";
    } else if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      permissionError = "OVERCONSTRAINED";
    } else if (name === "SecurityError") {
      permissionError = "SECURITY";
    }

    return {
      stream: null,
      error: PERMISSION_MESSAGES[permissionError],
      permissionError,
    };
  }
}

// ── Audio-Only Fallback ───────────────────────────────────────────────────────
/**
 * If full video recording fails, fall back to audio-only recording.
 */
export async function requestAudioOnlyPermissions(): Promise<{
  stream: MediaStream | null;
  error: string | null;
  permissionError: RecordingPermissionError | null;
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    console.log("[Recorder] ✅ Audio-only permissions granted.");
    return { stream, error: null, permissionError: null };
  } catch (err: any) {
    return {
      stream: null,
      error: PERMISSION_MESSAGES["NOT_ALLOWED"],
      permissionError: "NOT_ALLOWED",
    };
  }
}

// ── Internal Utility ─────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
