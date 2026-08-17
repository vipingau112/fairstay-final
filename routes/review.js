const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams keeps the listing ID accessible
const Listing = require("../models/listing");
const Review = require("../models/review");

// Simple, self-contained validation middleware to prevent "undefined" crashes
const validateReviewInline = (req, res, next) => {
    let reviewData = req.body.review;
    if (!reviewData || !reviewData.comment) {
        req.flash("error", "Please add a valid comment for your review!");
        return res.redirect(`/listings/${req.params.id}`);
    }
    next();
};

// CREATE REVIEW ROUTE: Handles review form submissions safely
router.post("/", validateReviewInline, async (req, res, next) => {
    try {
        // 1. Find the parent listing document using the merged ID parameter
        let listing = await Listing.findById(req.params.id);
        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/listings");
        }

        // 2. Create the new review document instance
        let newReview = new Review(req.body.review);
        
        // 3. Attach the currently logged-in user as the author of this review
        if (req.user) {
            newReview.author = req.user._id;
        }

        // 4. Push the review to the listing array and save both to MongoDB
        listing.reviews.push(newReview);
        
        await newReview.save();
        await listing.save();

        req.flash("success", "Review Added Successfully!");
        res.redirect(`/listings/${listing._id}`);
    } catch (err) {
        next(err);
    }
});

// DELETE REVIEW ROUTE: Drops specific review items from listing arrays
router.delete("/:reviewId", async (req, res, next) => {
    try {
        let { id, reviewId } = req.params;

        // Pull out the exact review ID from the listing's array matrix
        await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
        await Review.findByIdAndDelete(reviewId);

        req.flash("success", "Review Deleted Successfully!");
        res.redirect(`/listings/${id}`);
    } catch (err) {
        next(err);
    }
});

module.exports = router;