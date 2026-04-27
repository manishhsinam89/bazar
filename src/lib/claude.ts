// AI product analysis – calls server-side /api/analyze to avoid CORS issues.
// All AI logic (HF + Gemini) runs in a Vercel serverless function.

export interface AIModel {
  id: string;
  label: string;
  provider: "huggingface" | "google" | "ollama";
}

export const AI_MODELS: AIModel[] = [
  { id: "ollama/llava", label: "🏠 Local Ollama (LLaVA) – FREE", provider: "ollama" },
  { id: "Salesforce/blip-image-captioning-large", label: "BLIP Large (HF)", provider: "huggingface" },
  { id: "Salesforce/blip-image-captioning-base", label: "BLIP Base (HF)", provider: "huggingface" },
  { id: "nlpconnect/vit-gpt2-image-captioning", label: "ViT-GPT2 (HF)", provider: "huggingface" },
  { id: "google/gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (Google)", provider: "google" },
];

/** "auto" tries all HF models in order */
export const AI_MODEL_AUTO = "auto";

// Default Ollama endpoint – user can override via Settings page later
const OLLAMA_URL = localStorage.getItem("ollama_url") || "http://localhost:11434";

async function analyzeWithOllama(raw: string, mime: string): Promise<any> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llava",
      stream: false,
      messages: [
        {
          role: "user",
          content: "Identify this product for a marketplace listing. Reply with exactly these lines:\nName: <product name>\nCategory: <category>\nDescription: <one-line description>\nPrice: <estimated price in INR>",
          images: [raw],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama ${res.status}: ${errText.slice(0, 100)}`);
  }

  const data = await res.json();
  const text = data.message?.content || "";
  const lines = text.split("\n").filter((l: string) => l.trim());
  const get = (rx: RegExp) => (lines.find((l: string) => rx.test(l)) || "").replace(rx, "").trim();

  return {
    name: get(/^name:\s*/i) || lines[0]?.trim() || "Marketplace Item",
    description: get(/^description:\s*/i) || text.slice(0, 150),
    category: get(/^category:\s*/i) || "Handicraft",
    dimensions: "Standard",
    price_inr: get(/^price:\s*/i)?.replace(/[^0-9]/g, "") || "500",
    tags: ["handmade"],
  };
}

export async function analyzeProduct(base64: string, mime: string, _lang?: string, modelId?: string): Promise<any> {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;

  // If Ollama model selected, call local Ollama directly (no server proxy needed)
  if (modelId?.startsWith("ollama/")) {
    try {
      return await analyzeWithOllama(raw, mime);
    } catch (err: any) {
      return {
        name: "Ollama Error",
        description: `Could not reach Ollama at ${OLLAMA_URL}. Make sure Ollama is running locally. Error: ${err.message?.slice(0, 80)}`,
        category: "Handicraft",
        dimensions: "Standard",
        price_inr: "500",
        tags: ["handmade"],
      };
    }
  }

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: raw,
        mime: mime || "image/jpeg",
        modelId: modelId || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        name: data.name || "Analysis Error",
        description: data.description || data.error || `Server returned ${res.status}`,
        category: "Handicraft",
        dimensions: "Standard",
        price_inr: "500",
        tags: ["handmade"],
      };
    }

    return {
      name: data.name || "Marketplace Item",
      description: data.description || "Handcrafted item",
      category: data.category || "Handicraft",
      dimensions: data.dimensions || "Standard",
      price_inr: data.price_inr || "500",
      tags: Array.isArray(data.tags) ? data.tags : ["handmade"],
    };
  } catch (err: any) {
    return {
      name: "Connection Error",
      description: `Could not reach /api/analyze: ${err.message?.slice(0, 80) || "Network error"}`,
      category: "Handicraft",
      dimensions: "Standard",
      price_inr: "500",
      tags: ["handmade"],
    };
  }
}
