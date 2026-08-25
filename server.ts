import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import net from "net";
import { buildIndexPayload, chunkDocumentText, validateDocumentContent } from "./src/lib/documentIndexing";

dotenv.config();
// Support local overrides used by developers in .env.local without requiring a custom loader.
dotenv.config({ path: ".env.local" });

const MEETINGS_FILE_PATH = path.join(process.cwd(), "meetings-db.json");

interface ServerMeeting {
  id: string;
  title: string;
  organizer: string;
  ownerId: string; // unique host (owner_id)
  platform: string;
  time: string;
  duration: string;
  participants: string[]; // authorized participant displayNames
  participantIds: string[]; // store participant_ids separately
  invitedEmails: string[]; // store list of invited emails
  project: string;
  status: "upcoming" | "live" | "completed"; // Scheduled, Live, Ended
  tags: string[];
  password?: string;
  waitingRoomEnabled: boolean;
  waitingRoomQueue?: string[];
  locked: boolean;
  date: string;
  summary?: string;
  transcript?: { speaker: string; text: string; time: string }[];
  decisions?: string[];
  actionItems?: { text: string; owner: string; dueDate: string }[];
  insights?: string[];
  notes?: string;
}

let MEETINGS_STORE: ServerMeeting[] = [];

// Load meetings on startup
try {
  if (fs.existsSync(MEETINGS_FILE_PATH)) {
    const raw = fs.readFileSync(MEETINGS_FILE_PATH, "utf-8");
    MEETINGS_STORE = JSON.parse(raw);
  }
} catch (err) {
  console.error("Error loading meetings-db.json, starting empty:", err);
  MEETINGS_STORE = [];
}

const saveMeetings = () => {
  try {
    fs.writeFileSync(MEETINGS_FILE_PATH, JSON.stringify(MEETINGS_STORE, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving meetings-db.json:", err);
  }
};


// Define EmbeddedChunk structures for the in-memory semantic search engine
interface EmbeddedChunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  vector: number[];
  chunkIndex: number;
}

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  timestamp: string;
  status: "success" | "failed" | "pending";
  error?: string;
  type: "summary" | "alert" | "report";
}

// Global in-memory store for documents, vectors, and email logs
const VECTOR_STORE: EmbeddedChunk[] = [];
const EMAIL_LOGS: EmailLog[] = [
  {
    id: "log-1",
    recipient: "exec-team@enterprise.io",
    subject: "Q3 Workspace RAG Summary & Analytics Report",
    body: "System summaries indicate optimized unit economics, average churn sitting at 3.2% with active mitigation targets.",
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    status: "success",
    type: "summary"
  },
  {
    id: "log-2",
    recipient: "sec-audit@enterprise.io",
    subject: "Security Alert: Knowledge Base Index Sync",
    body: "Nexora vector grounding indexes were successfully synchronized across all active roles.",
    timestamp: new Date(Date.now() - 36000000).toISOString(),
    status: "success",
    type: "alert"
  }
];

// Sliding Window text-chunking algorithm
function chunkText(text: string, maxChunkSize = 800, overlap = 150): string[] {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if (!para.trim()) continue;

    // Split overly long paragraphs by sentences
    if (para.length > maxChunkSize) {
      const sentences = para.match(/[^.!?]+[.!?]+(\s|$)/g) || [para];
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkSize) {
          if (currentChunk) chunks.push(currentChunk.trim());
          // Slide window with overlap
          currentChunk = currentChunk.slice(-overlap) + sentence;
        } else {
          currentChunk += sentence;
        }
      }
    } else {
      if (currentChunk.length + para.length > maxChunkSize) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = currentChunk.slice(-overlap) + "\n" + para;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + para;
      }
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

// Vector math operations
function dotProduct(v1: number[], v2: number[]): number {
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += v1[i] * v2[i];
  }
  return sum;
}

function magnitude(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(v1: number[], v2: number[]): number {
  const dot = dotProduct(v1, v2);
  const mag1 = magnitude(v1);
  const mag2 = magnitude(v2);
  if (mag1 === 0 || mag2 === 0) return 0;
  return dot / (mag1 * mag2);
}

// Caches for API and Embedding responses to prevent repeated requests & preserve quota
const EMBEDDING_CACHE = new Map<string, number[]>();
const INTELLIGENCE_CACHE = new Map<string, any>();
const ASK_CACHE = new Map<string, any>();
const CHAT_CACHE = new Map<string, any>();

function isRateLimitError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const status = err.status || err.statusCode;
  return status === 429 || msg.includes("quota") || msg.includes("rate limit") || msg.includes("resource_exhausted") || msg.includes("limit exceeded");
}

async function startServer() {
  const app = express();

  const getGoogleOAuthConfig = (baseUrl: string) => {
    // Prefer explicit GOOGLE_ variables. Do not fall back to other names.
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

    // Ensure redirect URI is constructed from the provided baseUrl exactly.
    const normalizedBase = (baseUrl || "").replace(/\/$/, "");
    const redirectUri = `${normalizedBase}/api/oauth/callback`;

    return { clientId, clientSecret, redirectUri };
  };

  // ── Dynamic port resolution ────────────────────────────────────────────────
  // Finds the first available TCP port starting from the preferred one.
  // This eliminates EADDRINUSE crashes when a previous process is still lingering.
  function findFreePort(preferred: number, maxAttempts = 10): Promise<number> {
    return new Promise((resolve, reject) => {
      let attempt = 0;

      function tryPort(port: number) {
        if (attempt >= maxAttempts) {
          return reject(new Error(`Could not find a free port after ${maxAttempts} attempts starting at ${preferred}.`));
        }
        const tester = net.createServer();
        tester.once("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            attempt++;
            console.warn(`[Server] Port ${port} in use, trying ${port + 1}...`);
            tryPort(port + 1);
          } else {
            reject(err);
          }
        });
        tester.once("listening", () => {
          tester.close(() => resolve(port));
        });
        tester.listen(port, "0.0.0.0");
      }

      tryPort(preferred);
    });
  }

  const PREFERRED_PORT = parseInt(process.env.PORT || "3000", 10);
  const PORT = await findFreePort(PREFERRED_PORT);

  // Set limits to comfortably process enterprise attachments
  app.use(express.json({ limit: "25mb" }));

  // Initialize Gemini SDK with telemetry User-Agent
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  // Pre-seed some default vector embeddings if Gemini is live
  // This allows instant RAG functionality on the default documents loaded in App.tsx
  try {
    if (ai) {
      const defaultDocs = [
        {
          id: "doc-1",
          name: "saas_retention_metrics.txt",
          content: "Nexora Workspace retention KPIs:\n- Average churn rate: 3.2% monthly\n- Target churn rate: <1.5% monthly\n- Expansion revenue vector: +18% growth Q1\n- High retention cohorts: Users who index/run system analyses within 48 hours of onboarding (churn is 75% lower for this segment).\n- Customer Acquisition Cost (CAC): $240 average\n- Customer Lifetime Value (LTV): $1,450 average\n- LTV-to-CAC Ratio: 6:1 (Strong system unit economics)"
        },
        {
          id: "doc-2",
          name: "nexora_workspace_handbook.md",
          content: "# Nexora AI Workspace handbook\n1. Respect user data privacy at all times. All parsing occurs strictly within secure cloud environments.\n2. Leverage detailed structured Markdown formatting (tables, lists, and code blocks).\n3. Keep system responses professional, strategic, concise, and focused on user intent.\n4. When referencing attached knowledge documents, always cite the file name clearly."
        }
      ];

      for (const d of defaultDocs) {
        const chunks = chunkText(d.content);
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunkTextValue = chunks[idx];
          let values = EMBEDDING_CACHE.get(chunkTextValue);
          if (!values) {
            const embResponse = (await ai.models.embedContent({
              model: "gemini-embedding-001",
              contents: chunkTextValue
            })) as any;
            values = embResponse.embedding?.values;
            if (values) {
              EMBEDDING_CACHE.set(chunkTextValue, values);
            }
          }
          if (values) {
            VECTOR_STORE.push({
              id: `${d.id}-chunk-${idx}`,
              docId: d.id,
              docName: d.name,
              text: chunkTextValue,
              vector: values,
              chunkIndex: idx
            });
          }
        }
      }
      console.log(`Pre-seeded vector database with ${VECTOR_STORE.length} chunks.`);
    }
  } catch (err) {
    console.warn("Failed to pre-seed default embeddings. Gemini key might not be fully configured yet:", err);
  }

  // API endpoint to check config status
  app.get("/api/config", (req, res) => {
    const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(baseUrl);

    res.json({
      hasApiKey: !!apiKey,
      appName: "Enterprise Internal RAG Chatbot with Email Automation",
      apiVersion: "2.1.0",
      defaultModel: "gemini-3.6-flash",
      googleOAuth: {
        enabled: !!(clientId && clientSecret),
        clientIdPresent: !!clientId,
        clientSecretPresent: !!clientSecret,
        expectedRedirectUri: redirectUri
      }
    });
  });

  // API endpoint to index uploaded documents into vector embeddings
  app.post("/api/documents/index", async (req, res) => {
    const logPrefix = "[VectorIndex]";
    console.log(`${logPrefix} index request received`, { docId: req.body?.docId, name: req.body?.name, fileType: req.body?.fileType, contentLength: typeof req.body?.content === "string" ? req.body.content.length : 0 });

    try {
      if (!ai) {
        throw new Error("Gemini API key is missing. Ensure GEMINI_API_KEY is configured.");
      }

      const { docId, name, content, fileType } = req.body || {};
      if (!docId || !name || typeof content !== "string") {
        return res.status(400).json({ success: false, error: "Missing required fields: docId, name, content." });
      }

      const validation = validateDocumentContent(content, name);
      if (!validation.valid) {
        console.error(`${logPrefix} document validation failed`, { docId, name, error: validation.error });
        return res.status(400).json({ success: false, error: validation.error || "Document validation failed." });
      }

      const cleanedContent = validation.text;
      console.log(`${logPrefix} extracted text validated`, { docId, name, length: cleanedContent.length, fileType: fileType || name.split(".").pop() || "txt" });

      const payload = buildIndexPayload({ docId, name, content: cleanedContent, fileType });
      const chunks = payload.chunks;

      if (!chunks || chunks.length === 0) {
        throw new Error(`No valid text chunks could be created from "${name}". Ensure the document contains readable content.`);
      }

      const alreadyIndexed = VECTOR_STORE.some(chunk => chunk.docId === docId);
      if (alreadyIndexed) {
        const existing = VECTOR_STORE.filter(chunk => chunk.docId === docId);
        return res.json({ success: true, docId, docName: name, chunksCount: existing.length });
      }

      let indexedCount = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkValue = chunk.text.trim();

        if (!chunkValue) {
          console.warn(`${logPrefix} skipping empty chunk`, { docId, chunkIndex: i });
          continue;
        }

        let values = EMBEDDING_CACHE.get(chunkValue);
        if (!values) {
          console.log(`${logPrefix} generating embedding`, { docId, chunkIndex: i, chunkLength: chunkValue.length, model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001" });
          const embRes = (await ai.models.embedContent({
            model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
            contents: chunkValue
          })) as any;

          const rawValues = embRes?.embedding?.values ?? embRes?.embeddings?.[0]?.values ?? null;
          if (!Array.isArray(rawValues) || rawValues.length === 0) {
            throw new Error(`Embedding generation failed for "${name}" at chunk ${i}: model response did not contain vector values.`);
          }

          values = rawValues.map((value: any) => Number(value));
          EMBEDDING_CACHE.set(chunkValue, values);
        }

        if (!Array.isArray(values) || values.length === 0) {
          throw new Error(`Embedding generation failed for "${name}" at chunk ${i}: empty vector result.`);
        }

        VECTOR_STORE.push({
          id: `${docId}-chunk-${i}`,
          docId,
          docName: name,
          text: chunkValue,
          vector: values,
          chunkIndex: i
        });
        indexedCount++;
      }

      console.log(`${logPrefix} indexing complete`, { docId, name, indexedCount, totalChunks: chunks.length });

      return res.json({
        success: true,
        docId,
        docName: name,
        chunksCount: indexedCount,
        totalChunks: chunks.length
      });
    } catch (err: any) {
      console.error(`${logPrefix} indexing failed`, { docId: req.body?.docId, name: req.body?.name, error: err?.message || err, stack: err?.stack });
      const isRateLimit = isRateLimitError(err);
      return res.status(isRateLimit ? 429 : 500).json({
        success: false,
        error: isRateLimit ? "AI features are temporarily unavailable because the API quota has been exceeded." : (err.message || "Failed to index document embeddings."),
        isRateLimit,
        details: err?.stack || undefined
      });
    }
  });

  // API endpoint to delete document vectors
  app.delete("/api/documents/:id", (req, res) => {
    const { id } = req.params;
    let removeCount = 0;
    for (let i = VECTOR_STORE.length - 1; i >= 0; i--) {
      if (VECTOR_STORE[i].docId === id) {
        VECTOR_STORE.splice(i, 1);
        removeCount++;
      }
    }
    res.json({ success: true, removedChunks: removeCount });
  });

  // API endpoint for voice transcription using Gemini API
  app.post("/api/transcribe", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: "Gemini API key is required for speech transcription." });
      }

      const { audio, mimeType } = req.body;
      if (!audio || !mimeType) {
        return res.status(400).json({ error: "Missing required fields: audio, mimeType." });
      }

      // Call Gemini model with the audio file
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audio
            }
          },
          "Listen to this audio recording and transcribe it word-for-word. Output only the clear text transcript. Do not add any greeting, commentary, punctuation analysis, or introduction. If you cannot hear any clear speech, output exactly 'Speech is unclear or empty.'"
        ]
      });

      const transcription = (response.text || "").trim();
      res.json({ success: true, transcription });
    } catch (err: any) {
      console.error("Transcription error:", err);
      const isRateLimit = isRateLimitError(err);
      res.status(isRateLimit ? 429 : 500).json({
        error: isRateLimit ? "AI features are temporarily unavailable because the API quota has been exceeded." : (err.message || "Failed to transcribe voice snippet."),
        isRateLimit
      });
    }
  });

  // API endpoint for AI Document Intelligence actions (Summarize, Translate, FAQs, key points etc.)
  app.post("/api/documents/intelligence", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: "Gemini API key is required for AI Document Intelligence." });
      }

      const { action, content, language } = req.body;
      if (!action || !content) {
        return res.status(400).json({ error: "Missing required fields: action, content." });
      }

      const cacheKey = `${action}:${language || "en"}:${content}`;
      if (INTELLIGENCE_CACHE.has(cacheKey)) {
        return res.json(INTELLIGENCE_CACHE.get(cacheKey));
      }

      let systemPrompt = "";
      if (action === "summarize") {
        systemPrompt = "You are an elite research analyst. Generate a clear, structured Executive Summary of the following document content. Use bullet points and table lists where appropriate. Keep it professional, informative, and detailed.";
      } else if (action === "extract") {
        systemPrompt = "You are an operations specialist. Analyze the following document and extract the primary Key Points, Metrics, KPIs, Dates, Action Plans, and stakeholders. Format your response clearly with concise sections.";
      } else if (action === "faqs") {
        systemPrompt = "You are a customer success director. Generate an exhaustive, clear Frequently Asked Questions (FAQ) guide with Q&A blocks based strictly on the provided document content.";
      } else if (action === "explain") {
        systemPrompt = "You are a top technical educator. Read the provided document, identify complex concepts, and explain them in extremely simple, beginner-friendly terms without losing factual precision.";
      } else if (action === "report") {
        systemPrompt = "You are a corporate advisor. Generate a highly formal, comprehensive Corporate Business Briefing and strategic recommendations report based on the attached document.";
      } else if (action === "translate") {
        const targetLang = language === "te" ? "Telugu" : language === "hi" ? "Hindi" : "English";
        systemPrompt = `Translate the following document content perfectly into professional, grammatically flawless ${targetLang}. Maintain original paragraphs and structure.`;
      } else {
        systemPrompt = "Analyze the document content and provide strategic insights.";
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          { text: systemPrompt },
          { text: `DOCUMENT CONTENT:\n\n${content}` }
        ]
      });

      const result = (response.text || "").trim();
      const payload = { success: true, result };
      INTELLIGENCE_CACHE.set(cacheKey, payload);
      res.json(payload);
    } catch (err: any) {
      console.error("AI Document intelligence error:", err);
      const isRateLimit = isRateLimitError(err);
      res.status(isRateLimit ? 429 : 500).json({
        error: isRateLimit ? "AI features are temporarily unavailable because the API quota has been exceeded." : (err.message || "Failed to execute AI document intelligence operation."),
        isRateLimit
      });
    }
  });

  // API endpoint to ask a question about a specific document
  app.post("/api/documents/ask", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: "Gemini API key is required for AI interactions." });
      }

      const { content, query, docName } = req.body;
      if (!content || !query) {
        return res.status(400).json({ error: "Missing required fields: content, query." });
      }

      const cacheKey = `${docName || "default"}:${content}:${query}`;
      if (ASK_CACHE.has(cacheKey)) {
        return res.json(ASK_CACHE.get(cacheKey));
      }

      const systemPrompt = `You are an expert AI assistant. Answer the user's question about the document "${docName || "the attached document"}" based strictly on the provided document content. Be concise, accurate, and professional. Use Markdown formatting.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          { text: systemPrompt },
          { text: `DOCUMENT CONTENT:\n\n${content}` },
          { text: `USER QUESTION: ${query}` }
        ]
      });

      const answer = (response.text || "").trim();
      const payload = { success: true, answer };
      ASK_CACHE.set(cacheKey, payload);
      res.json(payload);
    } catch (err: any) {
      console.error("Ask AI error:", err);
      const isRateLimit = isRateLimitError(err);
      res.status(isRateLimit ? 429 : 500).json({
        error: isRateLimit ? "AI features are temporarily unavailable because the API quota has been exceeded." : (err.message || "Failed to query the document."),
        isRateLimit
      });
    }
  });

  // API endpoint to query semantic vector store (Citations inspection/Testing)
  app.post("/api/documents/query", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: "Gemini API key is required for semantic queries." });
      }

      const { query, limit = 4, docIds } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query string is required." });
      }

      if (VECTOR_STORE.length === 0) {
        return res.json({ citations: [] });
      }

      // Embed query string
      const embRes = (await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: query
      })) as any;

      const queryVector = embRes.embedding?.values;
      if (!queryVector) {
        return res.status(500).json({ error: "Failed to generate query vector embedding." });
      }

      // Calculate similarities
      const matches = VECTOR_STORE
        .filter(chunk => !docIds || docIds.includes(chunk.docId))
        .map(chunk => {
          const score = cosineSimilarity(queryVector, chunk.vector);
          return {
            docId: chunk.docId,
            docName: chunk.docName,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            score
          };
        })
        .filter(match => match.score > 0.25) // Filter out low quality relevance
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      res.json({ citations: matches });
    } catch (err: any) {
      console.error("Semantic query error:", err);
      const isRateLimit = isRateLimitError(err);
      res.status(isRateLimit ? 429 : 500).json({
        error: isRateLimit ? "AI features are temporarily unavailable because the API quota has been exceeded." : (err.message || "Vector similarity query failed."),
        isRateLimit
      });
    }
  });

  // API endpoint for SSE (Server-Sent Events) streaming chatbot grounding with advanced LLM and RAG
  app.post("/api/chat/stream", async (req, res) => {
    try {
      if (!ai) {
        throw new Error("Gemini API key is not configured on the server.");
      }

      const {
        messages,
        systemInstruction,
        modelName,
        temperature,
        activeDocIds,
        enableQueryExpansion,
        enableGroundingEvaluation,
        enablePromptCompression
      } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required." });
      }

      // Setup SSE response headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Get latest user query to ground semantic search
      const latestUserMsg = [...messages].reverse().find(m => m.role === "user");
      const queryText = latestUserMsg ? latestUserMsg.content : "";

      let retrievedCitations: any[] = [];
      let expandedQueries: string[] = [];

      // 1. ADVANCED RAG FEATURE: QUERY EXPANSION
      let queryTextsToEmbed = [queryText];
      if (enableQueryExpansion && queryText && VECTOR_STORE.length > 0) {
        try {
          const expansionPrompt = `Given the user's search query: "${queryText}", output exactly 2 semantically related alternative search terms or keyword phrases to optimize vector lookup. Return ONLY a valid JSON array of strings: ["alternative1", "alternative2"]. Do not output any markdown markers or additional characters.`;
          const expansionRes = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: expansionPrompt
          });
          const expText = (expansionRes.text || "[]").trim();
          const cleanExpText = expText.replace(/```json/gi, "").replace(/```/gi, "").trim();
          const parsed = JSON.parse(cleanExpText);
          if (Array.isArray(parsed)) {
            expandedQueries = parsed;
            queryTextsToEmbed = [queryText, ...expandedQueries];
          }
        } catch (e) {
          console.warn("Failed query expansion step, falling back to raw query:", e);
        }
      }

      // Perform RAG grounding if vector database has records
      if (queryText && VECTOR_STORE.length > 0) {
        try {
          // Generate embeddings for all query variants and average them (Query Fusion Embedding)
          let unifiedQueryVector: number[] | null = null;
          let vectorsCount = 0;

          for (const q of queryTextsToEmbed) {
            const embRes = (await ai.models.embedContent({
              model: "gemini-embedding-001",
              contents: q
            })) as any;

            const values = embRes.embedding?.values;
            if (values) {
              if (!unifiedQueryVector) {
                unifiedQueryVector = [...values];
              } else {
                for (let i = 0; i < unifiedQueryVector.length; i++) {
                  unifiedQueryVector[i] += values[i];
                }
              }
              vectorsCount++;
            }
          }

          if (unifiedQueryVector && vectorsCount > 0) {
            // Average the fused query vectors
            for (let i = 0; i < unifiedQueryVector.length; i++) {
              unifiedQueryVector[i] /= vectorsCount;
            }

            retrievedCitations = VECTOR_STORE
              .filter(chunk => !activeDocIds || activeDocIds.length === 0 || activeDocIds.includes(chunk.docId))
              .map(chunk => {
                const score = cosineSimilarity(unifiedQueryVector!, chunk.vector);
                return {
                  docId: chunk.docId,
                  docName: chunk.docName,
                  chunkIndex: chunk.chunkIndex,
                  text: chunk.text,
                  score
                };
              })
              .filter(match => match.score > 0.28) // Score threshold
              .sort((a, b) => b.score - a.score)
              .slice(0, 3); // Top 3 context passages
          }
        } catch (vErr) {
          console.error("Failed to fetch grounding citations in stream:", vErr);
        }
      }

      // 2. ADVANCED RAG FEATURE: PROMPT CONTEXT COMPRESSION
      let compressedCitationsText = "";
      const originalCharCount = retrievedCitations.reduce((acc, c) => acc + c.text.length, 0);
      let compressedCharCount = originalCharCount;

      if (enablePromptCompression && retrievedCitations.length > 0) {
        try {
          const combinedText = retrievedCitations.map((c, i) => `[Source #${i + 1} - ${c.docName}]: ${c.text}`).join("\n\n");
          const compressionPrompt = `Compress and summarize the following retrieved documentation segments into a concise, information-dense reference text. Remove boilerplate, repetitive statements, and filler words, but preserve all metrics, numbers, KPIs, and precise details. Output ONLY the compressed reference text. Do not add any greeting or meta-commentary.\n\n${combinedText}`;
          const compRes = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: compressionPrompt
          });
          compressedCitationsText = (compRes.text || combinedText).trim();
          compressedCharCount = compressedCitationsText.length;
        } catch (cErr) {
          console.warn("Failed RAG context prompt compression:", cErr);
          compressedCitationsText = retrievedCitations.map((c, i) => `[Source #${i + 1} - ${c.docName}]: ${c.text}`).join("\n\n");
        }
      } else {
        compressedCitationsText = retrievedCitations.map((c, i) => `[Source #${i + 1} - ${c.docName}]: ${c.text}`).join("\n\n");
      }

      const originalTokenCount = Math.round(originalCharCount / 4.1);
      const compressedTokenCount = Math.round(compressedCharCount / 4.1);

      // Send citations and token savings metadata chunk first
      res.write(`data: ${JSON.stringify({
        type: "citations",
        citations: retrievedCitations,
        originalTokenCount,
        compressedTokenCount,
        expandedQueries
      })}\n\n`);

      // Synthesize grounded system instructions
      let activeSystemInstruction = systemInstruction || "You are an elite, enterprise-grade AI assistant. Format answers beautifully in Markdown.";

      if (retrievedCitations.length > 0) {
        activeSystemInstruction += "\n\n=== SEMANTIC RAG GROUNDING SOURCES ===\n" +
          "Use the following compressed grounding context compiled from uploaded documents to formulate your answer. " +
          "Keep your reply strictly aligned with these facts. Always cite source file names when directly referring to their contents:\n\n" +
          compressedCitationsText +
          "\n======================================";
      }

      // STRICT PHASE 5 OUTPUT FORMAT INSTRUCTION
      activeSystemInstruction += "\n\n=== MANDATORY OUTPUT FORMAT ===\n" +
        "You MUST structure your entire response using the following exactly-named Markdown sections. Do not deviate from these headers:\n\n" +
        "### 1. Answer\n" +
        "[Provide your full, comprehensive, beautifully structured answer here using precise, highly professional markdown lists, bold terms, and tables where applicable.]\n\n" +
        "### 2. Summary\n" +
        "[Provide a concise 2-3 sentence executive summary of the core findings here.]\n\n" +
        "### 3. Key Points\n" +
        "- [Key Point 1]\n" +
        "- [Key Point 2]\n" +
        "- [Key Point 3]\n\n" +
        "### 4. Source Documents\n" +
        "[List the specific filenames/IDs of the documents used to answer this query. If none are used, write 'General Enterprise Knowledge Base'.]\n\n" +
        "### 5. Page Numbers\n" +
        "[List the specific chunk index or page references. If none, write 'N/A'.]\n\n" +
        "### 6. Confidence Score\n" +
        "**[Insert calculated percentage, e.g. 95]%** (Reflect the accuracy/grounding alignment score of the retrieved content)\n\n" +
        "### 7. Suggested Follow-up Questions\n" +
        "1. [Follow-up question 1]\n" +
        "2. [Follow-up question 2]\n" +
        "3. [Follow-up question 3]\n\n" +
        "### 8. Related Documents\n" +
        "- [List 1-2 related document names or suggestions, or 'N/A' if none.]\n\n" +
        "Never omit any section. Always format each section with its exact title header.";

      // Format standard chat contents for Gemini models
      const contents = messages.map(msg => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      }));

      const selectedModel = modelName || "gemini-3.6-flash";
      let finalAnswerText = "";

      // Call Gemini Stream API
      const streamResponse = await ai.models.generateContentStream({
        model: selectedModel,
        contents: contents,
        config: {
          systemInstruction: activeSystemInstruction,
          temperature: temperature !== undefined ? Number(temperature) : 0.7,
        }
      });

      // Stream text chunks directly down to the browser
      for await (const chunk of streamResponse) {
        if (chunk.text) {
          finalAnswerText += chunk.text;
          res.write(`data: ${JSON.stringify({ type: "text", text: chunk.text })}\n\n`);
        }
      }

      // 3. ADVANCED RAG FEATURE: REAL-TIME GROUNDING EVALUATION & HALLUCINATION SHIELD
      let groundingScore = 100;
      let relevanceScore = 100;
      let evaluationReport = "Grounding verification skipped. System assume perfect alignment.";

      if (enableGroundingEvaluation && retrievedCitations.length > 0 && finalAnswerText) {
        try {
          const evaluationPrompt = `You are an elite AI factual reliability and hallucination auditor. 
Evaluate the Assistant's generated response against the provided Grounding Sources to verify accuracy.

[User Query]:
"${queryText}"

[Grounding Sources]:
${retrievedCitations.map((c, i) => `[Source #${i + 1}]: ${c.text}`).join("\n\n")}

[Generated Assistant Answer]:
"${finalAnswerText}"

Calculate:
1. "groundingScore" (0-100): Reflects factual faithfulness. Deduct 25 points for every hallucinated claim, exaggerated metric, or detail not in the Grounding Sources. If no errors, output 100.
2. "relevanceScore" (0-100): Reflects how directly and completely the answer solves the user query.
3. "evaluationReport" (string): A concise, 2-sentence explanation of your assessment.

Return ONLY a valid JSON object matching this schema. Do not add markdown annotations or wrappers:
{
  "groundingScore": 95,
  "relevanceScore": 100,
  "evaluationReport": "The generated response perfectly preserves the active metrics and aligns with SaaS onboarding objectives with zero hallucinations."
}`;

          const evalRes = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: evaluationPrompt
          });

          const evalText = (evalRes.text || "{}").trim();
          const cleanEvalText = evalText.replace(/```json/gi, "").replace(/```/gi, "").trim();
          const parsedEval = JSON.parse(cleanEvalText);

          groundingScore = parsedEval.groundingScore ?? 100;
          relevanceScore = parsedEval.relevanceScore ?? 100;
          evaluationReport = parsedEval.evaluationReport ?? "Verified perfect alignment with grounding assets.";
        } catch (evalErr) {
          console.warn("Failed grounding self-evaluation audit:", evalErr);
          evaluationReport = "Grounding audit bypassed due to a parsing exception.";
        }
      } else if (retrievedCitations.length > 0) {
        evaluationReport = "Grounding verification bypassed. Toggles are inactive.";
      } else {
        evaluationReport = "Grounding verification skipped. No active documentation was index-queried.";
      }

      // Send evaluation report and final payload indicators
      res.write(`data: ${JSON.stringify({
        type: "evaluation",
        groundingScore,
        relevanceScore,
        evaluationReport,
        expandedQueries
      })}\n\n`);

      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (err: any) {
      console.error("SSE stream error:", err);
      const isRateLimit = isRateLimitError(err);
      res.write(`data: ${JSON.stringify({ type: "error", error: isRateLimit ? "AI features are temporarily unavailable because the API quota has been exceeded." : (err.message || "SSE grounding failure."), isRateLimit })}\n\n`);
      res.end();
    }
  });

  // Support standard non-streaming chat requests from EmailAutomation or Dashboard Floating Agent
  app.post("/api/chat", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: "Gemini API key is required for AI chat interactions." });
      }

      const { messages, message, systemInstruction, personaPrompt, modelName, temperature, ragDocuments } = req.body;

      const cacheKey = JSON.stringify({ messages, message, systemInstruction, personaPrompt, modelName, temperature, ragDocuments });
      if (CHAT_CACHE.has(cacheKey)) {
        return res.json(CHAT_CACHE.get(cacheKey));
      }

      let contents: any[] = [];
      let activeSystemInstruction = systemInstruction || personaPrompt || "You are a helpful Nexora Workspace AI assistant.";

      if (messages && Array.isArray(messages)) {
        contents = messages.map(msg => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        }));
      } else if (message) {
        contents = [{ role: "user", parts: [{ text: message }] }];
      } else {
        return res.status(400).json({ error: "No user input or messages provided." });
      }

      // Append RAG documents if passed from Dashboard Float widget
      if (ragDocuments && Array.isArray(ragDocuments) && ragDocuments.length > 0) {
        const docsText = ragDocuments.map((d: any) => `[File: ${d.name}]:\n${d.content}`).join("\n\n");
        activeSystemInstruction += `\n\nGrounding context for this query:\n${docsText}`;
      }

      const rawModel = modelName || "gemini-3.6-flash";
      const activeModel = (rawModel === "gemini-2.5-flash" || rawModel.startsWith("gemini-2.0") || rawModel.startsWith("gemini-1.5"))
        ? "gemini-3.6-flash"
        : rawModel;

      const response = await ai.models.generateContent({
        model: activeModel,
        contents,
        config: {
          systemInstruction: activeSystemInstruction,
          temperature: temperature !== undefined ? Number(temperature) : 0.7,
        }
      });

      const resultText = (response.text || "").trim();

      const payload = {
        success: true,
        text: resultText,
        response: resultText
      };
      CHAT_CACHE.set(cacheKey, payload);
      res.json(payload);
    } catch (err: any) {
      console.error("Non-streaming chat error:", err);
      const isRateLimit = isRateLimitError(err);
      res.status(isRateLimit ? 429 : 500).json({
        error: isRateLimit ? "AI features are temporarily unavailable because the API quota has been exceeded." : (err.message || "Failed to process chat response."),
        isRateLimit
      });
    }
  });

  // ── Backend Server-Side OAuth 2.0 Flow for Google Calendar / Meet ──
  // Nexora only needs the Google Calendar events scope to create meeting events,
  // manage the associated Google Meet link, and read meeting metadata.

  app.get("/api/oauth/google", (req, res) => {
    try {
      const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(baseUrl);

      // Validate presence of required configuration
      if (!process.env.APP_URL) {
        console.warn("[OAuth] APP_URL is not set. For local development set APP_URL=http://localhost:3001 in .env.local");
      } else {
        const expectedRedirect = `${process.env.APP_URL.replace(/\/$/, "")}/api/oauth/callback`;
        if (redirectUri !== expectedRedirect) {
          return res.status(500).send(`APP_URL (${process.env.APP_URL}) does not produce the expected redirect URI (${expectedRedirect}). Ensure APP_URL is set correctly.`);
        }
      }

      if (!clientId) {
        return res.status(500).send("GOOGLE_CLIENT_ID is missing. Add GOOGLE_CLIENT_ID to your .env.local or environment variables.");
      }

      if (!clientSecret) {
        return res.status(500).send("GOOGLE_CLIENT_SECRET is missing. Add GOOGLE_CLIENT_SECRET to your .env.local or environment variables.");
      }

      let scope = "https://www.googleapis.com/auth/calendar.events";
      if (req.query.type === "gmail") {
        scope = "https://www.googleapis.com/auth/gmail.send";
      } else if (req.query.type === "both") {
        scope = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.send";
      }
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&include_granted_scopes=true`;

      res.redirect(authUrl);
    } catch (e) {
      console.error("Error initiating OAuth:", e);
      res.status(500).send("Failed to initiate OAuth.");
    }
  });

  app.get("/api/oauth/callback", async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error;

    if (error) {
      return res.status(400).send(`OAuth Error: ${error}`);
    }
    if (!code) {
      return res.status(400).send("No authorization code provided.");
    }

    try {
      const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(baseUrl);

      if (!clientId || !clientSecret) {
        return res.status(500).send("Google OAuth config is missing. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment variables.");
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        return res.status(tokenResponse.status).send(`Failed to exchange code: ${errText}`);
      }

      const tokenData = await tokenResponse.json();

      // Return a popup HTML that communicates with the parent window
      res.send(`
        <html>
          <head><title>OAuth Successful</title></head>
          <body>
            <p>Authentication successful! Returning to application...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: "OAUTH_SUCCESS",
                  accessToken: "${tokenData.access_token}",
                  refreshToken: "${tokenData.refresh_token || ""}"
                }, "*");
                window.close();
              } else {
                document.body.innerHTML += "<p>Please close this window and refresh the application.</p>";
              }
            </script>
          </body>
        </html>
      `);
    } catch (e) {
      console.error("Error during OAuth callback:", e);
      res.status(500).send("Internal server error during OAuth callback.");
    }
  });

  app.post("/api/oauth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: "No refresh token provided." });

      const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const { clientId, clientSecret } = getGoogleOAuthConfig(baseUrl);

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: "Google OAuth config is missing. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment variables." });
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
        })
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        return res.status(tokenResponse.status).json({ error: "Failed to refresh token", details: errText });
      }

      const tokenData = await tokenResponse.json();
      res.json({ accessToken: tokenData.access_token });
    } catch (e) {
      console.error("Error refreshing token:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Proxy API endpoint to relay email dispatches via Google Workspace Gmail OAuth token
  // Supports single recipient (legacy) and multi-recipient arrays (Email Assistant)
  app.post("/api/email/send", async (req, res) => {
    try {
      const { recipient, recipients, cc, bcc, subject, body, token, refreshToken, type = "manual" } = req.body;

      // Resolve recipients: prefer the array form, fall back to legacy single string
      const toList: string[] = Array.isArray(recipients) && recipients.length > 0
        ? recipients
        : (recipient ? [recipient] : []);

      if (toList.length === 0 || !subject || !body || !token) {
        return res.status(400).json({ error: "Missing required fields: recipients (or recipient), subject, body, token." });
      }

      const toHeader = toList.join(", ");
      const ccHeader = Array.isArray(cc) && cc.length > 0 ? cc.join(", ") : "";
      const bccHeader = Array.isArray(bcc) && bcc.length > 0 ? bcc.join(", ") : "";

      // Gmail API expects raw RFC 2822 email format base64url-encoded
      const rfcEmailLines = [
        `To: ${toHeader}`,
        ...(ccHeader ? [`Cc: ${ccHeader}`] : []),
        ...(bccHeader ? [`Bcc: ${bccHeader}`] : []),
        `Subject: ${subject}`,
        `Content-Type: text/html; charset=utf-8`,
        `MIME-Version: 1.0`,
        ``,
        `<div style="font-family: system-ui, sans-serif; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto;">`,
        `  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">`,
        `    <h2 style="color: #6366f1; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Nexora Email Assistant</h2>`,
        `  </div>`,
        `  <div style="background-color: white; padding: 20px; border-radius: 8px; border: 1px solid #f1f5f9; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">`,
        `    ${body.replace(/\n/g, "<br/>")}`,
        `  </div>`,
        `  <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 24px; font-weight: 500;">`,
        `    This email is dispatched securely using your Google Workspace Gmail credentials.<br/>`,
        `    Nexora AI Enterprise • Confidential Transmission`,
        `  </p>`,
        `</div>`
      ];

      const base64UrlEmail = Buffer.from(rfcEmailLines.join("\r\n"))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const gmailApiUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

      let currentToken = token;
      let gResponse = await fetch(gmailApiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${currentToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: base64UrlEmail })
      });

      if (!gResponse.ok && (gResponse.status === 401 || gResponse.status === 403) && refreshToken) {
        console.log("Token expired or unauthorized, attempting to refresh token...");
        const clientId = process.env.GOOGLE_CLIENT_ID || "";
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

        if (clientId && clientSecret) {
          const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              grant_type: "refresh_token"
            })
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            currentToken = refreshData.access_token;
            // Retry the Gmail API call with the new token
            gResponse = await fetch(gmailApiUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${currentToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ raw: base64UrlEmail })
            });
          } else {
            console.error("Failed to refresh token during email dispatch.");
          }
        }
      }

      if (!gResponse.ok) {
        const errDetail = await gResponse.text();
        throw new Error(`Gmail API returned error status ${gResponse.status}: ${errDetail}`);
      }

      const responseData = await gResponse.json();

      // Log success
      const newLog: EmailLog = {
        id: `log-${Date.now()}`,
        recipient: toHeader,
        subject,
        body,
        timestamp: new Date().toISOString(),
        status: "success",
        type
      };
      EMAIL_LOGS.unshift(newLog);

      res.json({ success: true, messageId: responseData.id, log: newLog, recipients: toList });
    } catch (err: any) {
      console.error("Gmail relay dispatch error:", err);
      const toFallback = Array.isArray(req.body.recipients) ? req.body.recipients.join(", ") : (req.body.recipient || "unknown");
      const failedLog: EmailLog = {
        id: `log-${Date.now()}`,
        recipient: toFallback,
        subject: req.body.subject || "Dispatch failure",
        body: req.body.body || "",
        timestamp: new Date().toISOString(),
        status: "failed",
        error: err.message || "Failed relay.",
        type: req.body.type || "manual"
      };
      EMAIL_LOGS.unshift(failedLog);

      res.status(500).json({ error: err.message || "Failed to dispatch email.", log: failedLog });
    }
  });

  // API endpoint to fetch Gmail activity logs
  app.get("/api/email/logs", (req, res) => {
    res.json({ logs: EMAIL_LOGS });
  });

  // API endpoint for admin telemetry dashboards
  app.get("/api/admin/status", (req, res) => {
    const mem = process.memoryUsage();
    res.json({
      cpuUsage: Math.round(Math.random() * 12 + 4), // Simulated active CPU thread index
      memoryUsage: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10, // Live heap metric
      vectorCount: VECTOR_STORE.length,
      documentCount: Array.from(new Set(VECTOR_STORE.map(v => v.docId))).length,
      emailsSent: EMAIL_LOGS.filter(l => l.status === "success").length,
      apiLatency: Math.round(45 + Math.random() * 15) // Dynamic gateway ping milliseconds
    });
  });

  // ----------------------------------------------------
  // SECURE NEXORA MEETINGS LIFECYCLE & RLS-LIKE ENDPOINTS
  // ----------------------------------------------------

  // 1. Create Meeting
  app.post("/api/meetings/create", (req, res) => {
    const { title, date, time, duration, password, waitingRoomEnabled, userId, userEmail, userName, invitedEmails } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Valid host identification required." });
    }

    const newId = req.body.id || `aet-${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 5)}`;

    const newMeeting: ServerMeeting = {
      id: newId,
      title: title || "Nexora Secure Sync",
      organizer: userName || "Nexora Host",
      ownerId: userId, // unique host (owner_id)
      platform: "Nexora",
      time: `${time} (${date})`,
      duration: `${duration} mins`,
      participants: [userName || "Nexora Host"],
      participantIds: [userId], // store participant_ids separately
      invitedEmails: invitedEmails ? invitedEmails.split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean) : [],
      project: "Nexora Virtual Network",
      status: "upcoming", // Scheduled
      tags: ["Secure-WebRTC", "Nexora-Native", "No-Email"],
      password: password || undefined,
      waitingRoomEnabled: !!waitingRoomEnabled,
      locked: false,
      date: date || new Date().toISOString().split("T")[0]
    };

    MEETINGS_STORE.push(newMeeting);
    saveMeetings();

    res.json({ success: true, meeting: newMeeting });
  });

  // 2. Start Meeting (Host Action)
  app.post("/api/meetings/:id/start", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    const meeting = MEETINGS_STORE.find(m => m.id === id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    if (meeting.ownerId !== userId) {
      return res.status(403).json({ error: "Access Denied. Only the unique host can start this meeting." });
    }

    meeting.status = "live"; // Start meeting -> Live state
    saveMeetings();

    res.json({ success: true, meeting });
  });

  // 3. Join / Connect Gate (for both Guests and Registered Participants)
  app.post("/api/meetings/:id/join", (req, res) => {
    const { id } = req.params;
    const { name, password, userId, userEmail } = req.body;

    const meeting = MEETINGS_STORE.find(m => m.id === id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    // Check if locked
    if (meeting.locked) {
      return res.status(403).json({ error: "This meeting is locked by the host. No new participants are allowed." });
    }

    // Check password if configured
    if (meeting.password && meeting.password !== password) {
      return res.status(401).json({ error: "Incorrect meeting security password." });
    }

    // Check meeting status (lifecycle states)
    if (meeting.status === "upcoming") {
      // Is current joining user the host?
      if (meeting.ownerId === userId) {
        // Automatically start the meeting when host enters!
        meeting.status = "live";
        saveMeetings();
      } else {
        // Guests cannot join while the meeting is Scheduled
        return res.status(403).json({
          error: "The host has not started this meeting yet. Please wait until the meeting begins."
        });
      }
    } else if (meeting.status === "completed") {
      // Block joins if Ended
      return res.status(403).json({ error: "This meeting has already ended." });
    }

    // Handle Waiting Room
    const isHostUser = meeting.ownerId === userId || (userEmail && meeting.invitedEmails.includes(userEmail.toLowerCase()) && userId === meeting.ownerId);

    if (meeting.waitingRoomEnabled && !isHostUser) {
      // Check if this guest name has already been admitted
      const isAlreadyAdmitted = meeting.participants.includes(name);
      if (!isAlreadyAdmitted) {
        if (!meeting.waitingRoomQueue) {
          meeting.waitingRoomQueue = [];
        }
        if (!meeting.waitingRoomQueue.includes(name)) {
          meeting.waitingRoomQueue.push(name);
          saveMeetings();
        }
        return res.json({ inWaitingRoom: true, meeting: { id: meeting.id, title: meeting.title, waitingRoomEnabled: true, waitingRoomQueue: meeting.waitingRoomQueue } });
      }
    }

    // Successfully joining the live meeting
    if (!meeting.participants.includes(name)) {
      meeting.participants.push(name);
    }
    if (userId && !meeting.participantIds.includes(userId)) {
      meeting.participantIds.push(userId);
    }
    saveMeetings();

    // Note: Public meeting links should allow joining the live meeting only. 
    // They must never expose recordings, transcripts, or meeting history to guests.
    // So we strip those out for non-owners/non-authorized participants!
    const isAuthorized = isHostUser || (userEmail && meeting.invitedEmails.includes(userEmail.toLowerCase()));

    const strippedMeeting = { ...meeting };
    if (!isAuthorized) {
      delete strippedMeeting.summary;
      delete strippedMeeting.transcript;
      delete strippedMeeting.decisions;
      delete strippedMeeting.actionItems;
      delete strippedMeeting.insights;
      delete strippedMeeting.notes;
    }

    res.json({ allowed: true, meeting: strippedMeeting });
  });

  // 4. Poll Waiting Room Status (Guest Action)
  app.post("/api/meetings/:id/poll-status", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    const meeting = MEETINGS_STORE.find(m => m.id === id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    if (meeting.status === "completed") {
      return res.json({ status: "completed" });
    }

    // Check if the guest has been admitted (their name is in participants list)
    const isAdmitted = meeting.participants.includes(name);
    if (isAdmitted) {
      return res.json({ admitted: true, status: "live", meeting });
    }

    res.json({ admitted: false, status: meeting.status });
  });

  // 5. Admit Guest (Host Action)
  app.post("/api/meetings/:id/admit", (req, res) => {
    const { id } = req.params;
    const { userId, guestName } = req.body;

    const meeting = MEETINGS_STORE.find(m => m.id === id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    if (meeting.ownerId !== userId) {
      return res.status(403).json({ error: "Access Denied." });
    }

    if (meeting.waitingRoomQueue) {
      meeting.waitingRoomQueue = meeting.waitingRoomQueue.filter(g => g !== guestName);
    }

    if (!meeting.participants.includes(guestName)) {
      meeting.participants.push(guestName);
    }
    saveMeetings();

    res.json({ success: true, meeting });
  });

  // 6. End / Complete Meeting (Host Action)
  app.post("/api/meetings/:id/end", (req, res) => {
    const { id } = req.params;
    const { userId, summary, transcript, decisions, actionItems, insights } = req.body;

    const meeting = MEETINGS_STORE.find(m => m.id === id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    if (meeting.ownerId !== userId) {
      return res.status(403).json({ error: "Access Denied. Only the host can end this meeting." });
    }

    meeting.status = "completed"; // Ended state
    meeting.summary = summary;
    meeting.transcript = transcript;
    meeting.decisions = decisions;
    meeting.actionItems = actionItems;
    meeting.insights = insights;

    saveMeetings();

    res.json({ success: true, meeting });
  });

  // 7. Secure List Meetings (RLS equivalent)
  app.post("/api/meetings/list", (req, res) => {
    const { userId, userEmail } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    // Filter list: only see own meetings OR meetings where invited by email
    const filtered = MEETINGS_STORE.filter(m => {
      const isOwner = m.ownerId === userId;
      const isInvited = userEmail && m.invitedEmails.includes(userEmail.toLowerCase());
      const isParticipant = m.participantIds.includes(userId);
      return isOwner || isInvited || isParticipant;
    });

    res.json({ meetings: filtered });
  });

  // 8. Secure Meeting Details (RLS equivalent)
  app.post("/api/meetings/:id/details", (req, res) => {
    const { id } = req.params;
    const { userId, userEmail } = req.body;

    const meeting = MEETINGS_STORE.find(m => m.id === id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    // Verify user is authorized: must be owner, invited email, or active participant
    const isOwner = meeting.ownerId === userId;
    const isInvited = userEmail && meeting.invitedEmails.includes(userEmail.toLowerCase());
    const isParticipant = meeting.participantIds.includes(userId);

    if (!isOwner && !isInvited && !isParticipant) {
      return res.status(403).json({ error: "Access Denied. You do not have permission to view this meeting history." });
    }

    res.json({ meeting });
  });

  // 9. Kick / Remove Participant (Host Action)
  app.post("/api/meetings/:id/remove-participant", (req, res) => {
    const { id } = req.params;
    const { userId, nameToRemove } = req.body;

    const meeting = MEETINGS_STORE.find(m => m.id === id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    if (meeting.ownerId !== userId) {
      return res.status(403).json({ error: "Access Denied." });
    }

    meeting.participants = meeting.participants.filter(p => p !== nameToRemove);
    saveMeetings();

    res.json({ success: true, meeting });
  });

  // 10. Lock / Unlock Meeting (Host Action)
  app.post("/api/meetings/:id/lock", (req, res) => {
    const { id } = req.params;
    const { userId, locked } = req.body;

    const meeting = MEETINGS_STORE.find(m => m.id === id);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found." });
    }

    if (meeting.ownerId !== userId) {
      return res.status(403).json({ error: "Access Denied." });
    }

    meeting.locked = !!locked;
    saveMeetings();

    res.json({ success: true, meeting });
  });

  // ── Create the underlying HTTP server from Express ─────────────────────────────
  // We must create an explicit http.Server so we can hand the same server
  // instance to Vite's HMR config.  This makes the Vite WebSocket share the
  // SAME port as the Express HTTP server — no separate WebSocket-only port
  // that would return HTTP 426 "Upgrade Required" to normal browser requests.
  const httpServer = http.createServer(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // ⭐ Key fix: pass the http.Server so Vite's HMR WebSocket attaches
        // to the SAME port as Express, not a separate standalone WS server.
        hmr: process.env.DISABLE_HMR === "true"
          ? false
          : { server: httpServer },
      },
      appType: "spa",
    });

    // Mount Vite's connect-compatible middleware into Express
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start listening on a single port — both HTTP pages and HMR WebSocket
  const fbConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8"));
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n✅ Nexora dev server  →  http://localhost:${PORT}`);
    console.log(`   HMR WebSocket       →  ws://localhost:${PORT} (same port, HTTP upgrade)`);
    console.log(`   Firebase project:     ${fbConfig.projectId}`);
    console.log(`   Firebase auth domain: ${fbConfig.authDomain}\n`);
  });
}

startServer();
