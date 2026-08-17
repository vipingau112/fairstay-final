require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const User = require("../models/user.js");

// Never hardcode DB credentials in source — read from .env instead.
const MONGO_URL = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log("Connected to DB...");

  // 1. Find the old 'delta-student' user in MongoDB
  const user = await User.findOne({ username: "delta-student" });

  if (!user) {
    console.log("❌ User 'delta-student' not found in database.");
    return;
  }

  // 2. Change the username in MongoDB
  user.username = "SafeStay Host"; // 👈 Type your desired host name here!
  await user.save();

  console.log("🎉 SUCCESS: Host username updated in MongoDB!");
  mongoose.connection.close();
}

main().catch((err) => console.log(err));