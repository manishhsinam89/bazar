export const config = { runtime: "edge" };

// New HF Inference Providers API (router.huggingface.co)
// Old api-inference.huggingface.co is deprecated/dead as of 2025+

const HF_MODELS = [
  "Salesforce/blip-image-captioning-large",
  "Salesforce/blip-image-captioning-base",
  "nlpconnect/vit-gpt2-image-captioning",
];

const CATEGORY_MAP = {
  bag: "Bags & Accessories", shoe: "Footwear", dress: "Clothing", shirt: "Clothing",
  necklace: "Jewelry", bracelet: "Jewelry", ring: "Jewelry", earring: "Jewelry",
  pot: "Pottery", vase: "Pottery", bowl: "Pottery", plate: "Kitchenware",
  rug: "Textiles", carpet: "Textiles", scarf: "Textiles", fabric: "Textiles",
  lamp: "Home Décor", candle: "Home Décor", basket: "Handicraft", wood: "Woodwork",
};

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { image, mime, modelId } = await request.json();
    if (!image) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    const HF_TOKEN = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN;
    const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    // --- Google route ---
    if (modelId?.startsWith("google/") && GEMINI_KEY) {
      return geminiAnalyze(image, mime, GEMINI_KEY);
    }

    // --- HF route via new router API ---
    if (HF_TOKEN) {
      const models = modelId && !modelId.startsWith("google/") ? [modelId] : HF_MODELS;
      let lastErr = "";

      for (const model of models) {
        try {
          // New HF Inference Providers endpoint
          const url = `https://router.huggingface.co/hf-inference/models/${model}`;
          console.log("HF request:", url);

          const binaryStr = atob(image);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

          const hfRes = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${HF_TOKEN}`,
            },
            body: bytes,
          });

          const bodyText = await hfRes.text();
          console.log(`HF ${model}: ${hfRes.status} ${bodyText.slice(0, 300)}`);

          if (hfRes.status !== 200) {
            lastErr = `${model}: ${hfRes.status} ${bodyText.slice(0, 120)}`;
            continue;
          }

          const data = JSON.parse(bodyText);
          const caption = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
          if (caption) {
            return Response.json(parseCaption(caption));
          }
          if (data?.error) {
            lastErr = `${model}: ${data.error}`;
            continue;
          }
          lastErr = `${model}: no caption in response`;
        } catch (e) {
          lastErr = `${model}: ${e.message}`;
          console.warn(`HF ${model} error:`, e.message);
          continue;
        }
      }

      if (!modelId?.startsWith("google/")) {
        // If HF failed, try Gemini as fallback
        if (GEMINI_KEY) {
          console.log("HF failed, trying Gemini fallback. Last HF error:", lastErr);
          return geminiAnalyze(image, mime, GEMINI_KEY);
        }
        return Response.json({
          name: "HF Analysis Failed",
          description: `${lastErr}. Try Gemini or retry in 30s.`,
          category: "Handicraft", dimensions: "Standard", price_inr: "500", tags: ["handmade"],
        }, { status: 502 });
      }
    }

    // Gemini direct
    if (GEMINI_KEY) return geminiAnalyze(image, mime, GEMINI_KEY);

    return Response.json({ name: "No AI", description: "Configure HF_TOKEN or GEMINI_API_KEY" }, { status: 500 });

  } catch (e) {
    return Response.json({
      name: "Server Error",
      description: `${e.message?.slice(0, 120)}`,
      category: "Handicraft", dimensions: "Standard", price_inr: "500", tags: ["handmade"],
    }, { status: 500 });
  }
}

async function geminiAnalyze(base64, mime, key) {
  try {
    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: "Identify this product. Reply with exactly 3 lines:\nName: <name>\nCategory: <category>\nDescription: <description>" },
            { inlineData: { mimeType: mime || "image/jpeg", data: base64 } },
          ]}],
        }),
      }
    );
    const bodyText = await gRes.text();
    if (gRes.status !== 200) {
      return Response.json({
        name: "Gemini Error", description: `API ${gRes.status}: ${bodyText.slice(0, 100)}`,
        category: "Handicraft", dimensions: "Standard", price_inr: "500", tags: ["handmade"],
      }, { status: gRes.status });
    }
    const json = JSON.parse(bodyText);
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const lines = text.split("\n").filter(l => l.trim());
    const get = (rx) => (lines.find(l => rx.test(l)) || "").replace(rx, "").trim();
    return Response.json({
      name: get(/^name:\s*/i) || lines[0]?.trim() || "Marketplace Item",
      description: get(/^description:\s*/i) || text.slice(0, 150),
      category: get(/^category:\s*/i) || "Handicraft",
      dimensions: "Standard",
      price_inr: "500",
      tags: ["handmade"],
    });
  } catch (e) {
    return Response.json({
      name: "Gemini Error", description: `Network: ${e.message?.slice(0, 80)}`,
      category: "Handicraft", dimensions: "Standard", price_inr: "500", tags: ["handmade"],
    }, { status: 502 });
  }
}

function parseCaption(c) {
  c = c.trim();
  const lower = c.toLowerCase();
  let category = "Handicraft";
  for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(kw)) { category = cat; break; }
  }
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
