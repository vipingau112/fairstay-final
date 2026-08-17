const mongoose = require("mongoose");
const Schema = mongoose.Schema;
let passportLocalMongoose = require("passport-local-mongoose");

// Defensive check: If it was imported as an object, grab the default or main function
if (passportLocalMongoose && typeof passportLocalMongoose !== "function" && passportLocalMongoose.default) {
    passportLocalMongoose = passportLocalMongoose.default;
}

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true, // one account per email
    },
    emailVerified: { type: Boolean, default: false },

    // Email verification via a 6-digit OTP (instead of a click-link)
    emailOtp: String,
    emailOtpExpires: Date,

    // Forgot/reset password via a 6-digit OTP
    resetOtp: String,
    resetOtpExpires: Date,

    // Profile info (collected on the /profile page after signup).
    // No default value on purpose: if this field is left unset entirely
    // (rather than stored as ""), it stays compatible with a unique/sparse
    // index on phone, and multiple users can leave it blank without colliding.
    phone: { type: String },
    profilePhoto: {
        url: { type: String, default: "" },
        filename: { type: String, default: "" },
    },
});

// Auto-injects username, hash, and salt password fields securely
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
