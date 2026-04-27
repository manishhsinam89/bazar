import https from "node:https";

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: { ...headers, "Content-Length": body.length },
    };
    const req = https.request(opts, (resp) => {
      let data = "";
      resp.on("data", (chunk) => (data += chunk));
      resp.on("end", () => {
        resolve({ status: resp.statusCode, body: data });
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const HF_TOKEN = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN;
    const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!HF_TOKEN && !GEMINI_KEY) {
      return res.status(500).json({ error: "No AI tokens configured. Set VITE_HF_TOKEN or VITE_GEMINI_API_KEY in Vercel env vars." });
    }

    // Vercel auto-parses JSON body, but handle both cases
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { image, mime, modelId } = body || {};
    if (!image) {
      return res.status(400).json({ error: "No image provided", receivedKeys: Object.keys(body || {}) });
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
        const hfUrl = `https://api-inference.huggingface.co/models/${model}`;
        console.log(`HF URL: ${hfUrl}`);
        const hfRes = await httpsPost(hfUrl, {
          Authorization: `Bearer ${HF_TOKEN}`,
          "x-wait-for-model": "true",
          "Content-Type": "application/octet-stream",
        }, imageBytes);

        console.log(`HF ${model} status: ${hfRes.status}, body: ${hfRes.body.slice(0, 200)}`);

        if (hfRes.status !== 200) {
          lastHfError = `${model}: HTTP ${hfRes.status} - ${hfRes.body.slice(0, 150)}`;
          console.warn("HF error:", lastHfError);
          continue;
        }

        const data = JSON.parse(hfRes.body);
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
  } catch (e) {
    console.error("analyze handler crash:", e);
    return res.status(500).json({
      name: "Server Error",
      description: `Internal error: ${e.message?.slice(0, 100) || "Unknown"}`,
    });
  }
}

async function geminiAnalyze(res, base64, mime, key) {
  try {
    const gBody = JSON.stringify({
      contents: [{
        parts: [
          { text: "Identify this product. Reply with exactly 3 lines:\nName: <product name>\nCategory: <category>\nDescription: <short description>" },
          { inlineData: { mimeType: mime || "image/jpeg", data: base64 } },
        ],
      }],
    });
    const gRes = await httpsPost(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`,
      { "Content-Type": "application/json" },
      Buffer.from(gBody)
    );
    if (gRes.status !== 200) {
      return res.status(gRes.status).json({
        name: "Gemini Error",
        description: `API ${gRes.status}: ${gRes.body.slice(0, 100)}`,
      });
    }
    const json = JSON.parse(gRes.body);
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
