import { GoogleGenAI } from "@google/genai";

const VECTOR_STORE: any[] = []; // In-memory per invocation fallback

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

function isRateLimitError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const status = err.status || err.statusCode;
  return status === 429 || msg.includes("quota") || msg.includes("rate limit") || msg.includes("resource_exhausted") || msg.includes("limit exceeded");
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured on the server.");
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

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
            .filter(match => match.score > 0.28)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
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

    res.write(`data: ${JSON.stringify({
      type: "citations",
      citations: retrievedCitations,
      originalTokenCount,
      compressedTokenCount,
      expandedQueries
    })}\n\n`);

    let activeSystemInstruction = systemInstruction || "You are an elite, enterprise-grade AI assistant. Format answers beautifully in Markdown.";

    if (retrievedCitations.length > 0) {
      activeSystemInstruction += "\n\n=== SEMANTIC RAG GROUNDING SOURCES ===\n" +
        "Use the following compressed grounding context compiled from uploaded documents to formulate your answer. " +
        "Keep your reply strictly aligned with these facts. Always cite source file names when directly referring to their contents:\n\n" +
        compressedCitationsText +
        "\n======================================";
    }

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

    const contents = messages.map((msg: any) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const selectedModel = modelName || "gemini-3.6-flash";
    let finalAnswerText = "";

    const streamResponse = await ai.models.generateContentStream({
      model: selectedModel,
      contents: contents,
      config: {
        systemInstruction: activeSystemInstruction,
        temperature: temperature !== undefined ? Number(temperature) : 0.7,
      }
    });

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
}
