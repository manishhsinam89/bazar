#!/usr/bin/env node

// Test script for Hugging Face API connection
const HF_TOKEN = "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";

// Create a small test image (1x1 white pixel PNG)
const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

console.log("🔐 Token Details:");
console.log(`Token: ${HF_TOKEN}`);
console.log(`Length: ${HF_TOKEN.length}`);
console.log(`Starts with 'hf_': ${HF_TOKEN.startsWith('hf_')}\n`);

async function testHuggingFaceAPI() {
  console.log("🧪 Testing different HF API endpoints...\n");

  // Test 1: Direct Inference Endpoint (most common)
  try {
    console.log("1️⃣  Testing direct inference endpoint (image-to-text)...");
    const response = await fetch(
      "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
        },
        body: Buffer.from(testImageBase64, "base64"),
      }
    );

    console.log(`Status: ${response.status}`);
    const responseText = await response.text();
    console.log("Response:", responseText);
    console.log();
  } catch (err) {
    console.error("Error:", err.message, "\n");
  }

  // Test 2: Try with nlpconnect model (lightweight)
  try {
    console.log("2️⃣  Testing lightweight image captioning model...");
    const response = await fetch(
      "https://api-inference.huggingface.co/models/nlpconnect/vit-gpt2-image-captioning",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
        },
        body: Buffer.from(testImageBase64, "base64"),
      }
    );

    console.log(`Status: ${response.status}`);
    const responseText = await response.text();
    console.log("Response:", responseText);
    console.log();
  } catch (err) {
    console.error("Error:", err.message, "\n");
  }

  // Test 3: Check for permission/error details
  try {
    console.log("3️⃣  Checking token permissions with simple text model...");
    const response = await fetch(
      "https://api-inference.huggingface.co/models/gpt2",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: "moroccan",
        }),
      }
    );

    console.log(`Status: ${response.status}`);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
    console.log();
  } catch (err) {
    console.error("Error:", err.message, "\n");
  }

  // Test 4: Alternative - use Hugging Face serverless inference (requires paid plan)
  try {
    console.log("4️⃣  Testing serverless inference API...");
    const response = await fetch(
      "https://huggingface.co/api/models/Salesforce/blip-image-captioning-base",
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
        },
      }
    );

    console.log(`Status: ${response.status}`);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testHuggingFaceAPI();
