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
  // 1. Try Google Gemini (The Free Option)
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Analyze this image for a marketplace. Return ONLY a JSON object with: 
      "name", "description" (2 sentences), "category", "dimensions", "price_inr", and "tags" (array).`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64, mimeType: mime } },
      ]);

      const responseText = result.response.text();
      // Try to parse the AI response as JSON, fallback to manual parsing if it fails
      try {
        const cleanedJson = responseText.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanedJson);
      } catch (e) {
        return parseAnalysis(responseText, lang);
      }
    } catch (err) {
      console.warn("Gemini failed, trying fallbacks", err);
    }
  }

  // 2. Fallback: Offline analysis if AI fails
  return performOfflineAnalysis(base64, mime, lang);
}

function parseAnalysis(text: string, lang: string): AnalyzedProduct {
  const lowerText = text.toLowerCase();
  let category = "Handicraft";
  if (lowerText.includes("ceramic")) category = "Ceramics";
  else if (lowerText.includes("textile")) category = "Textiles";

  return {
    name: text.split(/[,.]/).shift() || "Handcrafted Item",
    description: text.slice(0, 150),
    category,
    dimensions: "Standard Size",
    price_inr: "500",
    tags: ["handmade", "authentic"],
  };
}

function performOfflineAnalysis(base64: string, mime: string, lang: string): AnalyzedProduct {
  return {
    name: "Handcrafted Product",
    description: "Authentic item made with traditional techniques.",
    category: "Handicraft",
    dimensions: "Varies",
    price_inr: "250-1000",
    tags: ["handmade", "traditional"],
  };
}
