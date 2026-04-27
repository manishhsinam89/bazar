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
  // Use the most direct way to get the key in Vite
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (geminiKey && geminiKey.length > 5) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // We ask for a clear string if JSON fails
      const prompt = "Analyze this image. Return ONLY a JSON object with keys: name, description, category, dimensions, price_inr, tags. Ensure it is valid JSON.";

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64, mimeType: mime } },
      ]);

      const responseText = await result.response.text();
      
      // Clean the string in case Gemini adds ```json markdown
      const cleanedJson = responseText.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanedJson);

    } catch (err) {
      console.error("Gemini Error:", err);
      // If Gemini fails, we go to fallback but change the name so we know it failed
      return { ...performOfflineAnalysis(), name: "AI Analysis Failed (Check Key)" };
    }
  }

  // If we reach here, the Key was never found
  return { ...performOfflineAnalysis(), name: "Key Not Found in Vercel" };
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
