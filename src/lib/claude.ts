// Hugging Face Inference API – free tier, no local models needed.
// Uses BLIP for image captioning with vit-gpt2 as fallback.

export interface AIModel {
  id: string;
  label: string;
  provider: "huggingface" | "google";
}

export const AI_MODELS: AIModel[] = [
  { id: "Salesforce/blip-image-captioning-large", label: "BLIP Large (HF)", provider: "huggingface" },
  { id: "Salesforce/blip-image-captioning-base", label: "BLIP Base (HF)", provider: "huggingface" },
  { id: "nlpconnect/vit-gpt2-image-captioning", label: "ViT-GPT2 (HF)", provider: "huggingface" },
  { id: "google/gemini-1.5-flash-8b", label: "Gemini Flash 8B (Google)", provider: "google" },
];

/** "auto" tries all HF models in order */
export const AI_MODEL_AUTO = "auto";

const HF_MODELS = [
  "Salesforce/blip-image-captioning-large",
  "Salesforce/blip-image-captioning-base",
  "nlpconnect/vit-gpt2-image-captioning",
];

async function hfImageToText(token: string, imageBytes: Uint8Array, models?: string[]): Promise<string> {
  for (const model of (models ?? HF_MODELS)) {
    try {
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: imageBytes,
        }
      );
      if (res.status === 503) {
        // Model is loading – wait and retry once
        const info = await res.json().catch(() => ({}));
        const wait = Math.min((info.estimated_time ?? 20) * 1000, 30000);
        await new Promise(r => setTimeout(r, wait));
        const retry = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: imageBytes }
        );
        if (retry.ok) {
          const data = await retry.json();
          const caption = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
          if (caption) return caption;
        }
        continue;
      }
      if (!res.ok) continue;
      const data = await res.json();
      const caption = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
      if (caption) return caption;
    } catch {
      continue;
    }
  }
  return "";
}

function parseCaption(caption: string) {
  const c = caption.trim();
  // Try to infer a category from common keywords
  const lower = c.toLowerCase();
  const categoryMap: Record<string, string> = {
    bag: "Bags & Accessories", shoe: "Footwear", dress: "Clothing", shirt: "Clothing",
    necklace: "Jewelry", bracelet: "Jewelry", ring: "Jewelry", earring: "Jewelry",
    pot: "Pottery", vase: "Pottery", bowl: "Pottery", plate: "Kitchenware",
    rug: "Textiles", carpet: "Textiles", scarf: "Textiles", fabric: "Textiles",
    lamp: "Home Décor", candle: "Home Décor", basket: "Handicraft", wood: "Woodwork",
  };
  let category = "Handicraft";
  for (const [kw, cat] of Object.entries(categoryMap)) {
    if (lower.includes(kw)) { category = cat; break; }
  }

  // Build a friendly product name from the caption
  const name = c.length > 60 ? c.slice(0, 57) + "…" : c || "Marketplace Item";

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    description: c || "Beautiful handcrafted item.",
    category,
    dimensions: "Standard",
    price_inr: "500",
    tags: ["handmade", category.toLowerCase().split(" ")[0]],
  };
}

export async function analyzeProduct(base64: string, _mime: string, _lang?: string, modelId?: string): Promise<any> {
  const chosenModel = AI_MODELS.find(m => m.id === modelId);

  // --- Google route ---
  if (chosenModel?.provider === "google") {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      return { name: "Key Missing", description: "Set VITE_GEMINI_API_KEY in your .env file." };
    }
    return geminiLegacy(base64, _mime);
  }

  // --- HF route ---
  const token = import.meta.env.VITE_HF_TOKEN;
  if (!token) {
    // No HF token – try Gemini as fallback if available
    if (import.meta.env.VITE_GEMINI_API_KEY) return geminiLegacy(base64, _mime);
    return { name: "Token Missing", description: "Set VITE_HF_TOKEN or VITE_GEMINI_API_KEY in your .env file." };
  }

  try {
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));

    let caption: string;
    if (chosenModel && chosenModel.provider === "huggingface") {
      // Use the single chosen model
      caption = await hfImageToText(token, bytes, [chosenModel.id]);
    } else {
      // Auto: try all HF models in order
      caption = await hfImageToText(token, bytes);
    }

    if (!caption) {
      return {
        name: "Analysis Unavailable",
        description: "HF models are loading. Please try again in 30 seconds.",
      };
    }
    return parseCaption(caption);
  } catch (err: any) {
    return {
      name: "Analysis Error",
      description: `HF error: ${err.message?.slice(0, 80) || "Unknown"}. Retry shortly.`,
    };
  }
}

// Legacy Gemini fallback (kept for users who already have a Gemini key)
async function geminiLegacy(base64: string, mime: string) {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    const result = await model.generateContent([
      "Identify product: Name, Category, Description.",
      { inlineData: { data: base64.split(",").pop()!, mimeType: mime } },
    ]);
    const text = result.response.text();
    const lines = text.split("\n");
    return {
      name: lines[0]?.replace(/Name: /i, "").trim() || "Marketplace Item",
      description: text.slice(0, 150),
      category: "Handicraft",
      dimensions: "Standard",
      price_inr: "500",
      tags: ["handmade"],
    };
  } catch (err: any) {
    return {
      name: "Server Busy",
      description: `Google error: ${err.message?.slice(0, 50) || "Unknown"}. Try again in 10 mins.`,
    };
  }
}
