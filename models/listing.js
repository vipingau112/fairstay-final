const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  image: {
    url: String,
    filename: String,
  },
  price: Number,
  location: String,
  country: String,
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  // CRITICAL FIX: Explicitly add the GeoJSON schema structure format to store your map math data arrays
  geometry: {
    type: {
      type: String, 
      enum: ['Point'], // 'geometry.type' must be 'Point'
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      default: [77.2090, 28.6139] // Global center backup fallback default parameters
    }
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;