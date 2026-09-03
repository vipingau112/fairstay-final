require('dotenv').config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

// Import Models
const User = require("./models/user.js");

// Import Route Pipelines
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const aiRouter = require("./routes/ai.js");
const listingBookingRouter = require("./routes/listingBookings.js");
const bookingRouter = require("./routes/bookings.js");

const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

app.engine('ejs', ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));

// Sessions are stored in MongoDB via connect-mongo so they survive restarts
// and don't leak memory (fixes the "MemoryStore is not designed for a
// production environment" warning).
const sessionOptions = {
    secret: process.env.SESSION_SECRET || "simplelocalsecret",
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: dbUrl,
        collectionName: "sessions",
        touchAfter: 24 * 60 * 60, // only update session once per 24h unless data changes
    }),
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    }
};

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

// Custom LocalStrategy so login can match on EITHER username or email.
// We do our own username-or-email lookup, then hand off to the model's
// own generated authenticate() function for the actual password check —
// this matches the library's official documented usage exactly
// (`await Model.authenticate()(username, password)`), so we're not
// guessing at any undocumented internal calling conventions.
passport.use(new LocalStrategy(async function (usernameOrEmail, password, done) {
    try {
        const foundUser = await User.findOne({ $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }] });
        if (!foundUser) {
            return done(null, false, { message: "Incorrect username" });
        }

        const result = await User.authenticate()(foundUser.username, password);
        if (result && result.user) {
            return done(null, result.user);
        }
        return done(null, false, (result && result.error) || { message: "Incorrect password" });
    } catch (err) {
        return done(err);
    }
}));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/listings/:id/bookings", listingBookingRouter);
app.use("/bookings", bookingRouter);
app.use("/ai", aiRouter);
app.use("/", userRouter);

app.get("/", (req, res) => {
    res.redirect("/listings");
});

app.get("/terms", (req, res) => {
    res.render("pages/terms.ejs");
});

app.get("/privacy", (req, res) => {
    res.render("pages/privacy.ejs");
});

// Imports real hotels from Google Places as listings, for any of the
// pilgrimage/peak-demand cities this app covers (Prayagraj, Haridwar,
// Nashik, Rishikesh). Visit this URL once per city (while logged in) to
// populate them, e.g. /admin/import-hotels/haridwar
app.get("/admin/import-hotels/:city", async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            req.flash("error", "Please log in first, then visit this link again.");
            return res.redirect("/login");
        }
        const { importCityHotels, CITY_CONFIGS } = require("./utils/placesImport.js");
        const city = req.params.city.toLowerCase();
        if (!CITY_CONFIGS[city]) {
            return res.status(404).send(
                `Unknown city "${city}". Valid options: ${Object.keys(CITY_CONFIGS).join(", ")}`
            );
        }
        const summary = await importCityHotels(req.user._id, city);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.send(
            `✨ Import complete for ${summary.city}! Added ${summary.imported} new hotel(s), skipped ${summary.skipped} already-existing one(s), out of ${summary.total} found. ` +
            `Go back to <a href="${baseUrl}/listings">${baseUrl}/listings</a>`
        );
    } catch (err) {
        res.status(500).send("Error importing hotels: " + err.message);
    }
});

// Kept for backward compatibility with the old Prayagraj-only URL
app.get("/admin/import-prayagraj-hotels", async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            req.flash("error", "Please log in first, then visit this link again.");
            return res.redirect("/login");
        }
        const { importPrayagrajHotels } = require("./utils/placesImport.js");
        const summary = await importPrayagrajHotels(req.user._id);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.send(
            `✨ Import complete! Added ${summary.imported} new hotel(s), skipped ${summary.skipped} already-existing one(s), out of ${summary.total} found. ` +
            `Go back to <a href="${baseUrl}/listings">${baseUrl}/listings</a>`
        );
    } catch (err) {
        res.status(500).send("Error importing Prayagraj hotels: " + err.message);
    }
});

// 🚀 SMART LOCAL SEEDER: Automatically fetches real coordinates for existing locations
app.get("/seed-local-db", async (req, res) => {
    try {
        const initData = require("./init/data.js"); 
        const Listing = require("./models/listing.js");
        
        await Listing.deleteMany({});
        console.log("Wiped old listings. Fetching real coordinates...");

        const sanitizedData = [];

        for (let item of initData.data) {
            let coordinates = [77.2090, 28.6139]; // Default fallback (Delhi)
            
            try {
                const searchQuery = encodeURIComponent(`${item.location}, ${item.country}`);
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${searchQuery}&format=json&limit=1`, {
                    headers: { 'User-Agent': 'Wanderlust-App-LocalDev' }
                });
                const geoData = await response.json();

                if (geoData && geoData.length > 0) {
                    coordinates = [parseFloat(geoData[0].lon), parseFloat(geoData[0].lat)];
                }
                await new Promise(resolve => setTimeout(resolve, 250)); 
            } catch (geoErr) {
                console.log(`Geocoding failed for ${item.location}, using fallback.`);
            }

            sanitizedData.push({
                ...item,
                geometry: { type: "Point", coordinates: coordinates }
            });
        }
        
        await Listing.insertMany(sanitizedData);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        res.send(`✨ Local database updated with real geographical locations! Go back to ${baseUrl}/listings`);
    } catch (err) {
        res.status(500).send("Error seeding local database: " + err.message);
    }
});

app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong!" } = err;
    if (!res.headersSent) {
        res.status(statusCode).render("error.ejs", { message });
    }
});

const port = process.env.PORT || 8080;

mongoose.connect(dbUrl)
    .then(() => {
        console.log("🚀 Connected successfully to MongoDB!");
        app.listen(port, () => {
            console.log(`Server thread active and listening on port ${port}`);
        });
    })
    .catch((err) => {
        console.error("❌ Database connection failure:", err.message);
        process.exit(1); // fail fast instead of running with a dead DB connection
    });
