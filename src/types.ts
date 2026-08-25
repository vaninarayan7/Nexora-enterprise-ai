export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  modelUsed?: string;
  status?: "sending" | "success" | "error";
  citations?: RAGCitation[];
  isBookmarked?: boolean;
  rating?: "up" | "down" | null;
  // Advanced LLM & RAG metadata fields
  expandedQueries?: string[];
  groundingScore?: number; // percentage (0 - 100)
  relevanceScore?: number; // percentage (0 - 100)
  evaluationReport?: string; // markdown explanation of the audit check
  originalTokenCount?: number;
  compressedTokenCount?: number;
  organizationId?: string;
}

export interface RAGCitation {
  docId: string;
  docName: string;
  chunkIndex: number;
  text: string;
  score: number;
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  size: string;
  type: string;
  content: string;
  addedAt: string;
  status?: "uploading" | "processing" | "indexing" | "indexed" | "failed";
  chunksCount?: number;
  errorMessage?: string;
  organizationId?: string;
}

export interface WorkspacePersona {
  id: string;
  name: string;
  iconName: string;
  description: string;
  systemPrompt: string;
  accentClass: string;
  badgeText: string;
}

export interface WorkspaceSettings {
  systemInstruction: string;
  modelName: string;
  temperature: number;
  activePersonaId: string;
  maxTokens: number;
  activeThemeId?: string;
  enableQueryExpansion?: boolean;
  enableGroundingEvaluation?: boolean;
  enablePromptCompression?: boolean;
  language?: "en" | "te" | "hi";
  enableSoundNotifications?: boolean;
  enableEmailAlerts?: boolean;
  enableWorkspaceAlerts?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
  organizationId?: string;
}

export interface AnalyticsMetric {
  date: string;
  conversations: number;
  tokenCount: number;
  responseTimeMs: number;
  userRating: number;
  ragQueries: number;
}

export type UserRole = "Super Admin" | "Admin" | "Organizer" | "Manager" | "Employee";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  token?: string;
  organizationId?: string;
  organizationName?: string;
  status?: string;
  onboardingCompleted?: boolean;
}

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  timestamp: string;
  status: "success" | "failed" | "pending";
  error?: string;
  type: "summary" | "alert" | "report";
  organizationId?: string;
}

export interface AdminSystemStatus {
  cpuUsage: number;
  memoryUsage: number;
  vectorCount: number;
  documentCount: number;
  emailsSent: number;
  apiLatency: number;
}

export interface SmartNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert";
  timestamp: string;
  isRead: boolean;
  organizationId?: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  category: string;
  prompt: string;
  description: string;
  isBuiltIn?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  ownerId: string;
  status: "active" | "suspended";
  subscriptionPlan?: string;
}

export interface Invitation {
  id: string;
  organizationId: string;
  inviterId: string;
  email: string;
  role: "Manager" | "Employee";
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  managerId: string;
  members: string[]; // array of user IDs
  createdAt: string;
}
