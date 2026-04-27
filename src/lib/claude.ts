// AI product analysis – calls server-side /api/analyze to avoid CORS issues.
// All AI logic (HF + Gemini) runs in a Vercel serverless function.

export interface AIModel {
  id: string;
  label: string;
  provider: "huggingface" | "google";
}

export const AI_MODELS: AIModel[] = [
  { id: "Salesforce/blip-image-captioning-large", label: "BLIP Large (HF)", provider: "huggingface" },
  { id: "Salesforce/blip-image-captioning-base", label: "BLIP Base (HF)", provider: "huggingface" },
  { id: "nlpconnect/vit-gpt2-image-captioning", label: "ViT-GPT2 (HF)", provider: "huggingface" },
  { id: "google/gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (Google)", provider: "google" },
];

/** "auto" tries all HF models in order */
export const AI_MODEL_AUTO = "auto";

export async function analyzeProduct(base64: string, mime: string, _lang?: string, modelId?: string): Promise<any> {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;

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
