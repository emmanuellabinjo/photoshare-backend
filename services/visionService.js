const axios = require("axios");

/**
 * Analyse an image URL using Azure AI Vision (Computer Vision).
 * Returns { tags: string[], caption: string }
 */
async function analyseImage(imageUrl) {
  const endpoint = process.env.VISION_ENDPOINT?.replace(/\/$/, "");
  const key = process.env.VISION_KEY;

  if (!endpoint || !key) {
    console.warn("[VISION] Credentials not configured — skipping AI analysis.");
    return { tags: [], caption: "" };
  }

  try {
    const url = `${endpoint}/vision/v3.2/analyze?visualFeatures=Tags,Description&language=en`;

    const response = await axios.post(
      url,
      { url: imageUrl },
      {
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const data = response.data;

    const tags = (data.tags || [])
      .filter((t) => t.confidence > 0.6)
      .map((t) => t.name);

    const caption =
      data.description?.captions?.[0]?.text || "";

    return { tags, caption };
  } catch (err) {
    console.error("[VISION] Analysis failed:", err.response?.data || err.message);
    return { tags: [], caption: "" };
  }
}

module.exports = { analyseImage };
