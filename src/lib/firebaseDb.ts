import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc as fbSetDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  addDoc as fbAddDoc, 
  onSnapshot,
  limit
} from "firebase/firestore";
// Import shared singleton — no initializeApp() here (breaks circular dep)
import { db, auth } from "./firebase.ts";
import { UserRole } from "../types";
export { db };

// ----------------------------------------------------------------------
// Firestore Data Sanitization Helper
// ----------------------------------------------------------------------
const sanitizeForFirestore = <T>(data: T): T => {
  if (data === undefined || data === null) return data;
  // Removes undefined fields, functions, and non-serializable properties
  return JSON.parse(JSON.stringify(data));
};

// Wrapper for setDoc to automatically sanitize data
const setDoc = (reference: any, data: any, options?: any) => {
  return fbSetDoc(reference, sanitizeForFirestore(data), options);
};

// Wrapper for addDoc to automatically sanitize data
const addDoc = (reference: any, data: any) => {
  return fbAddDoc(reference, sanitizeForFirestore(data));
};

// ----------------------------------------------------------------------
// Firestore Error Handlers (MANDATORY per firebase-integration guidelines)
// ----------------------------------------------------------------------

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;
export type OperationType = typeof OperationType[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(`Firestore operation failed on path: [${path || "unknown"}]. Details: ${errInfo.error}`);
}

// Passive connection test — does NOT force a server fetch on startup.
// Uses the regular cache-aware getDocs so it never throws "client is offline".
export async function testConnection(): Promise<boolean> {
  try {
    await getDocs(collection(db, "_health_check_"));
    console.log("[Firestore] ✅ Connection ready.");
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Permission-denied means Firestore IS reachable (rules just block the probe doc)
    if (msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
      console.log("[Firestore] ✅ Connection ready (permission-denied on probe — expected).");
      return true;
    }
    console.warn("[Firestore] ⚠️ Could not reach Firestore:", msg);
    return false;
  }
}
// Run passively after a short delay so it doesn't block auth initialization
setTimeout(() => testConnection(), 2000);

// ----------------------------------------------------------------------
// 1. User Profiles & Role-Based Access Controls
// ----------------------------------------------------------------------

export interface DbUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
  organizationId?: string;
  organizationName?: string;
  joinedAt?: string;
  status?: string;
  onboardingCompleted?: boolean;
}

export async function saveUserProfile(profile: DbUserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    const docRef = doc(db, "users", profile.uid);
    const now = new Date().toISOString();
    await setDoc(docRef, {
      ...profile,
      createdAt: profile.createdAt || now,
      updatedAt: now
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getUserProfile(uid: string): Promise<DbUserProfile | null> {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, "users", uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DbUserProfile;
    }
    return null;
  } catch (err) {
    console.warn(`[Firestore] Failed to get user profile for ${uid}. Proceeding as if it doesn't exist. Error:`, err);
    return null;
  }
}

export async function getAllUserProfiles(organizationId?: string): Promise<DbUserProfile[]> {
  const collectionName = "users";
  console.log(`[FirestoreData] Current organizationId:`, organizationId || "ALL (Global)");
  console.log(`[FirestoreData] Collection name:`, collectionName);

  try {
    let snap;
    let queryDesc = "";
    if (organizationId) {
      const q = query(collection(db, collectionName), where("organizationId", "==", organizationId));
      queryDesc = `where("organizationId", "==", "${organizationId}")`;
      console.log(`[FirestoreData] Query executed: ${queryDesc}`);
      snap = await getDocs(q);
    } else {
      queryDesc = `collection("${collectionName}") (All Documents)`;
      console.log(`[FirestoreData] Query executed: ${queryDesc}`);
      snap = await getDocs(collection(db, collectionName));
    }

    console.log(`[FirestoreData] Number of documents returned:`, snap.docs.length);

    if (!snap || snap.empty) {
      return [];
    }

    const validUsers: DbUserProfile[] = [];

    snap.docs.forEach(d => {
      const data = d.data();
      const user = {
        uid: data.uid || d.id,
        organizationId: data.organizationId || organizationId || "global",
        role: data.role || "Employee",
        email: data.email || "",
        displayName: data.displayName || "Member",
        status: data.status || "active",
        createdAt: data.createdAt || new Date().toISOString(),
        joinedAt: data.joinedAt || data.createdAt || new Date().toISOString(),
        ...data
      } as DbUserProfile;

      // Removed hardcoded email check that was resetting organizationId

      // Only include users that are actually in this organization
      if (!organizationId || user.organizationId === organizationId) {
        validUsers.push(user);
      }
    });

    return validUsers;
  } catch (err: any) {
    console.error(`[FirestoreData] Firestore errors in getAllUserProfiles:`, err);
    return [];
  }
}

// Update only a user's role (Admin action — targeted merge, no full overwrite)
export async function updateUserRole(
  uid: string,
  role: UserRole
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, "users", uid), { role, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Update user status (ACTIVE | SUSPENDED | PENDING | DISABLED)
export async function updateUserStatus(
  uid: string,
  status: "ACTIVE" | "SUSPENDED" | "PENDING" | "DISABLED" | string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, "users", uid), { status, updatedAt: new Date().toISOString() }, { merge: true });
    console.log(`[Firestore] Updated user status for ${uid} -> ${status}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function permanentlyDeleteUser(
  uid: string,
  email: string,
  organizationId: string
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    // 1. Delete user profile document
    await deleteDoc(doc(db, "users", uid));
    console.log(`[FirestoreDelete] Deleted user profile for ${uid}`);

    // 2. Delete invitations matching email
    const invQ = query(collection(db, "invitations"), where("email", "==", email));
    const invSnap = await getDocs(invQ);
    for (const d of invSnap.docs) {
      await deleteDoc(doc(db, "invitations", d.id));
      console.log(`[FirestoreDelete] Deleted invitation ${d.id} for ${email}`);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export interface DbOrganization {
  organizationId: string;
  organizationName: string;
  orgCode: string;
  ownerUid: string;
  ownerEmail: string;
  status: string;
  createdAt: string;
}

export async function getOrganization(orgId: string): Promise<DbOrganization | null> {
  const path = `organizations/${orgId}`;
  try {
    const docRef = doc(db, "organizations", orgId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DbOrganization;
    }
    return null;
  } catch (err: any) {
    console.warn(`[Firestore] Failed to get organization for ${orgId}. Error:`, err);
    // If it's a permission denied error, the organization likely exists but is restricted.
    // Return a stub to prevent false "deleted" assumptions that revoke memberships.
    if (err.code === "permission-denied" || err.message?.toLowerCase().includes("permission")) {
      return { organizationId: orgId, organizationName: "Restricted Workspace", status: "active" } as DbOrganization;
    }
    return null;
  }
}

export async function getAllOrganizations(): Promise<DbOrganization[]> {
  const path = "organizations";
  try {
    const snap = await getDocs(collection(db, "organizations"));
    return snap.docs.map(d => d.data() as DbOrganization);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

export async function saveOrganization(org: DbOrganization): Promise<void> {
  const path = `organizations/${org.organizationId}`;
  try {
    await setDoc(doc(db, "organizations", org.organizationId), org, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export interface DbInvitation {
  id: string;
  organizationId: string;
  inviterId: string;
  createdBy?: string;
  email: string;
  role: "Manager" | "Employee" | string;
  token: string;
  status?: "pending" | "accepted" | "revoked" | "expired" | string;
  createdAt: string;
  expiresAt: string;
}

export async function saveInvitation(inv: DbInvitation): Promise<void> {
  const path = `invitations/${inv.id}`;
  try {
    console.group(`[saveInvitation DEBUG]`);
    console.log(`  - Target Path: ${path}`);
    console.log(`  - Generated Token Field: "${inv.token}"`);
    console.log(`  - Full Generated Document:`, JSON.stringify(inv, null, 2));
    
    const docRef = doc(db, "invitations", inv.id);
    await setDoc(docRef, {
      ...inv,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log(`  ✅ Successfully saved to Firestore!`);
    console.groupEnd();
  } catch (err) {
    console.error(`[FirestoreError] Failed to save invitation at ${path}:`, err);
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export interface DbAdminRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export async function requestAdminAccess(user: { uid: string; email: string; displayName: string; organizationId: string; organizationName: string }): Promise<void> {
  const reqId = `admin-req-${user.uid}`;
  const reqDoc: DbAdminRequest = {
    id: reqId,
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    status: "pending",
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, "admin_requests", reqId), reqDoc, { merge: true });
}

export async function getAdminRequests(): Promise<DbAdminRequest[]> {
  const snap = await getDocs(collection(db, "admin_requests"));
  return snap.docs.map(d => d.data() as DbAdminRequest);
}

export async function approveAdminRequest(requestId: string, uid: string): Promise<void> {
  await setDoc(doc(db, "admin_requests", requestId), { status: "approved" }, { merge: true });
  await setDoc(doc(db, "users", uid), { role: "Admin", updatedAt: new Date().toISOString() }, { merge: true });
}

export async function rejectAdminRequest(requestId: string): Promise<void> {
  await setDoc(doc(db, "admin_requests", requestId), { status: "rejected" }, { merge: true });
}

export async function getInvitations(organizationId: string): Promise<DbInvitation[]> {
  const path = "invitations";
  try {
    const q = query(collection(db, "invitations"), where("organizationId", "==", organizationId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbInvitation);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

export async function permanentlyDeleteInvitation(invId: string): Promise<void> {
  const path = `invitations/${invId}`;
  try {
    await deleteDoc(doc(db, "invitations", invId));
    console.log(`[FirestoreDelete] Permanently deleted invitation ${invId}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function getInvitationByToken(token: string): Promise<DbInvitation | null> {
  const path = `invitations/${token}`;
  try {
    console.log(`[getInvitationByToken DEBUG] Fetching invitation by Document ID: "${token}"`);
    const docRef = doc(db, "invitations", token);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      console.log(`[getInvitationByToken DEBUG] Found matching invitation:`, snap.data());
      return snap.data() as DbInvitation;
    }

    console.warn(`[getInvitationByToken DEBUG] Invitation with ID (token) "${token}" not found!`);
    return null;
  } catch (err) {
    console.warn(`[Firestore] Failed to get invitation for token. Error:`, err);
    return null;
  }
}



// ----------------------------------------------------------------------
// 2. Knowledge Documents (RAG)
// ----------------------------------------------------------------------

export interface DbKnowledgeDoc {
  id: string;
  name: string;
  type: string;
  size: string;
  content: string;
  summary?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveDocument(docData: DbKnowledgeDoc): Promise<void> {
  const path = `documents/${docData.id}`;
  try {
    await setDoc(doc(db, "documents", docData.id), docData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getDocuments(organizationId: string): Promise<DbKnowledgeDoc[]> {
  const path = "documents";
  try {
    const q = query(collection(db, "documents"), where("organizationId", "==", organizationId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbKnowledgeDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function deleteDocumentDb(id: string): Promise<void> {
  const path = `documents/${id}`;
  try {
    await deleteDoc(doc(db, "documents", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ----------------------------------------------------------------------
// 3. Conversations & Chat History
// ----------------------------------------------------------------------

export interface DbConversation {
  id: string;
  title: string;
  userId: string;
  personaId: string;
  modelName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export async function saveConversation(conv: DbConversation): Promise<void> {
  const path = `conversations/${conv.id}`;
  try {
    await setDoc(doc(db, "conversations", conv.id), conv, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getConversations(userId: string, organizationId: string): Promise<DbConversation[]> {
  const path = "conversations";
  try {
    const q = query(collection(db, "conversations"), where("userId", "==", userId), where("organizationId", "==", organizationId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbConversation);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function deleteConversationDb(convId: string): Promise<void> {
  const path = `conversations/${convId}`;
  try {
    await deleteDoc(doc(db, "conversations", convId));
    // Subcollection deletion is usually handled client-side or recursively. 
    // We will delete messages manually or just let them stand.
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveChatMessage(msg: DbChatMessage): Promise<void> {
  const path = `conversations/${msg.conversationId}/messages/${msg.id}`;
  try {
    await setDoc(doc(db, "conversations", msg.conversationId, "messages", msg.id), msg);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getChatMessages(conversationId: string): Promise<DbChatMessage[]> {
  const path = `conversations/${conversationId}/messages`;
  try {
    const q = query(collection(db, "conversations", conversationId, "messages"), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbChatMessage);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// ----------------------------------------------------------------------
// 4. Kanban Board Tasks & Collaboration
// ----------------------------------------------------------------------

export interface DbKanbanTask {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "in_review" | "done";
  priority: "low" | "medium" | "high";
  assigneeId?: string;
  assigneeName?: string;
  creatorId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbTaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface DbTaskAttachment {
  id: string;
  taskId: string;
  name: string;
  url: string;
  uploadedBy: string;
  createdAt: string;
}

export async function saveTask(task: DbKanbanTask): Promise<void> {
  const path = `tasks/${task.id}`;
  try {
    await setDoc(doc(db, "tasks", task.id), task, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getTasks(organizationId: string): Promise<DbKanbanTask[]> {
  const path = "tasks";
  try {
    const q = query(collection(db, "tasks"), where("organizationId", "==", organizationId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbKanbanTask);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function deleteTaskDb(id: string): Promise<void> {
  const path = `tasks/${id}`;
  try {
    await deleteDoc(doc(db, "tasks", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveTaskComment(comment: DbTaskComment): Promise<void> {
  const path = `tasks/${comment.taskId}/comments/${comment.id}`;
  try {
    await setDoc(doc(db, "tasks", comment.taskId, "comments", comment.id), comment);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getTaskComments(taskId: string): Promise<DbTaskComment[]> {
  const path = `tasks/${taskId}/comments`;
  try {
    const q = query(collection(db, "tasks", taskId, "comments"), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbTaskComment);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveTaskAttachment(attach: DbTaskAttachment): Promise<void> {
  const path = `tasks/${attach.taskId}/attachments/${attach.id}`;
  try {
    await setDoc(doc(db, "tasks", attach.taskId, "attachments", attach.id), attach);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getTaskAttachments(taskId: string): Promise<DbTaskAttachment[]> {
  const path = `tasks/${taskId}/attachments`;
  try {
    const snap = await getDocs(collection(db, "tasks", taskId, "attachments"));
    return snap.docs.map(d => d.data() as DbTaskAttachment);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// ----------------------------------------------------------------------
// 5. Meetings & Audio Transcripts
// ----------------------------------------------------------------------

export interface DbMeeting {
  id: string;
  title: string;
  organizer: string;
  ownerId: string;
  time: string;
  duration: string;
  participants: string[];
  status: "upcoming" | "live" | "completed";
  summary?: string;
  notes?: string;
  decisions?: string[];
  actionItems?: { text: string; owner: string; dueDate: string }[];
  insights?: string[];
  // Recording metadata (actual blob stored in IndexedDB, keyed by recordingId)
  recordingId?: string;
  hasRecording?: boolean;
  createdAt: string;
}

export interface DbMeetingTranscript {
  id: string;
  meetingId: string;
  speaker: string;
  text: string;
  time: string;
  createdAt: string;
}

export async function saveMeeting(meeting: DbMeeting): Promise<void> {
  const path = `meetings/${meeting.id}`;
  try {
    await setDoc(doc(db, "meetings", meeting.id), meeting, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getMeetings(organizationId: string): Promise<DbMeeting[]> {
  const path = "meetings";
  try {
    const q = query(collection(db, "meetings"), where("organizationId", "==", organizationId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbMeeting);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveMeetingTranscript(segment: DbMeetingTranscript): Promise<void> {
  const path = `meetings/${segment.meetingId}/transcripts/${segment.id}`;
  try {
    await setDoc(doc(db, "meetings", segment.meetingId, "transcripts", segment.id), segment);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getMeetingTranscripts(meetingId: string): Promise<DbMeetingTranscript[]> {
  const path = `meetings/${meetingId}/transcripts`;
  try {
    const q = query(collection(db, "meetings", meetingId, "transcripts"), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbMeetingTranscript);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// ----------------------------------------------------------------------
// 6. Automated Emails History + Email Assistant
// ----------------------------------------------------------------------

export interface DbEmailRecord {
  id: string;
  // Multi-recipient (new) — backwards-compatible with old single "recipient"
  to: string[];
  cc?: string[];
  bcc?: string[];
  recipient?: string;         // legacy field kept for old automation emails
  subject: string;
  body: string;
  timestamp: string;
  status: "sent" | "draft" | "failed" | "pending" | "success";
  type: "manual" | "ai_draft" | "template" | "summary" | "alert" | "report";
  attachedDocIds?: string[];
  templateName?: string;
  aiPromptUsed?: string;
  error?: string;
  userId?: string;
  organizationId?: string;
}

export async function saveEmailRecord(email: DbEmailRecord): Promise<void> {
  const path = `emails/${email.id}`;
  try {
    console.log(`[Email] Saving record id=${email.id} status=${email.status} userId=${email.userId}`);
    await setDoc(doc(db, "emails", email.id), email);
    console.log(`[Email] ✅ Record saved: ${path}`);
  } catch (err) {
    console.error(`[Email] ❌ Failed to save email record at ${path}:`, err);
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getEmailRecords(userId: string | undefined, organizationId: string): Promise<DbEmailRecord[]> {
  const path = "emails";
  try {
    let qConstraints: any[] = [where("organizationId", "==", organizationId), orderBy("timestamp", "desc")];
    if (userId) {
      qConstraints.unshift(where("userId", "==", userId));
    }
    const q = query(collection(db, "emails"), ...qConstraints);
    const snap = await getDocs(q);
    const records = snap.docs.map(d => d.data() as DbEmailRecord);
    console.log(`[Email] getEmailRecords: fetched ${records.length} records`);
    return records;
  } catch (err) {
    console.error(`[Email] ❌ Failed to fetch email records:`, err);
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

export async function getEmailDrafts(userId: string, organizationId: string): Promise<DbEmailRecord[]> {
  const path = "emails";
  try {
    const q = query(
      collection(db, "emails"),
      where("userId", "==", userId),
      where("organizationId", "==", organizationId),
      where("status", "==", "draft"),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    const drafts = snap.docs.map(d => d.data() as DbEmailRecord);
    console.log(`[Email] getEmailDrafts: fetched ${drafts.length} drafts for userId=${userId}`);
    return drafts;
  } catch (err) {
    console.error(`[Email] ❌ Failed to fetch email drafts:`, err);
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

// ── Dedicated Drafts Collection ───────────────────────────────────────────────
// Uses "drafts" collection — completely separate from the legacy "emails" collection.

export async function saveDraft(draft: DbEmailRecord, organizationId?: string): Promise<void> {
  const path = `drafts/${draft.id}`;
  try {
    // Dual write to both collections for transition
    const draftData = { ...draft, status: "draft", organizationId };
    await Promise.all([
      setDoc(doc(db, "drafts", draft.id), draftData, { merge: true }),
      setDoc(doc(db, "emails", draft.id), draftData, { merge: true })
    ]);
    console.log(`[Draft] ✅ Draft saved to Firestore: ${path}`);
  } catch (err) {
    console.error(`[Draft] ❌ Firestore write FAILED at ${path}:`, err);
    throw err;
  }
}

// Retrieve drafts with detailed logging
export async function getDrafts(userId: string, organizationId: string): Promise<DbEmailRecord[]> {
  try {
    const qConstraints: any[] = [where("userId", "==", userId), orderBy("timestamp", "desc")];
    if (organizationId) qConstraints.push(where("organizationId", "==", organizationId));
    const q = query(collection(db, "drafts"), ...qConstraints);
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs.map(d => d.data() as DbEmailRecord);
    // Fallback to legacy
    return await getEmailDrafts(userId, organizationId);
  } catch (err) {
    return await getEmailDrafts(userId, organizationId);
  }
}

export async function deleteDraftDb(id: string): Promise<void> {
  const path = `drafts/${id}`;
  try {
    await deleteDoc(doc(db, "drafts", id));
    console.log(`[Draft] ✅ Draft deleted: ${path}`);
  } catch (err) {
    console.error(`[Draft] ❌ deleteDraft FAILED at ${path}:`, JSON.stringify(err));
    throw err;
  }
}

// ── Dedicated Sent Emails Collection ─────────────────────────────────────────
// Uses "sentEmails" collection — written only after a confirmed Gmail API success.

export async function saveSentEmail(email: DbEmailRecord, organizationId?: string): Promise<void> {
  const path = `sentEmails/${email.id}`;
  console.log(`[SentEmail] 📋 prepare to save sent email`, { id: email.id, userId: email.userId, to: email.to });
  try {
    const emailData = { ...email, status: "sent", organizationId };
    // Primary write to dedicated collection and legacy for compatibility
    await Promise.all([
      setDoc(doc(db, "sentEmails", email.id), emailData, { merge: true }),
      setDoc(doc(db, "emails", email.id), emailData, { merge: true })
    ]);
    console.log(`[SentEmail] ✅ Sent email saved to Firestore: ${path}`);
  } catch (err) {
    console.error(`[SentEmail] ❌ Firestore write FAILED at ${path}:`, err);
    throw err;
  }
}

export async function getSentEmails(userId: string, organizationId?: string): Promise<DbEmailRecord[]> {
  try {
    // Try dedicated collection first
    const qConstraints: any[] = [where("userId", "==", userId), orderBy("timestamp", "desc")];
    if (organizationId) qConstraints.push(where("organizationId", "==", organizationId));
    const q = query(collection(db, "sentEmails"), ...qConstraints);
    const snap = await getDocs(q);
    if (!snap.empty) {
      console.log(`[SentEmail] 📥 fetched ${snap.docs.length} docs from 'sentEmails' for userId=${userId}`);
      return snap.docs.map(d => d.data() as DbEmailRecord);
    }
  } catch (err) {
    console.error(`[SentEmail] ❌ Error reading from 'sentEmails' collection:`, err);
  }
  // Fallback to legacy emails collection where status is sent
  try {
    const q2 = query(collection(db, "emails"), where("userId", "==", userId), where("status", "==", "sent"), orderBy("timestamp", "desc"));
    const snap2 = await getDocs(q2);
    console.log(`[SentEmail] 📥 fallback fetched ${snap2.docs.length} docs from 'emails' collection for userId=${userId}`);
    return snap2.docs.map(d => d.data() as DbEmailRecord);
  } catch (fallbackErr) {
    console.error(`[SentEmail] ❌ Fallback error reading sent emails:`, fallbackErr);
    return [];
  }
}
// ── Email Templates ───────────────────────────────────────────────────────────

export interface DbEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  createdAt: string;
  userId?: string;
}

export async function saveEmailTemplate(tpl: DbEmailTemplate): Promise<void> {
  const path = `email_templates/${tpl.id}`;
  try {
    await setDoc(doc(db, "email_templates", tpl.id), tpl);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getEmailTemplates(userId: string, organizationId: string): Promise<DbEmailTemplate[]> {
  const path = "email_templates";
  try {
    const q = query(
      collection(db, "email_templates"),
      where("organizationId", "==", organizationId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbEmailTemplate);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const path = `email_templates/${id}`;
  try {
    await deleteDoc(doc(db, "email_templates", id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}


// ----------------------------------------------------------------------
// 7. Smart Notifications
// ----------------------------------------------------------------------

export interface DbSmartNotification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type: "success" | "info" | "alert";
  timestamp: string;
  isRead: boolean;
}

export async function saveNotification(notif: DbSmartNotification): Promise<void> {
  const path = `notifications/${notif.id}`;
  try {
    await setDoc(doc(db, "notifications", notif.id), notif, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getNotifications(userId: string | undefined, organizationId: string): Promise<DbSmartNotification[]> {
  const path = "notifications";
  try {
    let qConstraints: any[] = [where("organizationId", "==", organizationId), orderBy("timestamp", "desc")];
    if (userId) {
      qConstraints.unshift(where("userId", "==", userId));
    }
    const q = query(collection(db, "notifications"), ...qConstraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbSmartNotification);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// ----------------------------------------------------------------------
// 8. Immutable System Audit Logs
// ----------------------------------------------------------------------

export interface DbAuditLog {
  id?: string;
  userId?: string;
  organizationId?: string;
  actor?: { name: string; email: string; role: string };
  action: string;
  category?: string;
  status?: string;
  details: string;
  timestamp?: string;
}

export async function saveAuditLog(log: DbAuditLog): Promise<void> {
  const finalId = log.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const finalLog = { ...log, id: finalId, timestamp: log.timestamp || new Date().toISOString() };
  const path = `audit_logs/${finalId}`;
  try {
    await setDoc(doc(db, "audit_logs", finalId), finalLog);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getAuditLogs(organizationId: string): Promise<DbAuditLog[]> {
  const path = "audit_logs";
  try {
    const q = query(collection(db, "audit_logs"), where("organizationId", "==", organizationId), orderBy("timestamp", "desc"), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DbAuditLog);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}
