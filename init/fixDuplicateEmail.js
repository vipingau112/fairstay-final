// Diagnoses (and optionally fixes) duplicate User documents sharing the
// same email — a leftover risk from before the app had a real unique
// index on `email`.
//
// USAGE:
//   node init/fixDuplicateEmail.js someone@example.com          (diagnose only)
//   node init/fixDuplicateEmail.js someone@example.com --fix    (also delete the broken duplicate)
//
// "--fix" keeps the document that HAS a password (hash+salt) set, and
// deletes any other document(s) sharing the same email that have no
// password — those were never created through real signup and can't be
// logged into anyway.
require("dotenv").config();
const mongoose = require("mongoose");

const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";
const email = process.argv[2];
const shouldFix = process.argv.includes("--fix");

if (!email) {
    console.log("Usage: node init/fixDuplicateEmail.js someone@example.com [--fix]");
    process.exit(1);
}

async function main() {
    await mongoose.connect(dbUrl);
    console.log("Connected to DB...\n");

    const collection = mongoose.connection.collection("users");
    const docs = await collection.find({ email }).toArray();

    if (docs.length === 0) {
        console.log(`No user found with email "${email}".`);
    } else {
        console.log(`Found ${docs.length} document(s) with email "${email}":\n`);
        docs.forEach((doc, i) => {
            const hasPassword = Boolean(doc.hash && doc.salt);
            console.log(
                `${i + 1}. _id=${doc._id}  username=${doc.username}  hasPassword=${hasPassword}  emailVerified=${!!doc.emailVerified}`
            );
        });

        if (docs.length > 1) {
            console.log("\n⚠️  Duplicate accounts detected for this email — this is almost certainly why login fails.");

            const withPassword = docs.filter((d) => d.hash && d.salt);
            const withoutPassword = docs.filter((d) => !(d.hash && d.salt));

            if (shouldFix) {
                if (withoutPassword.length === 0) {
                    console.log("All duplicates have a password set — not auto-deleting anything. Please resolve manually.");
                } else {
                    for (const doc of withoutPassword) {
                        await collection.deleteOne({ _id: doc._id });
                        console.log(`🗑️  Deleted broken duplicate _id=${doc._id} (no password set).`);
                    }
                }
            } else {
                console.log(`Run again with --fix to delete the ${withoutPassword.length} broken duplicate(s) with no password.`);
            }
        } else {
            const doc = docs[0];
            if (!(doc.hash && doc.salt)) {
                console.log("\nThis single account has no password set — use /forgot-password to set one via OTP.");
            } else {
                console.log("\nThis account looks fine (has a password set). If login still fails, double-check the password itself.");
            }
        }
    }

    // Make sure a unique index on email actually exists going forward,
    // so duplicate accounts like this can't happen again.
    const indexes = await collection.indexes();
    const hasEmailUniqueIndex = indexes.some((idx) => idx.key && idx.key.email === 1 && idx.unique);
    if (!hasEmailUniqueIndex) {
        console.log("\nNo unique index on email found — creating one now...");
        await collection.createIndex({ email: 1 }, { unique: true });
        console.log("✅ Unique index on email created.");
    }

    await mongoose.connection.close();
}

main().catch((err) => {
    console.error("❌ Script failed:", err.message);
    process.exit(1);
});
