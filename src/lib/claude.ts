import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AnalyzedProduct {
  name: string;
  description: string;
  category: string;
  dimensions: string;
  price_inr: string;
  tags: string[];
}

export async function analyzeProduct(
  base64: string,
  mime: string,
  lang: string
): Promise<AnalyzedProduct> {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!geminiKey) {
    return { ...performOfflineAnalysis(), name: "Key Not Found" };
  }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const prompt = "Analyze this image. Return Name, Category, and Description.";
  const imageData = {
    inlineData: {
      data: base64.split(',').pop() || base64,
      mimeType: mime
    }
  };

  // --- Loop 1: Primary Model (Gemini 1.5 Flash) ---
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([prompt, imageData]);
    return parseTextResponse(result.response.text());
  } catch (err) {
    console.warn("Primary model failed, retrying with lighter model...", err);

    // --- Loop 2: Cheaper/Faster Model (Gemini 1.5 Flash-8B) ---
    try {
      const cheapModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
      const result = await cheapModel.generateContent([prompt, imageData]);
      return parseTextResponse(result.response.text());
    } catch (retryErr: any) {
      console.error("All models failed:", retryErr);
      
      let errorLabel = "AI is Busy";
      if (retryErr.message?.includes("429")) errorLabel = "Rate Limit (Wait 1m)";
      if (retryErr.message?.includes("safety")) errorLabel = "Safety Blocked";
      
      return { ...performOfflineAnalysis(), name: errorLabel };
    }
  }
}

// Helper to turn AI text into our product object
function parseTextResponse(text: string): AnalyzedProduct {
  const lines = text.split('\n');
  return {
    name: lines[0].replace(/Name: /i, "").trim() || "Analyzed Item",
    description: text.slice(0, 200).trim(),
    category: "General",
    dimensions: "Standard",
    price_inr: "999",
    tags: ["ai-generated", "automatic"]
  };
}

function performOfflineAnalysis(): AnalyzedProduct {
  return {
    name: "Handcrafted Product",
    description: "Authentic item made with traditional techniques.",
    category: "Handicraft",
    dimensions: "Varies",
    price_inr: "250-1000",
    tags: ["handmade", "traditional"],
  };
}
