

# Fairstay 🏨

**Fairstay** is a full-stack stays-booking platform focused on **Prayagraj, India** — built as a final year project. It combines a classic Airbnb-style listings experience with AI-powered travel features, live festival-aware pricing, and real payment processing.

## ✨ Features

### Core Platform
- User authentication (signup/login/logout) with Passport.js
- Email verification (secure token-based, one account per email)
- Create, edit, and delete property listings with image uploads (Cloudinary)
- Reviews and ratings on listings
- Fully responsive, custom-designed UI (Royal Gold/Blue theme)

### AI-Powered Features
- **AI Travel Chatbot** — a Gemini-powered assistant for Prayagraj travel advice, packing tips, and festival guidance
- **AI Smart Search** — converts natural language queries (e.g. *"cheap stay under ₹2000"*) into structured search filters
- **Live Seasonal Pricing** — automatically applies fair price adjustments during major Indian festivals, pulled live from a public holiday calendar API (no manual yearly updates needed) plus tracked pilgrimage events (Kumbh Mela, Char Dham Yatra)

### Bookings & Payments
- Full booking flow with date selection, guest count, and live price breakdown
- Availability checking (prevents double-booking the same dates)
- Real payment processing via **Stripe Checkout**, with a safe test-mode fallback when Stripe isn't configured
- "My Trips" dashboard to view and cancel bookings

### Live Data Integration
- **Google Places API** import — pulls real hotels in Prayagraj, Haridwar, Rishikesh, and Nashik (names, ratings, photos, addresses) directly into the platform. Visit `/admin/import-hotels/<city>` while logged in (e.g. `/admin/import-hotels/haridwar`)

## 🛠️ Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose) — hosted on MongoDB Atlas
- **Templating**: EJS + ejs-mate
- **Auth**: Passport.js (local strategy) + passport-local-mongoose
- **AI**: Google Gemini API
- **Payments**: Stripe
- **Image hosting**: Cloudinary
- **External data**: Google Places API, public holiday calendar API

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- A MongoDB Atlas account (free tier works)
- API keys for: Cloudinary, Google Gemini, Stripe (optional), Google Places (optional), Gmail App Password (optional)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/fairstay.git
cd fairstay
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and fill in your own values:

```bash
cp .env.example .env
```

See `.env.example` for detailed instructions on obtaining each API key.

### Run locally

```bash
node app.js
```

Visit `http://localhost:3000`

### Deploy to Render

1. Push your code to GitHub and sign in to https://render.com.
2. Create a new **Web Service** and connect your GitHub repository `vipingau112/fairstay`.
3. Choose the `main` branch.
4. For **Build Command**, use:

```bash
npm install
```

5. For **Start Command**, use:

```bash
npm start
```

6. Add these environment variables in Render from your `.env` values:
   - `ATLASDB_URL`
   - `CLOUD_NAME`
   - `CLOUD_API_KEY`
   - `CLOUD_API_SECRET`
   - `GEMINI_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `GOOGLE_PLACES_API_KEY`

7. Deploy the service.

Once deployed, Render will provide a public URL for your site.

### Deploy to Railway

Railway also supports this Node app directly.

1. Sign in to https://railway.app and connect your GitHub account.
2. Create a new project and choose **Deploy from GitHub**.
3. Select the repository `vipingau112/fairstay` and the `main` branch.
4. Railway should detect the app as Node.js and use your `package.json`.
5. For build and start commands, use:

```bash
npm install
npm start
```

6. Add these environment variables in Railway from your `.env` values:
   - `ATLASDB_URL`
   - `CLOUD_NAME`
   - `CLOUD_API_KEY`
   - `CLOUD_API_SECRET`
   - `GEMINI_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `GOOGLE_PLACES_API_KEY`

7. Trigger a deploy. Railway will provide a public URL once the deployment succeeds.

## 📁 Project Structure

```
├── controllers/     # Route handler logic
├── models/          # Mongoose schemas (User, Listing, Review, Booking)
├── routes/          # Express route definitions
├── views/           # EJS templates
├── utils/           # Helper modules (AI clients, payment, festival pricing, etc.)
├── public/          # Static assets (CSS, client-side JS)
└── app.js           # Application entry point
```

## 👨‍💻 Author

Made with ❤️ by **Vipin Gautam** and team

---
*This project was built as a final year submission.*
