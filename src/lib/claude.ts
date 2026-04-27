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

  if (!geminiKey || !geminiKey.startsWith("AIza")) {
    return { ...performOfflineAnalysis(), name: "Invalid API Key Format" };
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    // Using 1.5-flash because it is the fastest and most reliable for free tier
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // We keep the prompt simple to avoid parsing errors
    const prompt = "Identify this product. Respond with Name, Category, and Description.";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64.split(',').pop() || base64, // Ensures we only send the raw base64
          mimeType: mime
        }
      },
    ]);

    const response = await result.response;
    const text = response.text();

    return {
      name: text.split('\n')[0].replace(/Name: /i, "").slice(0, 50) || "Handcrafted Item",
      description: text.slice(0, 200),
      category: "Handicraft",
      dimensions: "Standard",
      price_inr: "999",
      tags: ["handmade", "authentic"]
    };

  } catch (err: any) {
    console.error("Gemini Error:", err);
    // If the error contains '403', your key is likely restricted or disabled
    return { 
      ...performOfflineAnalysis(), 
      name: err.message?.includes("403") ? "Key Permissions Error" : "Google AI is Busy" 
    };
  }
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
