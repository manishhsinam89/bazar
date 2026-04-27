import { GoogleGenerativeAI } from "@google/generative-ai";

export async function analyzeProduct(base64: string, mime: string): Promise<any> {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!geminiKey) return { name: "Key Missing" };

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });

  try {
    // We send a tiny request to avoid 'Busy' errors
    const result = await model.generateContent([
      "Identify product: Name, Category, Description.",
      { inlineData: { data: base64.split(',').pop()!, mimeType: mime } }
    ]);

    const text = result.response.text();
    const lines = text.split('\n');

    return {
      name: lines[0]?.replace(/Name: /i, "").trim() || "Marketplace Item",
      description: text.slice(0, 150),
      category: "Handicraft",
      dimensions: "Standard",
      price_inr: "500",
      tags: ["handmade"]
    };
  } catch (err: any) {
    // If it still says Busy, we show the exact Google error code
    return { 
      name: "Server Busy", 
      description: `Google error: ${err.message?.slice(0, 50) || "Unknown"}. Try again in 10 mins.` 
    };
  }
}
