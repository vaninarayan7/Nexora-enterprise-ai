export type DocumentFileType = "md" | "txt" | "pdf" | "docx" | "csv" | "json" | "html";

export interface DocumentChunk {
  text: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  pageNumber?: number;
  metadata?: Record<string, any>;
}

export const SUPPORTED_DOCUMENT_TYPES: DocumentFileType[] = ["md", "txt", "pdf", "docx", "csv", "json", "html"];

const normalizeWhitespace = (text: string) => text.replace(/\r\n/g, "\n").replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

export function getFileType(name: string): DocumentFileType | null {
  const type = (name.split(".").pop() || "").toLowerCase();
  if (!type) return null;
  return SUPPORTED_DOCUMENT_TYPES.includes(type as DocumentFileType) ? (type as DocumentFileType) : null;
}

export function sanitizeMarkdownText(text: string): string {
  return normalizeWhitespace(
    text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[.*?\]\([^)]*\)/g, " ")
      .replace(/\[(.*?)\]\((https?:\/\/[^)]+)\)/g, "$1")
      .replace(/[#>*_~-]+/g, " ")
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ")
  );
}

export function sanitizeDocumentText(text: string, fileName = ""): string {
  const raw = typeof text === "string" ? text : "";
  if (!raw.trim()) return "";

  const type = getFileType(fileName) || "txt";
  let cleaned = raw;

  if (type === "md") {
    cleaned = sanitizeMarkdownText(raw);
  } else if (type === "html") {
    cleaned = raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  } else if (type === "json") {
    try {
      const parsed = JSON.parse(raw);
      cleaned = JSON.stringify(parsed, null, 2);
    } catch {
      cleaned = raw;
    }
  } else if (type === "csv") {
    cleaned = raw.replace(/,/g, " ").replace(/\n{2,}/g, "\n");
  }

  cleaned = cleaned
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

export function validateDocumentContent(content: string, fileName: string): { valid: boolean; error?: string; text: string } {
  const fileType = getFileType(fileName);

  if (!fileType) {
    return { valid: false, error: `Unsupported file type for "${fileName}". Supported types: ${SUPPORTED_DOCUMENT_TYPES.join(", ")}.`, text: "" };
  }

  const text = sanitizeDocumentText(content, fileName);
  if (!text || text.length < 3) {
    return { valid: false, error: `Empty or unreadable document content extracted from "${fileName}".`, text: "" };
  }

  return { valid: true, text };
}

export function chunkDocumentText(
  text: string,
  options: { maxChunkSize?: number; overlap?: number; docId?: string; docName?: string; pageNumber?: number } = {}
): DocumentChunk[] {
  const normalized = typeof text === "string" ? text.trim() : "";
  if (!normalized) return [];

  const maxChunkSize = Math.max(200, options.maxChunkSize ?? 800);
  const overlap = Math.max(20, options.overlap ?? 120);
  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length === 0) return [];

  const chunks: DocumentChunk[] = [];
  let index = 0;
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + maxChunkSize, words.length);
    const chunkText = words.slice(start, end).join(" ");

    if (!chunkText.trim()) break;

    chunks.push({
      text: chunkText.trim(),
      docId: options.docId ?? "doc-unknown",
      docName: options.docName ?? "document.txt",
      chunkIndex: index,
      pageNumber: options.pageNumber,
      metadata: {
        source: options.docName ?? "document.txt",
        pageNumber: options.pageNumber,
        chunkIndex: index
      }
    });

    if (end >= words.length) break;

    const stride = Math.max(1, maxChunkSize - overlap);
    start = Math.min(start + stride, words.length - 1);
    index += 1;
  }

  return chunks.filter(chunk => chunk.text.trim().length > 0);
}

export function buildIndexPayload(payload: { docId: string; name: string; content: string; fileType?: string }) {
  const fileType = (payload.fileType || (payload.name.split(".").pop() || "txt")).toLowerCase();
  const validation = validateDocumentContent(payload.content, payload.name);
  const cleaned = validation.valid ? validation.text : payload.content || "";

  return {
    docId: payload.docId,
    name: payload.name,
    fileType,
    content: cleaned,
    chunks: chunkDocumentText(cleaned, { docId: payload.docId, docName: payload.name, maxChunkSize: 800, overlap: 150 })
  };
}

export async function extractTextFromFile(file: File): Promise<string> {
  const type = getFileType(file.name);
  if (!type) {
    throw new Error(`Unsupported file type for "${file.name}". Supported types: ${SUPPORTED_DOCUMENT_TYPES.join(", ")}.`);
  }

  const buffer = await file.arrayBuffer();

  if (type === "txt" || type === "md" || type === "csv" || type === "json" || type === "html") {
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(buffer);
  }

  if (type === "pdf") {
    const pdfjsLib: any = await import("pdfjs-dist");
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => (item.str || "")).join(" ");
      if (pageText && pageText.trim()) {
        pages.push(pageText.trim());
      }
    }

    return pages.join("\n\n");
  }

  if (type === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value || "";
  }

  return "";
}
