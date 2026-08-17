const crypto = require("crypto");

/**
 * Generates a random 6-digit numeric OTP as a string (e.g. "042817").
 * Uses crypto for a less-guessable value than Math.random().
 */
function generateOtp() {
    return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}

module.exports = { generateOtp };
