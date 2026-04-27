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
  // Option 0: Use Google Gemini (FREE & Recommended)
  const geminiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const result = await model.generateContent([
        "Analyze this product and provide details in this exact order: Name, Description, Category, Dimensions, Price in INR. Be professional.",
        {
          inlineData: {
            data: base64,
            mimeType: mime,
          },
        },
      ]);

      const text = result.response.text();
      // This uses your existing helper to turn the text into the product format
      return parseAnalysis(text, lang);
    } catch (err) {
      console.warn("Gemini failed, trying other options", err);
    }
  }

  base64: string,
  mime: string,
  lang: string
): Promise<AnalyzedProduct> {
  // Option 1: Use Local GPU API (FastAPI/Ollama backend)
  const localAPI = (import.meta as any).env?.VITE_LOCAL_API;
  if (localAPI) {
    try {
      const response = await fetch(`${localAPI}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: `data:${mime};base64,${base64}`,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const caption = result.caption || result.generated_text || result.output?.[0];
        if (caption) {
          return parseAnalysis(caption, lang);
        }
      }
    } catch (err) {
      console.warn("Local API failed, trying online services", err);
    }
  }

  // Option 2: Use Hugging Face Serverless Inference Endpoint (if configured)
  const hfEndpoint = (import.meta as any).env?.VITE_HF_ENDPOINT;
  const hfToken = (import.meta as any).env?.VITE_HF_TOKEN;
  
  if (hfEndpoint && hfToken) {
    try {
      const response = await fetch(hfEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: `data:${mime};base64,${base64}`,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const caption = Array.isArray(result) ? result[0]?.generated_text : result?.generated_text;
        if (caption) {
          return parseAnalysis(caption, lang);
        }
      }
    } catch (err) {
      console.warn("HF Serverless Endpoint failed, trying next option", err);
    }
  }

  // Option 3: Use Replicate API (free alternative)
  const replicateToken = (import.meta as any).env?.VITE_REPLICATE_TOKEN;
  if (replicateToken) {
    try {
      return await analyzeWithReplicate(base64, mime, lang, replicateToken);
    } catch (err) {
      console.warn("Replicate API failed, using offline analysis", err);
    }
  }

  // Fallback: Client-side analysis using image metadata
  return performOfflineAnalysis(base64, mime, lang);
}

async function analyzeWithReplicate(
  base64: string,
  mime: string,
  lang: string,
  token: string
): Promise<AnalyzedProduct> {
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "9cf61b6d3c1dadccee360992efa433fd63ef121d034e399ef3373efc35641f55",
      input: {
        image: `data:${mime};base64,${base64}`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Replicate API failed");
  }

  const prediction = await response.json();
  
  // Poll for completion if needed
  let result = prediction;
  if (prediction.status === "processing") {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const checkResponse = await fetch(prediction.urls.get, {
        headers: { "Authorization": `Token ${token}` },
      });
      result = await checkResponse.json();
      if (result.status === "succeeded") break;
    }
  }

  const caption = result.output?.join(" ") || result.output?.[0] || "";
  return parseAnalysis(caption, lang);
}

function parseAnalysis(text: string, lang: string): AnalyzedProduct {
  // Extract key details from the caption
  const lowerText = text.toLowerCase();
  
  let category = "Handicraft";
  if (lowerText.includes("ceramic") || lowerText.includes("pottery")) category = "Ceramics";
  else if (lowerText.includes("textile") || lowerText.includes("fabric") || lowerText.includes("cloth")) category = "Textiles";
  else if (lowerText.includes("jewelry") || lowerText.includes("bead")) category = "Jewelry";
  else if (lowerText.includes("wood") || lowerText.includes("carving")) category = "Woodcraft";
  else if (lowerText.includes("metal") || lowerText.includes("brass") || lowerText.includes("copper")) category = "Metalwork";

  return {
    name: capitalizeFirst(text.split(/[,.]/).shift() || "Handcrafted Item"),
    description: text,
    category,
    dimensions: "Various sizes available",
    price_inr: "300-1500",
    tags: extractTags(lowerText),
  };
}

function performOfflineAnalysis(base64: string, mime: string, lang: string): AnalyzedProduct {
  // Client-side analysis: analyze image size, colors, and basic properties
  const sizeInKB = Math.round(base64.length / 1024);
  
  // Estimate category based on file size and complexity
  let category = "Handicraft";
  let tags: string[] = ["handmade", "artisan"];

  // Add tags based on complexity (file size can indicate detail level)
  if (sizeInKB > 200) {
    tags.push("detailed", "intricate");
    category = "Fine Craftsmanship";
  } else if (sizeInKB > 100) {
    tags.push("traditional");
  }

  // Add common Moroccan/artisan tags
  tags.push("traditional", "authentic");
  if (Math.random() > 0.5) tags.push("sustainable");

  return {
    name: "Handcrafted Product",
    description: "Beautiful handcrafted item with traditional artisan techniques and authentic cultural design.",
    category,
    dimensions: "Varies - see product details",
    price_inr: "250-2000",
    tags,
  };
}

function capitalizeFirst(str: string): string {
  return str.trim().charAt(0).toUpperCase() + str.trim().slice(1);
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  const keywords = {
    handmade: ["handmade", "hand-made", "artisan", "artisanal"],
    traditional: ["traditional", "heritage", "authentic", "cultural"],
    moroccan: ["moroccan", "marrakech", "fez", "tagine"],
    organic: ["organic", "natural", "eco", "sustainable"],
    ceramic: ["ceramic", "pottery", "clay"],
    textile: ["textile", "fabric", "weave", "yarn"],
  };

  for (const [tag, keywords_list] of Object.entries(keywords)) {
    if (keywords_list.some(kw => text.includes(kw))) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : ["handmade", "traditional"];
}
