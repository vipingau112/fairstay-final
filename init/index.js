require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");

// Never hardcode DB credentials in source — read from .env instead.
const MONGO_URL = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

main()
  .then(() => {
    console.log("connected to DB");
    initDB();
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  try {
    // 1. Force clear old data out of your cloud database cluster
    await Listing.deleteMany({});
    
    // 2. Automatically locate your registered owner account
    const defaultOwner = await User.findOne({ username: "delta-student" });
    
    if (!defaultOwner) {
      console.log("❌ ERROR: Could not find user 'delta-student'. Please sign up on the live website interface first!");
      return;
    }

    // 3. Map through data array and attach owner while keeping your hardcoded geometry objects completely intact
    initData.data = initData.data.map((obj) => ({
      ...obj,
      owner: defaultOwner._id,
      // Uses the custom geometric coordinates array you just saved in data.js
      geometry: obj.geometry || { type: "Point", coordinates: [77.2090, 28.6139] }
    }));
    
    // 4. Mass insert the stable data records into MongoDB Atlas
    await Listing.insertMany(initData.data);
    console.log("🎉 SUCCESS: Database overridden successfully with real-time map data coordinates!");
    
  } catch (err) {
    console.error("❌ Initialization script failed:", err);
  }
};