// ── Meeting Recording — IndexedDB Storage Layer ───────────────────────────────
// Video recordings are stored in IndexedDB (NOT Firestore / localStorage) because:
//   - Firestore has a 1 MB document limit — not viable for video blobs
//   - localStorage is limited to ~5 MB and cannot store binary data
//   - IndexedDB stores binary Blobs natively, is persistent across refresh/logout,
//     and supports files up to the available disk space.

const DB_NAME = "nexora_meeting_recordings";
const DB_VERSION = 1;
const STORE_NAME = "recordings";

// ── Data Types ────────────────────────────────────────────────────────────────

export interface DbMeetingRecording {
  id: string;               // UUID for this recording
  meetingId: string;        // Nexora meeting ID (or generated for calendar meetings)
  title: string;
  blob: Blob;               // The actual video blob (WebM / MP4)
  mimeType: string;         // e.g. "video/webm;codecs=vp9,opus"
  durationSeconds: number;  // Total recording duration in seconds
  recordedAt: string;       // ISO timestamp of when recording was saved
  sizeBytes: number;        // Blob size for display
  participants: string[];   // Attendee names
  transcript: { speaker: string; text: string; time: string }[];
  summary: string;
  decisions: string[];
  actionItems: { text: string; owner: string; dueDate: string }[];
  insights?: string[];
  ownerId: string;          // User UID who recorded
  ownerName: string;
}

// ── DB Lifecycle ──────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("ownerId", "ownerId", { unique: false });
        store.createIndex("meetingId", "meetingId", { unique: false });
        store.createIndex("recordedAt", "recordedAt", { unique: false });
        console.log("[RecordingDB] Object store created.");
      }
    };

    req.onsuccess = () => {
      console.log("[RecordingDB] ✅ Database opened.");
      resolve(req.result);
    };

    req.onerror = () => {
      console.error("[RecordingDB] ❌ Failed to open database:", req.error);
      reject(req.error);
    };
  });
}

// ── CRUD Operations ───────────────────────────────────────────────────────────

/**
 * Save a completed recording (blob + metadata) to IndexedDB.
 * The blob is stored as-is — no encoding needed.
 */
export async function saveRecording(recording: DbMeetingRecording): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(recording);
    req.onsuccess = () => {
      console.log("[RecordingDB] Recording saved:", recording.id, `(${formatBytes(recording.sizeBytes)})`);
      resolve();
    };
    req.onerror = () => {
      console.error("[RecordingDB] Save failed:", req.error);
      reject(req.error);
    };
  });
}

/**
 * Retrieve all recordings, sorted newest-first.
 * Blobs are included — callers should create object URLs as needed.
 */
export async function getAllRecordings(): Promise<DbMeetingRecording[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result as DbMeetingRecording[]).sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      );
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve a single recording by its ID.
 */
export async function getRecording(id: string): Promise<DbMeetingRecording | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as DbMeetingRecording) || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a recording by ID (frees up disk space).
 */
export async function deleteRecording(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => {
      console.log("[RecordingDB] Recording deleted:", id);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Create a temporary object URL for playback or download.
 * IMPORTANT: Callers must call URL.revokeObjectURL(url) when done to free memory.
 */
export async function createRecordingObjectURL(id: string): Promise<string | null> {
  const recording = await getRecording(id);
  if (!recording) return null;
  return URL.createObjectURL(recording.blob);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRecordingDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Choose the best supported MIME type for this browser.
 * Falls back gracefully: VP9+Opus → VP8+Opus → plain WebM.
 */
export function getSupportedMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log("[RecordingDB] Selected codec:", type);
      return type;
    }
  }
  console.warn("[RecordingDB] No preferred codec supported — using browser default.");
  return "";
}
