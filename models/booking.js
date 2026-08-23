const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema(
    {
        listing: {
            type: Schema.Types.ObjectId,
            ref: "Listing",
            required: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        checkIn: { type: Date, required: true },
        checkOut: { type: Date, required: true },
        guests: { type: Number, default: 1, min: 1 },
        guestName: { type: String, default: "" },
        guestEmail: { type: String, default: "" },
        nights: { type: Number, required: true },
        pricePerNight: { type: Number, required: true },
        seasonalMultiplier: { type: Number, default: 1 },
        festivalApplied: { type: String, default: null },
        totalPrice: { type: Number, required: true },
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled"],
            default: "pending",
        },
        // Assigned automatically once a booking is confirmed (e.g. "204")
        roomNumber: { type: String, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
