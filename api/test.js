export const config = { runtime: "edge" };

export default async function handler(request) {
  const HF_TOKEN = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN || "none";
  const testUrl = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base";

  try {
    const res = await fetch(testUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}` },
      body: new Uint8Array([0x89, 0x50, 0x4E, 0x47]),  // PNG header bytes
    });
    const text = await res.text();
    return Response.json({
      ok: true,
      tokenPresent: HF_TOKEN !== "none",
      tokenPrefix: HF_TOKEN.slice(0, 6),
      fetchedUrl: testUrl,
      status: res.status,
      responseSnippet: text.slice(0, 300),
    });
  } catch (e) {
    return Response.json({
      ok: false,
      error: e.message,
      tokenPresent: HF_TOKEN !== "none",
    });
  }
}
