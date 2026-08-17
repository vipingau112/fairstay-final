// One-time fix: drops the stray unique index on `phone` that's causing
// "E11000 duplicate key error ... index: phone_1" on signup.
// This index isn't declared anywhere in models/user.js — it exists directly
// in the database (likely left over from an earlier schema) and has no
// reason to be unique, since phone numbers were never meant to be
// globally-unique in this app.
//
// Run once with:  node init/dropPhoneIndex.js
require("dotenv").config();
const mongoose = require("mongoose");

const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

async function main() {
    await mongoose.connect(dbUrl);
    console.log("Connected to DB...");

    const collection = mongoose.connection.collection("users");
    const indexes = await collection.indexes();
    const phoneIndex = indexes.find((idx) => idx.name === "phone_1");

    if (!phoneIndex) {
        console.log("✅ No phone_1 index found — nothing to do.");
    } else {
        await collection.dropIndex("phone_1");
        console.log("🎉 SUCCESS: Dropped the stray unique index on phone.");
    }

    await mongoose.connection.close();
}

main().catch((err) => {
    console.error("❌ Failed to drop index:", err.message);
    process.exit(1);
});
