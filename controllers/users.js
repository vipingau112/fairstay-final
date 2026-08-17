const User = require("../models/user.js");
const { generateOtp } = require("../utils/otp.js");
const { sendVerificationOtpEmail, sendPasswordResetOtpEmail } = require("../utils/mailer.js");

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// 1. Render Signup Form
module.exports.renderSignupForm = (req, res) => {
    res.render("users/signup.ejs");
};

// 2. Signup Logic
module.exports.signup = async (req, res, next) => {
    try {
        let { username, email, password } = req.body;

        // Belt-and-suspenders check (DB unique index is the real guarantee)
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            req.flash("error", "An account with this email already exists.");
            return req.session.save(() => res.redirect("/signup"));
        }

        const emailOtp = generateOtp();

        const newUser = new User({
            email,
            username,
            emailVerified: false,
            emailOtp,
            emailOtpExpires: new Date(Date.now() + OTP_TTL_MS),
        });
        const registeredUser = await User.register(newUser, password);
        console.log(`[signup] Registered ${registeredUser.username} — hash/salt set: ${!!registeredUser.hash}/${!!registeredUser.salt}`);

        await sendVerificationOtpEmail(email, emailOtp);

        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", `Welcome to Fairstay, ${registeredUser.username}! 🎉 We've emailed you a 6-digit code — enter it below to verify your account.`);
            req.session.save(() => res.redirect("/verify-otp"));
        });
    } catch (e) {
        // Mongo duplicate-key error for the email unique index
        if (e.code === 11000) {
            req.flash("error", "That email is already registered to another account.");
        } else {
            req.flash("error", e.message);
        }
        req.session.save(() => res.redirect("/signup"));
    }
};

// GET /verify-otp — form where a logged-in, unverified user enters their code
module.exports.renderVerifyOtpForm = (req, res) => {
    if (req.user.emailVerified) {
        req.flash("success", "Your email is already verified.");
        return res.redirect("/listings");
    }
    res.render("users/verify-otp.ejs");
};

// POST /verify-otp
module.exports.verifyOtp = async (req, res) => {
    const { otp } = req.body;
    const user = req.user;

    if (user.emailVerified) {
        req.flash("success", "Your email is already verified.");
        return res.redirect("/listings");
    }

    if (
        !user.emailOtp ||
        !user.emailOtpExpires ||
        user.emailOtpExpires < new Date() ||
        String(otp).trim() !== user.emailOtp
    ) {
        req.flash("error", "That code is invalid or has expired. Please request a new one.");
        return res.redirect("/verify-otp");
    }

    user.emailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpires = undefined;
    await user.save();

    req.flash("success", "✅ Email verified! Thanks for confirming.");
    res.redirect("/listings");
};

// POST /resend-verification-email
module.exports.resendVerificationEmail = async (req, res) => {
    if (req.user.emailVerified) {
        req.flash("success", "Your email is already verified.");
        return res.redirect("/listings");
    }

    const emailOtp = generateOtp();
    req.user.emailOtp = emailOtp;
    req.user.emailOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    await req.user.save();

    await sendVerificationOtpEmail(req.user.email, emailOtp);

    req.flash("success", "A new code has been sent! Please check your inbox.");
    res.redirect("/verify-otp");
};

// GET /forgot-password
module.exports.renderForgotPasswordForm = (req, res) => {
    res.render("users/forgot-password.ejs");
};

// POST /forgot-password
module.exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always show the same message, whether or not the email exists —
    // this prevents attackers from using this form to discover which
    // emails are registered on the site.
    const genericMessage = "If an account exists with that email, we've sent a 6-digit reset code.";

    if (!user) {
        req.flash("success", genericMessage);
        return res.redirect("/forgot-password");
    }

    const resetOtp = generateOtp();
    user.resetOtp = resetOtp;
    user.resetOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    await user.save();

    await sendPasswordResetOtpEmail(email, resetOtp);

    req.flash("success", genericMessage);
    res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
};

// GET /reset-password
module.exports.renderResetPasswordForm = async (req, res) => {
    const { email = "" } = req.query;
    res.render("users/reset-password.ejs", { email });
};

// POST /reset-password
module.exports.resetPassword = async (req, res) => {
    const { email, otp, password, confirmPassword } = req.body;

    const user = await User.findOne({
        email,
        resetOtp: otp,
        resetOtpExpires: { $gt: new Date() },
    });

    if (!user) {
        console.log(`[resetPassword] No matching user/otp for email=${email}`);
        req.flash("error", "That code is invalid or has expired. Please request a new one.");
        return res.redirect(`/forgot-password`);
    }

    if (!password || password.length < 6) {
        req.flash("error", "Password must be at least 6 characters.");
        return res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
    }

    if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match.");
        return res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
    }

    // setPassword comes from passport-local-mongoose — handles hashing/salting.
    // It does NOT save the document itself; we save explicitly below.
    await user.setPassword(password);

    // Safety net: if setPassword somehow didn't populate hash/salt, fail loudly
    // here instead of silently saving a broken account that can never log in.
    if (!user.hash || !user.salt) {
        console.error(`[resetPassword] setPassword did NOT populate hash/salt for email=${email}, username=${user.username}`);
        req.flash("error", "Something went wrong resetting your password. Please try again.");
        return res.redirect(`/forgot-password`);
    }

    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    console.log(`[resetPassword] Success for email=${email}, username=${user.username} — hash/salt confirmed set.`);

    req.flash("success", "✅ Password reset! You can now log in with your new password.");
    res.redirect("/login");
};

// 3. Render Login Form
module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

// 4. Login Logic
module.exports.login = async (req, res) => {
    req.flash("success", `Welcome back, ${req.user.username}! 👋`);
    let redirectUrl = res.locals.redirectUrl || "/listings";
    req.session.save(() => res.redirect(redirectUrl));
};

// 5. Logout Logic
module.exports.logout = (req, res, next) => {
    req.logOut((err) => {
        if (err) return next(err);
        req.flash("success", "You are logged out now!");
        req.session.save(() => res.redirect("/listings"));
    });
};

// GET /profile
module.exports.renderProfile = (req, res) => {
    res.render("users/profile.ejs");
};

// POST /profile
module.exports.updateProfile = async (req, res) => {
    const { phone } = req.body;
    const user = req.user;

    if (phone && phone.trim()) {
        user.phone = phone.trim();
    } else {
        user.phone = undefined;
    }

    if (req.file) {
        user.profilePhoto = {
            url: req.file.path,
            filename: req.file.filename,
        };
    }

    await user.save();
    req.flash("success", "Profile updated!");
    res.redirect("/profile");
};