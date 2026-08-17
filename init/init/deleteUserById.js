// One-off cleanup: deletes a specific user document by its _id.
// Used here to remove the duplicate "vipin" account
// (_id=6a6e0e52ae851224c7c2723a) so vipingautam194@gmail.com only
// belongs to one account (vipingau12) going forward.
//
// USAGE: node init/deleteUserById.js <userId>
require("dotenv").config();
const mongoose = require("mongoose");

const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";
const userId = process.argv[2];

if (!userId) {
    console.log("Usage: node init/deleteUserById.js <userId>");
    process.exit(1);
}

async function main() {
    await mongoose.connect(dbUrl);
    console.log("Connected to DB...\n");

    const collection = mongoose.connection.collection("users");
    const doc = await collection.findOne({ _id: new mongoose.Types.ObjectId(userId) });

    if (!doc) {
        console.log(`No user found with _id=${userId}. Nothing to delete.`);
    } else {
        console.log(`Deleting user: username=${doc.username}  email=${doc.email}`);
        await collection.deleteOne({ _id: doc._id });
        console.log("🗑️  Deleted.");

        // Heads up if this account owned anything — those references would
        // now point at a user that no longer exists.
        const orphanedListings = await mongoose.connection.collection("listings").countDocuments({ owner: doc._id });
        const orphanedBookings = await mongoose.connection.collection("bookings").countDocuments({ user: doc._id });
        if (orphanedListings > 0 || orphanedBookings > 0) {
            console.log(
                `\n⚠️  Heads up: this account owned ${orphanedListings} listing(s) and made ${orphanedBookings} booking(s). ` +
                `Those records still exist but now point to a deleted user — worth checking manually if this account wasn't just a test account.`
            );
        }
    }

    await mongoose.connection.close();
}

main().catch((err) => {
    console.error("❌ Script failed:", err.message);
    process.exit(1);
});