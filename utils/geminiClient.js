const axios = require("axios");

// Uses Google Gemini's free-tier friendly REST API (no extra SDK needed —
// we already have axios as a dependency).
// Get a free key at: https://aistudio.google.com/app/apikey
// Then add to your .env file:  GEMINI_API_KEY=your_key_here

// Using the "latest" alias rather than a pinned version — Google periodically
// retires specific dated models (as happened with 2.0-flash and 2.5-flash-lite),
// but this alias keeps pointing at whatever current model has free-tier quota.
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Sends a prompt to Gemini and returns the plain text reply.
 * @param {string} userPrompt - the user's message / question
 * @param {string} systemInstruction - persona / behavior instructions for the model
 */
async function askGemini(userPrompt, systemInstruction = "") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const err = new Error(
            "GEMINI_API_KEY is missing. Add it to your .env file (see .env.example)."
        );
        err.isConfigError = true;
        throw err;
    }

    const body = {
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    };

    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const { data } = await axios.post(`${GEMINI_URL}?key=${apiKey}`, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
    });

    const text =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
        "";
    return text.trim();
}

/**
 * Same as askGemini, but instructs the model to reply with ONLY JSON,
 * and safely parses the result. Returns null if parsing fails.
 */
async function askGeminiJSON(userPrompt, systemInstruction = "") {
    const strictInstruction = `${systemInstruction}\n\nIMPORTANT: Reply with ONLY valid JSON. No markdown, no backticks, no commentary before or after the JSON.`;
    const raw = await askGemini(userPrompt, strictInstruction);
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    try {
        return JSON.parse(cleaned);
    } catch (err) {
        console.error("Failed to parse Gemini JSON response:", cleaned);
        return null;
    }
}

module.exports = { askGemini, askGeminiJSON };
