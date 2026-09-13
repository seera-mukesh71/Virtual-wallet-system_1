import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { sendOtpEmail } from '../utils/email.js';
import { signToken } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Rate limit login/general auth endpoints by IP — fine since brute-forcing a
// specific password is the threat here, and raised to accommodate many users
// on the same college WiFi sharing one outbound IP.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
router.use(authLimiter);

// OTP requests are keyed by the EMAIL in the request body, not IP — otherwise
// a crowd of students on the same WiFi/NAT during event sign-up would share
// one IP bucket and lock each other out after only 20 total requests.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.email?.toLowerCase() || req.ip
});

const generateOtp = () => String(crypto.randomInt(100000, 999999));

// ---- 1. Request OTP ----
const requestOtpSchema = z.object({ email: z.string().email() });

router.post('/signup/request-otp', otpLimiter, async (req, res, next) => {
  try {
    const { email } = requestOtpSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });

    // Generic response either way — do not reveal whether the email exists
    const genericMsg = 'If this email is authorized, an OTP has been sent.';

    if (!user || !user.isAuthorized) {
      return res.json({ success: true, message: genericMsg });
    }
    if (user.isVerified) {
      return res.json({ success: true, message: genericMsg }); // already has an account
    }

    const otp = generateOtp();
    user.otpHash = await bcrypt.hash(otp, 10);
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    await sendOtpEmail(user.email, otp);
    return res.json({ success: true, message: genericMsg });
  } catch (err) {
    next(err);
  }
});

// ---- 2. Verify OTP ----
const verifyOtpSchema = z.object({ email: z.string().email(), otp: z.string().length(6) });

router.post('/signup/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = verifyOtpSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ success: false, message: 'Invalid request', code: 'INVALID_OTP_REQUEST' });
    }
    if (user.otpExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired', code: 'OTP_EXPIRED' });
    }
    if (user.otpAttempts >= 5) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Request a new OTP.', code: 'OTP_LOCKED' });
    }

    const match = await bcrypt.compare(otp, user.otpHash);
    if (!match) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP', code: 'OTP_MISMATCH' });
    }

    // OTP correct — mark as ready for password creation, but not verified yet
    user.otpAttempts = 0;
    await user.save();
    return res.json({ success: true, message: 'OTP verified. You may now set a password.' });
  } catch (err) {
    next(err);
  }
});

// ---- 3. Set Password (completes signup) ----
const setPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6), // re-checked here so password can't be set without proving OTP possession at this step too
  password: z.string().min(8)
});

router.post('/signup/set-password', async (req, res, next) => {
  try {
    const { email, otp, password } = setPasswordSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.otpHash || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP session invalid or expired', code: 'INVALID_OTP_SESSION' });
    }
    const match = await bcrypt.compare(otp, user.otpHash);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP', code: 'OTP_MISMATCH' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.isVerified = true;
    user.otpHash = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    await user.save();

    return res.json({ success: true, message: 'Account created. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

// ---- 4. Login ----
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });

    // Same generic error whether email is wrong or password is wrong — avoids enumeration
    const invalidMsg = { success: false, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' };

    if (!user || !user.isVerified || !user.passwordHash) {
      return res.status(401).json(invalidMsg);
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json(invalidMsg);
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account disabled', code: 'ACCOUNT_DISABLED' });
    }

    const token = signToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'Login successful',
      data: { id: user._id, name: user.name, role: user.role, walletId: user.walletId }
    });
  } catch (err) {
    next(err);
  }
});

// ---- 5. Logout ----
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out' });
});

// ---- 6. Current user ----
router.get('/me', authenticate, (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    data: {
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      rollNumber: u.rollNumber,
      walletId: u.walletId,
      walletBalance: u.walletBalance
    }
  });
});

export default router;
