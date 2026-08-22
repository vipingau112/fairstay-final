const Listing = require("../models/listing");
const { askGemini, askGeminiJSON } = require("../utils/geminiClient");
const { computeSeasonalPrice } = require("../utils/festivals");

const CHAT_SYSTEM_PROMPT = `You are the friendly in-app travel assistant for "Fairstay", a stays-booking site focused
on major Indian pilgrimage destinations: Prayagraj (Sangam, Magh Mela), Haridwar, Rishikesh (Char Dham gateway),
Nashik (Kumbh Mela), and Varanasi (Kashi, Ganga Aarti, Dev Deepawali). Help users with travel advice, trip planning,
best times to visit, packing tips, festival/pilgrimage travel advice, and questions about staying at Fairstay listings.
Keep answers concise (under 120 words), warm, and practical.
If asked about destinations outside these five cities, politely note that Fairstay currently covers Prayagraj, Haridwar,
Rishikesh, Nashik, and Varanasi. If asked something totally unrelated to travel/stays, gently redirect to travel topics.`;
// Answered directly, without an AI call, so it's always accurate & instant
const CREATOR_QUESTION_PATTERN = /who\s+(made|built|created|developed|designed)\s+(this|fairstay|the\s+website|the\s+site|the\s+app)/i;

// POST /ai/chat  { message, history: [{role, text}] }
module.exports.chat = async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Message is required." });
        }

        if (CREATOR_QUESTION_PATTERN.test(message)) {
            return res.json({ reply: "Fairstay was made with ❤️ by Vipin Gautam and team!" });
        }

        let conversation = "";
        if (Array.isArray(history)) {
            for (const turn of history.slice(-6)) {
                conversation += `${turn.role === "user" ? "User" : "Assistant"}: ${turn.text}\n`;
            }
        }
        const prompt = `${conversation}User: ${message}\nAssistant:`;

        const reply = await askGemini(prompt, CHAT_SYSTEM_PROMPT);
        res.json({ reply });
    } catch (err) {
        console.error("AI chat error:", err.message);
        if (err.isConfigError) {
            return res.status(503).json({
                error: "AI chatbot isn't configured yet. Add GEMINI_API_KEY to your .env file.",
            });
        }
        res.status(500).json({ error: "The AI assistant is unavailable right now. Please try again." });
    }
};

// POST /ai/smart-search  { query: "cheap beach house in goa for diwali" }
module.exports.smartSearch = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query || !query.trim()) {
            return res.status(400).json({ error: "Search query is required." });
        }

               const systemInstruction = `You convert a free-text travel search query into structured JSON filters
for a listings database. Listings are in one of five Indian pilgrimage cities: Prayagraj, Haridwar, Rishikesh, Nashik, or Varanasi.
Fields available: keywords (short string of 1-3 words capturing property type/vibe/amenity, or null),
city (one of "Prayagraj", "Haridwar", "Rishikesh", "Nashik", "Varanasi" if the query mentions or clearly implies one, or null),
maxPrice (number in INR per night, or null), minPrice (number in INR per night, or null).
Only include a field if the query implies it. Respond with ONLY JSON like:
{"keywords": "budget hotel", "city": "Haridwar", "minPrice": null, "maxPrice": 2000}`;
        const filters = await askGeminiJSON(`Query: "${query}"`, systemInstruction);

        if (!filters) {
            // Fallback: treat whole query as a keyword search so the feature never hard-fails
            return res.json({
                filters: { keywords: query },
                redirectUrl: `/listings?category=${encodeURIComponent(query)}`,
            });
        }

        const params = new URLSearchParams();
        if (filters.keywords) params.set("category", filters.keywords);
        if (filters.city) params.set("location", filters.city);
        if (filters.minPrice) params.set("minPrice", filters.minPrice);
        if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);

        res.json({ filters, redirectUrl: `/listings?${params.toString()}` });
    } catch (err) {
        console.error("AI smart search error:", err.message);
        if (err.isConfigError) {
            return res.status(503).json({
                error: "Smart search isn't configured yet. Add GEMINI_API_KEY to your .env file.",
            });
        }
        res.status(500).json({ error: "Smart search is unavailable right now. Please try again." });
    }
};

// POST /ai/price-suggestion  { location, country, basePrice }
module.exports.priceSuggestion = async (req, res) => {
    try {
        const { location = "", country = "", basePrice } = req.body;
        const price = Number(basePrice) || 0;

        const result = await computeSeasonalPrice(price, location, country);
        res.json(result);
    } catch (err) {
        console.error("Price suggestion error:", err.message);
        res.status(500).json({ error: "Could not compute a price suggestion right now." });
    }
};
