const Listing = require("../models/listing");

// 1. Display All Listings (Index Route)
const index = async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index.ejs", { allListings });
};

// 2. Render Form to Create New Listing
const renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
};

// 3. Show Specific Listing Details
const showListing = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: { path: "author" }
        })
        .populate("owner");
    
    if (!listing) {
        req.flash("error", "The listing you are looking for does not exist!");
        return res.redirect("/listings");
    }
    res.render("listings/show.ejs", { listing });
};

// 4. Create New Listing
// At the top of controllers/listings.js, you can leave your mapbox declaration or comment it out.
// We use native fetch() which is built right into Node.js (v18+).

module.exports.createListing = async (req, res, next) => {
    try {
        const locationQuery = req.body.listing.location;
        // Default safe fallback (New Delhi) if geocoding fails or is empty
        let geometry = { type: "Point", coordinates: [77.209, 28.6139] }; 

        // Fetch real-time coordinates from OpenStreetMap's free geocoding service
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=1`,
                { headers: { "User-Agent": "WanderLust-App-Deployment" } }
            );
            const data = await response.json();

            if (data && data.length > 0) {
                const lon = parseFloat(data[0].lon);
                const lat = parseFloat(data[0].lat);
                // Schema order: [longitude, latitude] to perfectly match MongoDB/Mapbox expectations
                geometry = { type: "Point", coordinates: [lon, lat] };
            }
        } catch (geoErr) {
            console.error("Real-time geocoding lookup failed, utilizing fallback:", geoErr);
        }

        let url = req.file.path;
        let filename = req.file.filename;
        
        const newListing = new Listing(req.body.listing);
        newListing.owner = req.user._id;
        newListing.image = { url, filename };
        newListing.geometry = geometry; // Assigns real-time coords safely

        await newListing.save();
        req.flash("success", "New Listing Created!");
        res.redirect("/listings");
    } catch (err) {
        next(err);
    }
};

// 5. Render Edit Form with Image Preview
const renderEditForm = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    
    if (!listing) {
        req.flash("error", "The listing you want to edit does not exist!");
        return res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250,h_150,c_fill");

    res.render("listings/edit.ejs", { listing, originalImageUrl });
};

// 6. Update Listing Details
const updateListing = async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

    if (typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = { url, filename };
        await listing.save();
    }

    req.flash("success", "Listing Updated Successfully!");
    res.redirect(`/listings/${id}`);
};

// 7. Delete Listing
const destroyListing = async (req, res) => {
    let { id } = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log("Deleted:", deletedListing);
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
};

// Export all methods cleanly inside a single object wrapper
module.exports = {
    index,
    renderNewForm,
    showListing,
    createListing,
    renderEditForm,
    updateListing,
    destroyListing
};