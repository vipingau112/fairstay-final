const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const aiController = require("../controllers/ai");

// Travel chatbot
router.post("/chat", wrapAsync(aiController.chat));

// Natural-language -> structured listing search
router.post("/smart-search", wrapAsync(aiController.smartSearch));

// Festival/seasonal price suggestion (no AI call needed — pure calendar logic,
// kept under /ai for a consistent front-end namespace)
router.post("/price-suggestion", wrapAsync(aiController.priceSuggestion));

module.exports = router;
