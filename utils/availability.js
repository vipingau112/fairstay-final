const Booking = require("../models/booking");

/**
 * Checks whether a given date range overlaps with any existing
 * non-cancelled booking for the same listing.
 * Standard interval-overlap check: two ranges overlap if
 * existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn.
 */
async function hasOverlap(listingId, checkIn, checkOut, excludeBookingId = null) {
    const query = {
        listing: listingId,
        status: { $ne: "cancelled" },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
    };
    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }
    const conflict = await Booking.findOne(query);
    return !!conflict;
}

module.exports = { hasOverlap };
