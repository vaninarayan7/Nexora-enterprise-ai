import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { buildIndexPayload, validateDocumentContent } from "../../src/lib/documentIndexing";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

const EMBEDDING_CACHE = new Map<string, number[]>();
const VECTOR_STORE: any[] = []; // In-memory per invocation

function chunkText(text: string, maxChunkSize = 800, overlap = 150): string[] {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if (!para.trim()) continue;

    if (para.length > maxChunkSize) {
      const sentences = para.match(/[^.!?]+[.!?]+(\s|$)/g) || [para];
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChunkSize) {
          if (currentChunk) chunks.push(currentChunk.trim());
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

export default async function handler(req: any, res: any) {
  const logPrefix = "[api/documents/index]";

  try {
    console.log(`${logPrefix} startup checks`, {
      gemini: !!process.env.GEMINI_API_KEY,
      supabaseUrl: !!process.env.SUPABASE_URL,
      serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: "Missing environment variable: GEMINI_API_KEY" });
    }
    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({ success: false, error: "Missing environment variable: SUPABASE_URL" });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ success: false, error: "Missing environment variable: SUPABASE_SERVICE_ROLE_KEY" });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    if (!req.body) {
      return res.status(400).json({ success: false, error: 'Request body is missing or could not be parsed' });
    }

    const { docId, name, content, fileType } = req.body;
    if (!docId || !name || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: "Missing required fields: docId, name, content." });
    }

    const validation = validateDocumentContent(content, name);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error || "Document validation failed." });
    }

    const payload = buildIndexPayload({ docId, name, content: validation.text, fileType });
    if (!payload.chunks || payload.chunks.length === 0) {
      return res.status(400).json({ success: false, error: `No valid content chunks were generated for "${name}".` });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const alreadyIndexed = (await supabase.from('document_vectors').select('id').eq('doc_id', docId).limit(1)).data ?? [];
    if (alreadyIndexed.length > 0) {
      return res.status(200).json({ success: true, chunksCount: alreadyIndexed.length, docId, docName: name });
    }

    let indexedCount = 0;

    for (let i = 0; i < payload.chunks.length; i++) {
      const chunk = payload.chunks[i];
      const chunkTextValue = chunk.text.trim();
      if (!chunkTextValue) continue;

      const embRes = (await ai.models.embedContent({
        model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
        contents: chunkTextValue
      })) as any;
      const values = embRes?.embedding?.values ?? embRes?.embeddings?.[0]?.values;
      if (!Array.isArray(values) || values.length === 0) {
        throw new Error(`Embedding generation failed for "${name}" at chunk ${i}: model returned no vector values.`);
      }

      const { error: insertError } = await supabase.from('document_vectors').insert({
        doc_id: docId,
        doc_name: name,
        content: chunkTextValue,
        embedding: values,
        chunk_index: i,
        metadata: { fileType: fileType || payload.fileType, pageNumber: chunk.pageNumber ?? null, chunkIndex: i }
      });

      if (insertError) {
        throw new Error(`Supabase vector insertion failed: ${insertError.message}. Ensure the 'document_vectors' table exists and permissions are granted.`);
      }
      indexedCount++;
    }

    return res.status(200).json({
      success: true,
      docId,
      docName: name,
      chunksCount: indexedCount,
      totalChunks: payload.chunks.length
    });

  } catch (err: any) {
    console.error(`${logPrefix} handler error:`, err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred.",
      stack: err.stack
    });
  }
}
