const Listing = require("../models/listing");
const Booking = require("../models/booking");
const { hasOverlap } = require("../utils/availability");
const { computeSeasonalPrice } = require("../utils/festivals");
const { getStripe } = require("../utils/stripeClient");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function nightsBetween(checkIn, checkOut) {
    return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}

// POST /listings/:id/bookings
module.exports.createBooking = async (req, res) => {
    const { id } = req.params;
    const { checkIn, checkOut, guests, guestName, guestEmail } = req.body.booking || {};

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Basic validation
    if (!checkIn || !checkOut || isNaN(checkInDate) || isNaN(checkOutDate)) {
        req.flash("error", "Please select valid check-in and check-out dates.");
        return res.redirect(`/listings/${id}`);
    }
    if (checkInDate < today) {
        req.flash("error", "Check-in date cannot be in the past.");
        return res.redirect(`/listings/${id}`);
    }
    if (checkOutDate <= checkInDate) {
        req.flash("error", "Check-out date must be after check-in date.");
        return res.redirect(`/listings/${id}`);
    }

    // Prevent booking your own listing
    if (listing.owner && listing.owner.equals(req.user._id)) {
        req.flash("error", "You can't book your own listing!");
        return res.redirect(`/listings/${id}`);
    }

    // Availability check — no overlapping confirmed/pending bookings
    const conflict = await hasOverlap(id, checkInDate, checkOutDate);
    if (conflict) {
        req.flash("error", "Those dates are already booked. Please choose different dates.");
        return res.redirect(`/listings/${id}`);
    }

    const nights = nightsBetween(checkInDate, checkOutDate);

    // Automatically apply fair seasonal pricing based on live festival data
    // for the EXACT stay dates (not just "today"), so the customer sees a
    // correctly-priced total for their chosen dates.
    const seasonal = await computeSeasonalPrice(listing.price, listing.location, listing.country, {
        rangeStart: checkInDate,
        rangeEnd: checkOutDate,
    });
    const totalPrice = nights * seasonal.suggestedPrice;

    const booking = new Booking({
        listing: listing._id,
        user: req.user._id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: Number(guests) || 1,
        guestName: (guestName || req.user.username || "").trim(),
        guestEmail: (guestEmail || req.user.email || "").trim(),
        nights,
        pricePerNight: listing.price,
        seasonalMultiplier: seasonal.multiplier,
        festivalApplied: seasonal.festival,
        totalPrice,
        status: "pending",
    });

    await booking.save();
    res.redirect(`/bookings/${booking._id}/checkout`);
};

// GET /bookings/:bookingId/checkout
module.exports.renderCheckout = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing");

    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/listings");
    }
    if (!booking.user.equals(req.user._id)) {
        req.flash("error", "You don't have permission to view this checkout.");
        return res.redirect("/listings");
    }
    if (booking.status !== "pending") {
        return res.redirect(`/bookings/${booking._id}`);
    }

    res.render("bookings/checkout.ejs", { booking, stripeEnabled: !!getStripe() });
};

// POST /bookings/:bookingId/pay — starts real payment (Stripe) or falls back to mock
module.exports.initiatePayment = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing");

    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/listings");
    }
    if (!booking.user.equals(req.user._id)) {
        req.flash("error", "You don't have permission to pay for this booking.");
        return res.redirect("/listings");
    }
    if (booking.status !== "pending") {
        return res.redirect(`/bookings/${booking._id}`);
    }

    const stripe = getStripe();

    // No Stripe key configured — use the mock "instant confirm" path so the
    // app still works end-to-end during local dev without payment keys.
    if (!stripe) {
        return module.exports.confirmMock(req, res);
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "inr",
                        product_data: {
                            name: booking.listing.title,
                            description: `${booking.nights} night(s), ${booking.checkIn.toDateString()} - ${booking.checkOut.toDateString()}`,
                        },
                        unit_amount: Math.round(booking.totalPrice * 100), // paise
                    },
                    quantity: 1,
                },
            ],
            success_url: `${req.protocol}://${req.get("host")}/bookings/${booking._id}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get("host")}/bookings/${booking._id}/checkout`,
            metadata: { bookingId: booking._id.toString() },
        });

        res.redirect(303, session.url);
    } catch (err) {
        console.error("Stripe session creation failed:", err.message);
        req.flash("error", "Could not start payment. Please try again.");
        res.redirect(`/bookings/${booking._id}/checkout`);
    }
};

// GET /bookings/:bookingId/payment-success — verifies payment then confirms booking
module.exports.paymentSuccess = async (req, res) => {
    const { bookingId } = req.params;
    const { session_id } = req.query;
    const booking = await Booking.findById(bookingId).populate("listing");

    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/listings");
    }
    if (!booking.user.equals(req.user._id)) {
        req.flash("error", "You don't have permission to view this booking.");
        return res.redirect("/listings");
    }

    const stripe = getStripe();
    if (!stripe || !session_id) {
        req.flash("error", "Payment verification failed. Please try again.");
        return res.redirect(`/bookings/${booking._id}/checkout`);
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== "paid") {
            req.flash("error", "Payment was not completed.");
            return res.redirect(`/bookings/${booking._id}/checkout`);
        }

        // Re-check availability right before confirming, in case someone else
        // grabbed the same dates while payment was in progress
        const conflict = await hasOverlap(booking.listing._id, booking.checkIn, booking.checkOut, booking._id);
        if (conflict) {
            booking.status = "cancelled";
            await booking.save();
            req.flash("error", "Sorry, those dates just got booked by someone else. You have not been charged again, but please contact support about your payment.");
            return res.redirect(`/listings/${booking.listing._id}`);
        }

        booking.status = "confirmed";
        await booking.save();
        req.flash("success", "🎉 Payment successful! Booking confirmed.");
        res.redirect(`/bookings/${booking._id}`);
    } catch (err) {
        console.error("Payment verification failed:", err.message);
        req.flash("error", "Could not verify payment. Please contact support if you were charged.");
        res.redirect(`/bookings/${booking._id}/checkout`);
    }
};

// POST /bookings/:bookingId/confirm — mock/dev-only instant confirmation,
// used automatically when no STRIPE_SECRET_KEY is configured.
module.exports.confirmMock = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing");

    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/listings");
    }
    if (!booking.user.equals(req.user._id)) {
        req.flash("error", "You don't have permission to confirm this booking.");
        return res.redirect("/listings");
    }

    const conflict = await hasOverlap(booking.listing._id, booking.checkIn, booking.checkOut, booking._id);
    if (conflict) {
        booking.status = "cancelled";
        await booking.save();
        req.flash("error", "Sorry, those dates just got booked by someone else. Please try different dates.");
        return res.redirect(`/listings/${booking.listing._id}`);
    }

    booking.status = "confirmed";
    await booking.save();
    req.flash("success", "🎉 Booking confirmed! (Test mode — no Stripe key configured, so payment was simulated.)");
    res.redirect(`/bookings/${booking._id}`);
};

// GET /bookings/:bookingId
module.exports.showBooking = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId)
        .populate("listing")
        .populate("user");

    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/listings");
    }

    const isBookingUser = booking.user._id.equals(req.user._id);
    const isListingOwner = booking.listing.owner && booking.listing.owner.equals(req.user._id);
    if (!isBookingUser && !isListingOwner) {
        req.flash("error", "You don't have permission to view this booking.");
        return res.redirect("/listings");
    }

    res.render("bookings/show.ejs", { booking });
};

// GET /bookings/:bookingId/receipt — printable receipt (confirmed bookings only)
module.exports.showReceipt = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing").populate("user");

    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/listings");
    }
    const isBookingUser = booking.user._id.equals(req.user._id);
    const isListingOwner = booking.listing.owner && booking.listing.owner.equals(req.user._id);
    if (!isBookingUser && !isListingOwner) {
        req.flash("error", "You don't have permission to view this receipt.");
        return res.redirect("/listings");
    }
    if (booking.status !== "confirmed") {
        req.flash("error", "A receipt is only available for confirmed bookings.");
        return res.redirect(`/bookings/${booking._id}`);
    }

    res.render("bookings/receipt.ejs", { booking });
};

// GET /bookings  (My Trips)
module.exports.myBookings = async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate("listing")
        .sort({ checkIn: 1 });

    res.render("bookings/index.ejs", { bookings, panelTitle: "My Trips", isHostPanel: false });
};

// GET /bookings/host/panel  (Host panel — bookings made on listings the current user owns)
module.exports.hostBookings = async (req, res) => {
    const myListingIds = await Listing.find({ owner: req.user._id }).distinct("_id");

    const bookings = await Booking.find({ listing: { $in: myListingIds } })
        .populate("listing")
        .populate("user")
        .sort({ checkIn: 1 });

    res.render("bookings/index.ejs", { bookings, panelTitle: "Bookings on Your Listings", isHostPanel: true });
};

// POST /bookings/:bookingId/cancel
module.exports.cancelBooking = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing");

    if (!booking) {
        req.flash("error", "Booking not found!");
        return res.redirect("/bookings");
    }
    if (!booking.user.equals(req.user._id)) {
        req.flash("error", "You don't have permission to cancel this booking.");
        return res.redirect("/bookings");
    }

    booking.status = "cancelled";
    await booking.save();
    req.flash("success", "Booking cancelled.");
    res.redirect("/bookings");
};
