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
  // Use Hugging Face nano-banana model for analysis
  const response = await fetch("https://api-inference.huggingface.co/models/nanobana/nanobana", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: {
        image: `data:${mime};base64,${base64}`,
        question: `Analyze this product image and provide details in ${lang === 'es' ? 'Spanish' : 'English'}. Include: product name, description, category, estimated dimensions, price range in INR, and relevant tags. Format as JSON with keys: name, description, category, dimensions, price_inr, tags.`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("AI analysis failed");
  }

  const result = await response.json();

  // Parse the AI response (assuming it returns structured data)
  try {
    const analysis = typeof result === 'string' ? JSON.parse(result) : result;

    return {
      name: analysis.name || "Handcrafted Product",
      description: analysis.description || "Beautiful handcrafted item",
      category: analysis.category || "Handicraft",
      dimensions: analysis.dimensions || "Various sizes",
      price_inr: analysis.price_inr || "200-1000",
      tags: Array.isArray(analysis.tags) ? analysis.tags : ["handmade", "traditional"],
    };
  } catch (parseError) {
    // Fallback if AI response isn't properly formatted
    return {
      name: "Handcrafted Product",
      description: "Beautiful handcrafted item with traditional craftsmanship",
      category: "Handicraft",
      dimensions: "Various sizes available",
      price_inr: "200-1000",
      tags: ["handmade", "traditional", "craft"],
    };
  }
}
