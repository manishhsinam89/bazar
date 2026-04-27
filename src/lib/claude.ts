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
  { id: "google/gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (Google)", provider: "google" },
];

/** "auto" tries all HF models in order */
export const AI_MODEL_AUTO = "auto";

const HF_MODELS = [
  "Salesforce/blip-image-captioning-large",
  "Salesforce/blip-image-captioning-base",
  "nlpconnect/vit-gpt2-image-captioning",
];

async function hfImageToText(token: string, imageBytes: Uint8Array, models?: string[]): Promise<string> {
  const blob = new Blob([imageBytes.buffer as ArrayBuffer]);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "x-wait-for-model": "true",          // tells HF to wait for cold models instead of 503
  };
  for (const model of (models ?? HF_MODELS)) {
    try {
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        { method: "POST", headers, body: blob }
      );
      if (!res.ok) {
        // Log for debugging, skip to next model
        console.warn(`HF ${model}: ${res.status} ${await res.text().catch(() => "")}`);
        continue;
      }
      const data = await res.json();
      const caption = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
      if (caption) return caption;
    } catch (e: any) {
      console.warn(`HF ${model} fetch error:`, e.message);
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

// Gemini via direct REST API (no SDK dependency)
async function geminiLegacy(base64: string, mime: string) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  try {
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Identify this product. Reply with exactly 3 lines:\nName: <product name>\nCategory: <category>\nDescription: <short description>" },
              { inlineData: { mimeType: mime, data: raw } },
            ],
          }],
        }),
      }
    );
    if (!res.ok) {
      const errBody = await res.text();
      return { name: "Gemini Error", description: `API ${res.status}: ${errBody.slice(0, 80)}` };
    }
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const lines = text.split("\n").filter((l: string) => l.trim());
    const nameLine = lines.find((l: string) => /^name:/i.test(l)) || lines[0] || "";
    const descLine = lines.find((l: string) => /^desc/i.test(l)) || lines[2] || "";
    const catLine = lines.find((l: string) => /^cat/i.test(l)) || lines[1] || "";
    return {
      name: nameLine.replace(/^name:\s*/i, "").trim() || "Marketplace Item",
      description: descLine.replace(/^description:\s*/i, "").trim() || text.slice(0, 150),
      category: catLine.replace(/^category:\s*/i, "").trim() || "Handicraft",
      dimensions: "Standard",
      price_inr: "500",
      tags: ["handmade"],
    };
  } catch (err: any) {
    return {
      name: "Gemini Error",
      description: `Network error: ${err.message?.slice(0, 80) || "Unknown"}. Check your connection.`,
    };
  }
}
