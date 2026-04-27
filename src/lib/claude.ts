import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AnalyzedProduct {
  name: string;
  description: string;
  category: string;
  dimensions: string;
  price_inr: string;
  tags: string[];
}

// Helper to pause execution
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function analyzeProduct(
  base64: string,
  mime: string,
  lang: string
): Promise<AnalyzedProduct> {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!geminiKey) return { ...performOfflineAnalysis(), name: "Key Missing" };

  const genAI = new GoogleGenerativeAI(geminiKey);
  const prompt = "Identify this product. Provide Name, Category, and Description.";
  const imageData = {
    inlineData: { data: base64.split(',').pop() || base64, mimeType: mime }
  };

  // List of models to try in order of speed/availability
  const models = ["gemini-1.5-flash-8b", "gemini-1.5-flash", "gemini-1.5-pro"];

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([prompt, imageData]);
      const text = result.response.text();
      if (text) return parseTextResponse(text);
    } catch (err: any) {
      console.warn(`${modelName} failed, waiting 2s before next attempt...`);
      
      // If it's a safety block, don't bother retrying
      if (err.message?.includes("safety")) {
        return { ...performOfflineAnalysis(), name: "Safety Blocked" };
      }
      
      await sleep(2000); // Wait 2 seconds for the rate limit to cool down
    }
  }

  return { ...performOfflineAnalysis(), name: "Server Busy (Try again in 10s)" };
}

function parseTextResponse(text: string): AnalyzedProduct {
  const lines = text.split('\n').filter(l => l.trim() !== "");
  return {
    name: lines[0].replace(/Name:|[*]/gi, "").trim().slice(0, 50) || "Artisan Item",
    description: text.slice(0, 250).trim(),
    category: "Marketplace",
    dimensions: "Standard",
    price_inr: "999",
    tags: ["handcrafted", "authentic"]
  };
}

function performOfflineAnalysis(): AnalyzedProduct {
  return {
    name: "Processing...",
    description: "AI is currently busy. Please wait a moment and try again.",
    category: "General",
    dimensions: "Varies",
    price_inr: "---",
    tags: ["retry-needed"]
  };
}
