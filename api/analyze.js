export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const HF_TOKEN = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN;
  const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!HF_TOKEN && !GEMINI_KEY) {
    return res.status(500).json({ error: "No AI tokens configured" });
  }

  const { image, mime, modelId } = req.body;
  if (!image) {
    return res.status(400).json({ error: "No image provided" });
  }

  const imageBytes = Buffer.from(image, "base64");

  // --- Google route ---
  if (modelId?.startsWith("google/") && GEMINI_KEY) {
    return await geminiAnalyze(res, image, mime, GEMINI_KEY);
  }

  // --- HF route ---
  if (HF_TOKEN) {
    const HF_MODELS = [
      "Salesforce/blip-image-captioning-large",
      "Salesforce/blip-image-captioning-base",
      "nlpconnect/vit-gpt2-image-captioning",
    ];
    const models = modelId && !modelId.startsWith("google/") ? [modelId] : HF_MODELS;
    let lastHfError = "";

    for (const model of models) {
      try {
        console.log(`Trying HF model: ${model}`);
        const hfRes = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${HF_TOKEN}`,
              "x-wait-for-model": "true",
            },
            body: imageBytes,
          }
        );

        if (!hfRes.ok) {
          const errText = await hfRes.text().catch(() => "");
          lastHfError = `${model}: HTTP ${hfRes.status} - ${errText.slice(0, 150)}`;
          console.warn("HF error:", lastHfError);
          continue;
        }

        const data = await hfRes.json();
        console.log(`HF ${model} response:`, JSON.stringify(data).slice(0, 300));
        let caption = "";
        if (Array.isArray(data) && data[0]?.generated_text) {
          caption = data[0].generated_text;
        } else if (data?.generated_text) {
          caption = data.generated_text;
        } else if (data?.error) {
          lastHfError = `${model}: ${data.error}`;
          console.warn("HF model error:", lastHfError);
          continue;
        }

        if (caption) {
          console.log(`HF success: ${model} -> "${caption.slice(0, 80)}"`);
          return res.status(200).json(parseCaption(caption));
        }
        lastHfError = `${model}: no caption in response`;
      } catch (e) {
        lastHfError = `${model}: ${e.message}`;
        console.warn(`HF ${model} fetch error:`, e.message);
        continue;
      }
    }

    // Don't fall through to Gemini silently — return HF error
    if (!modelId?.startsWith("google/")) {
      return res.status(502).json({
        name: "HF Analysis Failed",
        description: `HF error: ${lastHfError}. Try selecting Gemini from the dropdown, or retry in 30s.`,
      });
    }
  }

  // --- Gemini fallback (only if explicitly chosen or no HF token) ---
  if (GEMINI_KEY) {
    return await geminiAnalyze(res, image, mime, GEMINI_KEY);
  }

  return res.status(502).json({
    name: "Analysis Unavailable",
    description: "All AI models failed. Try again later.",
  });
}

async function geminiAnalyze(res, base64, mime, key) {
  try {
    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Identify this product. Reply with exactly 3 lines:\nName: <product name>\nCategory: <category>\nDescription: <short description>" },
              { inlineData: { mimeType: mime || "image/jpeg", data: base64 } },
            ],
          }],
        }),
      }
    );
    if (!gRes.ok) {
      const errBody = await gRes.text();
      return res.status(gRes.status).json({
        name: "Gemini Error",
        description: `API ${gRes.status}: ${errBody.slice(0, 100)}`,
      });
    }
    const json = await gRes.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const lines = text.split("\n").filter((l) => l.trim());
    const nameLine = lines.find((l) => /^name:/i.test(l)) || lines[0] || "";
    const descLine = lines.find((l) => /^desc/i.test(l)) || lines[2] || "";
    const catLine = lines.find((l) => /^cat/i.test(l)) || lines[1] || "";
    return res.status(200).json({
      name: nameLine.replace(/^name:\s*/i, "").trim() || "Marketplace Item",
      description: descLine.replace(/^description:\s*/i, "").trim() || text.slice(0, 150),
      category: catLine.replace(/^category:\s*/i, "").trim() || "Handicraft",
      dimensions: "Standard",
      price_inr: "500",
      tags: ["handmade"],
    });
  } catch (e) {
    return res.status(502).json({
      name: "Gemini Error",
      description: `Network error: ${e.message?.slice(0, 80)}`,
    });
  }
}

function parseCaption(caption) {
  const c = caption.trim();
  const lower = c.toLowerCase();
  const categoryMap = {
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
