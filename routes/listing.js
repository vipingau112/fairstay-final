const express = require("express");
const router = express.Router();
const axios = require("axios"); 
const Listing = require("../models/listing"); 

// Safely handle multipart image upload parsing via multer
let upload;
try {
    const multer = require("multer");
    const { storage } = require("../cloudConfig");
    upload = multer({ storage });
} catch (e) {
    const multer = require("multer");
    upload = multer({ dest: "uploads/" });
}

// INDEX ROUTE: Fetch all listings across our covered pilgrimage cities
// (Prayagraj, Haridwar, Nashik, Rishikesh) OR filter dynamically by keyword.
router.get("/", async (req, res, next) => {
    try {
        const { category, location, country, minPrice, maxPrice } = req.query;
        let andConditions = [
            { location: new RegExp("prayagraj|allahabad|haridwar|nashik|rishikesh", "i") },
        ];

        // Smart dynamic matcher checking title, location, country, and description
        if (category) {
            let searchRegex = new RegExp(category, "i");
            andConditions.push({
                $or: [
                    { title: searchRegex },
                    { description: searchRegex },
                    { location: searchRegex },
                    { country: searchRegex }
                ]
            });
        }

        // Extra structured filters, populated by the AI smart-search feature
        if (location) {
            andConditions.push({ location: new RegExp(location, "i") });
        }
        if (country) {
            andConditions.push({ country: new RegExp(country, "i") });
        }
        if (minPrice || maxPrice) {
            let priceFilter = {};
            if (minPrice) priceFilter.$gte = Number(minPrice);
            if (maxPrice) priceFilter.$lte = Number(maxPrice);
            andConditions.push({ price: priceFilter });
        }

        const queryFilter = andConditions.length ? { $and: andConditions } : {};

        const allListings = await Listing.find(queryFilter);
        res.render("listings/index.ejs", { allListings });
    } catch (err) {
        next(err);
    }
});

// NEW ROUTE: Render listing creation form layout
router.get("/new", (req, res) => {
    if(!req.isAuthenticated()) {
        req.flash("error", "You must be logged in to create a listing!");
        return res.redirect("/login");
    }
    res.render("listings/new.ejs");
});

// SHOW ROUTE: View single listing inside your premium split details grid
router.get("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id)
            .populate({ path: "reviews", populate: { path: "author" } })
            .populate("owner");
        
        if(!listing) {
            req.flash("error", "Listing you requested for does not exist!");
            return res.redirect("/listings");
        }
        res.render("listings/show.ejs", { listing });
    } catch(err) {
        next(err);
    }
});

// CREATE ROUTE: AUTOMATIC REAL-WORLD MAP CALCULATOR FOR NEW ENTRIES
router.post("/", upload.single("listing[image]"), async (req, res, next) => {
    try {
        if(!req.isAuthenticated()) {
            req.flash("error", "You must be logged in to create a listing!");
            return res.redirect("/login");
        }

        let finalData = req.body.listing ? req.body.listing : req.body;
        const newListing = new Listing(finalData);
        newListing.owner = req.user._id;

        if (req.file) {
            newListing.image = {
                url: req.file.path,
                filename: req.file.filename
            };
        }

        const searchLocation = encodeURIComponent(newListing.location + ", " + newListing.country);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${searchLocation}&limit=1`;

        try {
            const response = await axios.get(url, { headers: { 'User-Agent': 'WanderLustApp/1.0' } });
            if (response.data && response.data.length > 0) {
                const lat = parseFloat(response.data[0].lat);
                const lon = parseFloat(response.data[0].lon);
                newListing.geometry = { type: "Point", coordinates: [lon, lat] };
            } else {
                newListing.geometry = { type: "Point", coordinates: [77.2090, 28.6139] };
            }
        } catch(geoErr) {
            newListing.geometry = { type: "Point", coordinates: [77.2090, 28.6139] };
        }

        await newListing.save();
        req.flash("success", "New Listing Created Successfully!");
        res.redirect("/listings");
    } catch (err) {
        next(err);
    }
});

// EDIT ROUTE: Render edit form layout panel attributes
router.get("/:id/edit", async (req, res, next) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);
        
        if(!req.isAuthenticated()) {
            req.flash("error", "You must be logged in to edit listings!");
            return res.redirect("/login");
        }
        if(!listing) {
            req.flash("error", "Listing you requested for does not exist!");
            return res.redirect("/listings");
        }

        let originalImageUrl = listing.image.url;
        if (originalImageUrl) {
            originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
        }

        res.render("listings/edit.ejs", { listing, originalImageUrl });
    } catch(err) {
        next(err);
    }
});

// UPDATE ROUTE: RE-CALCULATE MAP COORDINATES AUTOMATICALLY ON DATA UPDATE
router.put("/:id", upload.single("listing[image]"), async (req, res, next) => {
    try {
        const { id } = req.params;
        let updateData = req.body.listing ? req.body.listing : req.body;
        
        if (req.file) {
            updateData.image = {
                url: req.file.path,
                filename: req.file.filename
            };
        }

        const searchLocation = encodeURIComponent(updateData.location + ", " + updateData.country);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${searchLocation}&limit=1`;

        try {
            const response = await axios.get(url, { headers: { 'User-Agent': 'WanderLustApp/1.0' } });
            if (response.data && response.data.length > 0) {
                const lat = parseFloat(response.data[0].lat);
                const lon = parseFloat(response.data[0].lon);
                updateData.geometry = { type: "Point", coordinates: [lon, lat] };
            }
        } catch(geoErr) {
            console.log("Geocoding failed during update.");
        }
        
        await Listing.findByIdAndUpdate(id, { ...updateData });
        req.flash("success", "Listing Updated Successfully!");
        res.redirect(`/listings/${id}`);
    } catch(err) {
        next(err);
    }
});

// DELETE ROUTE: Drops listing record row safely
router.delete("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        await Listing.findByIdAndDelete(id);
        req.flash("success", "Listing Deleted Successfully!");
        res.redirect("/listings");
    } catch(err) {
        next(err);
    }
});

module.exports = router;