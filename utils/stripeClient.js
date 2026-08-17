let stripeInstance = null;
let attemptedInit = false;

/**
 * Returns a configured Stripe client, or null if STRIPE_SECRET_KEY isn't set.
 * Lazily required so the app doesn't crash if `stripe` isn't installed yet
 * and the key is simply absent (e.g. during early local setup).
 */
function getStripe() {
    if (attemptedInit) return stripeInstance;
    attemptedInit = true;

    if (!process.env.STRIPE_SECRET_KEY) {
        return null;
    }
    try {
        const Stripe = require("stripe");
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    } catch (err) {
        console.error("Stripe init failed:", err.message);
        stripeInstance = null;
    }
    return stripeInstance;
}

module.exports = { getStripe };
