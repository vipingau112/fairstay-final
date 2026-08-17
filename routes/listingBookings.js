const express = require("express");
const router = express.Router({ mergeParams: true }); // keeps :id (listing) accessible
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("../middleware");
const bookingController = require("../controllers/bookings");

// CREATE booking (from the listing show page's booking widget)
router.post("/", isLoggedIn, wrapAsync(bookingController.createBooking));

module.exports = router;
