#!/usr/bin/env node

const REPLICATE_TOKEN = "r8_YnAVGKU6TeJUpHSmcYsZSAfuiv16DY83NyQ1U";
const testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

async function testReplicateAPI() {
  console.log("🧪 Testing Replicate API with your token...\n");

  try {
    console.log("📤 Creating prediction with BLIP image-captioning model...");
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "salesforce/blip",
        input: {
          image: `data:image/png;base64,${testImageBase64}`,
          task: "image_captioning",
        },
      }),
    });

    console.log(`Status: ${response.status}\n`);

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ Error:");
      console.error(error);
      return;
    }

    const prediction = await response.json();
    console.log("✅ Prediction Created!");
    console.log("Prediction ID:", prediction.id);
    console.log("Status:", prediction.status);
    console.log("Get URL:", prediction.urls.get);
    console.log("\n⏳ Polling for result (max 30 seconds)...");

    // Poll for completion
    let result = prediction;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 500));
      
      const checkResponse = await fetch(prediction.urls.get, {
        headers: { "Authorization": `Token ${REPLICATE_TOKEN}` },
      });
      
      result = await checkResponse.json();
      
      if (result.status === "succeeded" || result.status === "failed") {
        break;
      }
      
      process.stdout.write(".");
    }

    console.log("\n");
    if (result.status === "succeeded") {
      console.log("✅ Prediction Succeeded!");
      console.log("Output:", JSON.stringify(result.output, null, 2));
    } else if (result.status === "failed") {
      console.log("❌ Prediction Failed:");
      console.log(JSON.stringify(result.error, null, 2));
    } else {
      console.log("⏱️  Still processing, check back later");
    }

  } catch (error) {
    console.error("❌ Connection Failed:");
    console.error(error.message);
  }
}

testReplicateAPI();
