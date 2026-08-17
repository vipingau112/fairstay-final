const express = require("express");
const router = express.Router();
const passport = require("passport");
const wrapAsync = require("../utils/wrapAsync.js");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");
const userController = require("../controllers/users.js"); // Added 's' to users.js

// Safely handle multipart image upload parsing via multer (profile photos)
let upload;
try {
    const multer = require("multer");
    const { storage } = require("../cloudConfig");
    upload = multer({ storage });
} catch (e) {
    const multer = require("multer");
    upload = multer({ dest: "uploads/" });
}

// Grouping Signup Routes
router.route("/signup")
    .get(userController.renderSignupForm)
    .post(wrapAsync(userController.signup));

// Email verification via OTP (logged-in, not-yet-verified users only)
router.route("/verify-otp")
    .get(isLoggedIn, userController.renderVerifyOtpForm)
    .post(isLoggedIn, wrapAsync(userController.verifyOtp));
router.post("/resend-verification-email", isLoggedIn, wrapAsync(userController.resendVerificationEmail));


// Forgot / Reset Password (OTP-based)
router.get("/forgot-password", userController.renderForgotPasswordForm);
router.post("/forgot-password", wrapAsync(userController.forgotPassword));
router.get("/reset-password", wrapAsync(userController.renderResetPasswordForm));
router.post("/reset-password", wrapAsync(userController.resetPassword));

// Grouping Login Routes
router.route("/login")
    .get(userController.renderLoginForm)
    .post(
        saveRedirectUrl, 
        passport.authenticate("local", { 
            failureRedirect: "/login", 
            failureFlash: true 
        }), 
        wrapAsync(userController.login)
    );

// Logout remains separate since it's a unique path
router.get("/logout", userController.logout);

// Profile (guest & host details — photo, name, phone, email)
router.route("/profile")
    .get(isLoggedIn, userController.renderProfile)
    .post(isLoggedIn, upload.single("photo"), wrapAsync(userController.updateProfile));

module.exports = router;
