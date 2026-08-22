const Listing = require("../models/listing");

const PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const PLACES_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo";

// One entry per pilgrimage/peak-demand city this app covers. Keep the
// "matchKeywords" list in sync with the locationKeywords used in
// utils/festivals.js so seasonal pricing correctly recognizes these
// imported listings as "local" to their event.
const CITY_CONFIGS = {
    prayagraj: {
        label: "Prayagraj",
        searchQuery: "hotels in Prayagraj",
        fallbackLocation: "Prayagraj, Uttar Pradesh",
        matchKeywords: ["prayagraj", "allahabad"],
        defaultCoords: { lat: 25.4358, lng: 81.8463 },
    },
    haridwar: {
        label: "Haridwar",
        searchQuery: "hotels in Haridwar",
        fallbackLocation: "Haridwar, Uttarakhand",
        matchKeywords: ["haridwar"],
        defaultCoords: { lat: 29.9457, lng: 78.1642 },
    },
    nashik: {
        label: "Nashik",
        searchQuery: "hotels in Nashik",
        fallbackLocation: "Nashik, Maharashtra",
        matchKeywords: ["nashik"],
        defaultCoords: { lat: 19.9975, lng: 73.7898 },
    },
    rishikesh: {
        label: "Rishikesh",
        searchQuery: "hotels in Rishikesh",
        fallbackLocation: "Rishikesh, Uttarakhand",
        matchKeywords: ["rishikesh"],
        defaultCoords: { lat: 30.0869, lng: 78.2676 },
    },
    varanasi: {
        label: "Varanasi",
        searchQuery: "hotels in Varanasi",
        fallbackLocation: "Varanasi, Uttar Pradesh",
        matchKeywords: ["varanasi", "banaras", "kashi"],
        defaultCoords: { lat: 25.3176, lng: 82.9739 },
    },
};

function photoUrlFor(photoReference, apiKey) {
    return `${PLACES_PHOTO_URL}?maxwidth=1000&photoreference=${photoReference}&key=${apiKey}`;
}

/**
 * Fetches hotels for a given city (see CITY_CONFIGS) from Google Places and
 * inserts them as Listing documents (skipping ones that already exist by
 * title+location). Returns a summary of what was imported.
 */
async function importCityHotels(ownerId, cityKey) {
    const config = CITY_CONFIGS[cityKey];
    if (!config) {
        throw new Error(`Unknown city "${cityKey}". Valid options: ${Object.keys(CITY_CONFIGS).join(", ")}`);
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        const err = new Error("GOOGLE_PLACES_API_KEY is missing. Add it to your .env file.");
        err.isConfigError = true;
        throw err;
    }

    const query = encodeURIComponent(config.searchQuery);
    let url = `${PLACES_TEXT_SEARCH_URL}?query=${query}&key=${apiKey}`;

    let results = [];
    let pagesLeft = 3; // Google returns ~20 per page, up to 60 total across 3 pages

    while (pagesLeft > 0) {
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
            throw new Error(`Google Places error: ${data.status} ${data.error_message || ""}`);
        }

        results = results.concat(data.results || []);
        pagesLeft--;

        if (data.next_page_token && pagesLeft > 0) {
            // Google requires a short delay before a page token becomes valid
            await new Promise((resolve) => setTimeout(resolve, 2000));
            url = `${PLACES_TEXT_SEARCH_URL}?pagetoken=${data.next_page_token}&key=${apiKey}`;
        } else {
            break;
        }
    }

    let imported = 0;
    let skipped = 0;

    for (const place of results) {
        const title = place.name;
        let location = place.formatted_address || config.fallbackLocation;
        // Guarantee this city's filter chip / seasonal-pricing keyword match
        // always applies to these listings, even if Google's formatted
        // address uses a different spelling/format.
        const lowerLocation = location.toLowerCase();
        const matchesCity = config.matchKeywords.some((kw) => lowerLocation.includes(kw));
        if (!matchesCity) {
            location = `${location}, ${config.fallbackLocation}`;
        }

        const alreadyExists = await Listing.findOne({ title, location });
        if (alreadyExists) {
            skipped++;
            continue;
        }

        const lat = place.geometry?.location?.lat ?? config.defaultCoords.lat;
        const lng = place.geometry?.location?.lng ?? config.defaultCoords.lng;

        const photoRef = place.photos?.[0]?.photo_reference;
        const imageUrl = photoRef
            ? photoUrlFor(photoRef, apiKey)
            : "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1000"; // generic fallback

        // Places doesn't give nightly rates — estimate from its 0-4 price_level,
        // defaulting to a mid-range guess when not provided.
        const priceLevel = typeof place.price_level === "number" ? place.price_level : 2;
        const price = 1200 + priceLevel * 900;

        await Listing.create({
            title,
            description: `${title} is a well-rated stay in ${config.label}, imported from Google's live listings. Rating: ${place.rating || "N/A"} (${place.user_ratings_total || 0} reviews).`,
            image: { url: imageUrl, filename: "google-places-import" },
            price,
            location,
            country: "India",
            owner: ownerId,
            geometry: { type: "Point", coordinates: [lng, lat] },
        });
        imported++;
    }

    return { imported, skipped, total: results.length, city: config.label };
}

// Backward-compatible named export for the existing Prayagraj-only route.
async function importPrayagrajHotels(ownerId) {
    return importCityHotels(ownerId, "prayagraj");
}

module.exports = { importCityHotels, importPrayagrajHotels, CITY_CONFIGS };