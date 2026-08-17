const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const bookingController = require("../controllers/bookings");

// MY TRIPS: list all bookings made by the logged-in user
router.get("/", isLoggedIn, wrapAsync(bookingController.myBookings));

// HOST PANEL: bookings made on listings the logged-in user owns
router.get("/host/panel", isLoggedIn, wrapAsync(bookingController.hostBookings));

// CHECKOUT page for a pending booking
router.get("/:bookingId/checkout", isLoggedIn, wrapAsync(bookingController.renderCheckout));

// PAY: starts a real Stripe Checkout session (or falls back to mock confirm)
router.post("/:bookingId/pay", isLoggedIn, wrapAsync(bookingController.initiatePayment));

// PAYMENT SUCCESS: verifies the Stripe session then confirms the booking
router.get("/:bookingId/payment-success", isLoggedIn, wrapAsync(bookingController.paymentSuccess));

// CONFIRM (mock/dev fallback — used automatically when Stripe isn't configured)
router.post("/:bookingId/confirm", isLoggedIn, wrapAsync(bookingController.confirmMock));

// CANCEL booking
router.post("/:bookingId/cancel", isLoggedIn, wrapAsync(bookingController.cancelBooking));

// PRINTABLE RECEIPT (confirmed bookings only)
router.get("/:bookingId/receipt", isLoggedIn, wrapAsync(bookingController.showReceipt));

// SHOW single booking (confirmation / detail page)
router.get("/:bookingId", isLoggedIn, wrapAsync(bookingController.showBooking));

module.exports = router;
