let transporter = null;
let attemptedInit = false;

function getTransporter() {
    if (attemptedInit) return transporter;
    attemptedInit = true;

    const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;

    try {
        const nodemailer = require("nodemailer");
        transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
        });
    } catch (err) {
        console.error("Mailer init failed:", err.message);
        transporter = null;
    }
    return transporter;
}

/**
 * Sends (or, if email isn't configured, logs to console) a 6-digit
 * email-verification OTP. Never throws — signup shouldn't fail just
 * because email delivery hiccups.
 */
async function sendVerificationOtpEmail(toEmail, otp) {
    const t = getTransporter();

    if (!t) {
        console.log(`\n[DEV MODE] No GMAIL_USER/GMAIL_APP_PASSWORD set in .env.`);
        console.log(`Email verification OTP for ${toEmail}: ${otp}\n`);
        return { sent: false };
    }

    try {
        await t.sendMail({
            from: `"Fairstay" <${process.env.GMAIL_USER}>`,
            to: toEmail,
            subject: `${otp} is your Fairstay verification code`,
            html: `
                <div style="font-family: sans-serif; max-width: 480px;">
                    <h2 style="color:#1B3B6D;">Welcome to Fairstay!</h2>
                    <p>Enter this code to verify your email address:</p>
                    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1B3B6D;background:#fdf6e3;padding:16px 20px;border-radius:8px;text-align:center;">${otp}</p>
                    <p style="color:#888;font-size:12px;">This code expires in 10 minutes. If you didn't sign up for Fairstay, you can ignore this email.</p>
                </div>
            `,
        });
        return { sent: true };
    } catch (err) {
        console.error("Failed to send verification OTP email:", err.message);
        console.log(`Email verification OTP for ${toEmail}: ${otp}`);
        return { sent: false };
    }
}

/**
 * Sends (or logs, if email isn't configured) a 6-digit password-reset OTP.
 */
async function sendPasswordResetOtpEmail(toEmail, otp) {
    const t = getTransporter();

    if (!t) {
        console.log(`\n[DEV MODE] No GMAIL_USER/GMAIL_APP_PASSWORD set in .env.`);
        console.log(`Password reset OTP for ${toEmail}: ${otp}\n`);
        return { sent: false };
    }

    try {
        await t.sendMail({
            from: `"Fairstay" <${process.env.GMAIL_USER}>`,
            to: toEmail,
            subject: `${otp} is your Fairstay password reset code`,
            html: `
                <div style="font-family: sans-serif; max-width: 480px;">
                    <h2 style="color:#1B3B6D;">Reset your password</h2>
                    <p>We received a request to reset your Fairstay password. Enter this code to continue:</p>
                    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1B3B6D;background:#fdf6e3;padding:16px 20px;border-radius:8px;text-align:center;">${otp}</p>
                    <p style="color:#888;font-size:12px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
                </div>
            `,
        });
        return { sent: true };
    } catch (err) {
        console.error("Failed to send password reset OTP email:", err.message);
        console.log(`Password reset OTP for ${toEmail}: ${otp}`);
        return { sent: false };
    }
}

module.exports = { sendVerificationOtpEmail, sendPasswordResetOtpEmail };
