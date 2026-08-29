const axios = require("axios");

// Uses Brevo's HTTP API (https://api.brevo.com) instead of SMTP.
// Render's free tier blocks outbound SMTP ports (25, 465, 587) as of
// Sept 2025, which is why Gmail/Nodemailer times out in production even
// though it works fine locally. Brevo sends over plain HTTPS, so it works
// on Render's free tier with no port restrictions.
//
// Setup (one-time):
//   1. Sign up free at https://brevo.com
//   2. Go to Senders, Domains & Dedicated IPs -> Senders -> add and verify
//      a sender email (any inbox you control — click the confirmation link
//      Brevo emails you). No domain/DNS setup required.
//   3. Go to Settings -> SMTP & API -> API Keys -> generate a new key.
//   4. Add to your .env (and to Render's Environment settings):
//        BREVO_API_KEY=your_key_here
//        BREVO_SENDER_EMAIL=the_verified_sender_email_from_step_2

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

async function sendViaBrevo({ toEmail, subject, html }) {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;

    if (!apiKey || !senderEmail) {
        console.log(`\n[DEV MODE] BREVO_API_KEY/BREVO_SENDER_EMAIL not set in .env.`);
        return { sent: false, devMode: true };
    }

    try {
        await axios.post(
            BREVO_API_URL,
            {
                sender: { name: "Fairstay", email: senderEmail },
                to: [{ email: toEmail }],
                subject,
                htmlContent: html,
            },
            {
                headers: {
                    accept: "application/json",
                    "content-type": "application/json",
                    "api-key": apiKey,
                },
                timeout: 15000,
            }
        );
        return { sent: true };
    } catch (err) {
        const details = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        console.error("Failed to send email via Brevo:", details);
        return { sent: false, error: details };
    }
}

/**
 * Sends (or, if Brevo isn't configured, logs to console) a 6-digit
 * email-verification OTP. Never throws — signup shouldn't fail just
 * because email delivery hiccups.
 */
async function sendVerificationOtpEmail(toEmail, otp) {
    const html = `
        <div style="font-family: sans-serif; max-width: 480px;">
            <h2 style="color:#1B3B6D;">Welcome to Fairstay!</h2>
            <p>Enter this code to verify your email address:</p>
            <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1B3B6D;background:#fdf6e3;padding:16px 20px;border-radius:8px;text-align:center;">${otp}</p>
            <p style="color:#888;font-size:12px;">This code expires in 10 minutes. If you didn't sign up for Fairstay, you can ignore this email.</p>
        </div>
    `;

    const result = await sendViaBrevo({
        toEmail,
        subject: `${otp} is your Fairstay verification code`,
        html,
    });

    if (!result.sent) {
        console.log(`Email verification OTP for ${toEmail}: ${otp}`);
    }
    return result;
}

/**
 * Sends (or logs, if Brevo isn't configured) a 6-digit password-reset OTP.
 */
async function sendPasswordResetOtpEmail(toEmail, otp) {
    const html = `
        <div style="font-family: sans-serif; max-width: 480px;">
            <h2 style="color:#1B3B6D;">Reset your password</h2>
            <p>We received a request to reset your Fairstay password. Enter this code to continue:</p>
            <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1B3B6D;background:#fdf6e3;padding:16px 20px;border-radius:8px;text-align:center;">${otp}</p>
            <p style="color:#888;font-size:12px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
    `;

    const result = await sendViaBrevo({
        toEmail,
        subject: `${otp} is your Fairstay password reset code`,
        html,
    });

    if (!result.sent) {
        console.log(`Password reset OTP for ${toEmail}: ${otp}`);
    }
    return result;
}

module.exports = { sendVerificationOtpEmail, sendPasswordResetOtpEmail };
