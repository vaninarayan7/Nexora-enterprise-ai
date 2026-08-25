import { GoogleGenAI } from "@google/genai";

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
      return res.status(500).json({ error: "Gemini API key is required for AI chat interactions." });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const { messages, message, systemInstruction, personaPrompt, modelName, temperature, ragDocuments } = req.body;

    let contents: any[] = [];
    let activeSystemInstruction = systemInstruction || personaPrompt || "You are a helpful Nexora Workspace AI assistant.";

    if (messages && Array.isArray(messages)) {
      contents = messages.map((msg: any) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      }));
    } else if (message) {
      contents = [{ role: "user", parts: [{ text: message }] }];
    } else {
      return res.status(400).json({ error: "No user input or messages provided." });
    }

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

    return res.json({
      success: true,
      text: resultText,
      response: resultText
    });
  } catch (err: any) {
    console.error("Non-streaming chat error:", err);
    const isRateLimit = isRateLimitError(err);
    return res.status(isRateLimit ? 429 : 500).json({
      error: isRateLimit ? "AI features are temporarily unavailable because the API quota has been exceeded." : (err.message || "Failed to process chat response."),
      isRateLimit,
      stack: err.stack
    });
  }
}
