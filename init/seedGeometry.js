const mongoose = require("mongoose");
const axios = require("axios");
const Listing = require("../models/listing"); // Adjust path if this file is in your root folder instead of /init

// 1. Connect directly to your local MongoDB database
// Make sure the database name matches your development setup (e.g., 'wanderlust')
mongoose.connect("mongodb://127.0.0.1:27017/wanderlust")
    .then(() => {
        console.log("🚀 Connected to MongoDB successfully. Starting map migration...");
        runMigration();
    })
    .catch(err => console.log("❌ DB Connection Error:", err));

async function runMigration() {
    try {
        // Find every listing that does not have coordinates or is still using the default placeholder
        const listings = await Listing.find({});
        console.log(`📊 Found ${listings.length} total database listings to process.`);

        let updatedCount = 0;

        for (let listing of listings) {
            // Build a clean, real-world search string based on what you already typed in the database
            const searchLocation = encodeURIComponent(`${listing.location}, ${listing.country}`);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${searchLocation}&limit=1`;

            try {
                // Request real coordinates from the open-source map cluster network
                const response = await axios.get(url, {
                    headers: { 'User-Agent': 'WanderLustApp/1.0' }
                });

                if (response.data && response.data.length > 0) {
                    const lat = parseFloat(response.data[0].lat);
                    const lon = parseFloat(response.data[0].lon);
                    
                    // Update the geometry object field to match your new Mongoose structural schema
                    listing.geometry = {
                        type: "Point",
                        coordinates: [lon, lat]
                    };
                    
                    await listing.save();
                    updatedCount++;
                    console.log(`✅ [${updatedCount}/${listings.length}] Updated coordinates for: ${listing.title} (${listing.location})`);
                } else {
                    console.log(`⚠️ Could not find map coordinates for: ${listing.location}. Skipping.`);
                }
            } catch (err) {
                console.log(`🛑 Rate limit or network hiccup on: ${listing.title}. Skipping safely.`);
            }

            // A tiny half-second pause to be respectful to the free open map API servers
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\n🎉 Success! Automatically updated ${updatedCount} old listings with real-time map data.`);
        mongoose.connection.close();
        console.log("🔌 Database connection closed cleanly.");
    } catch (e) {
        console.log("❌ Migration interrupted error:", e);
    }
}