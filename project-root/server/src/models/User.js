import mongoose from 'mongoose';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    rollNumber: { type: String, trim: true, sparse: true, unique: true }, // students only
    role: { type: String, enum: ['HEAD', 'STUDENT', 'VENDOR'], required: true },

    // auth
    passwordHash: { type: String, default: null },
    isVerified: { type: Boolean, default: false }, // account activated after OTP + password set

    // whitelist gate — only these can ever sign up
    isAuthorized: { type: Boolean, default: true },

    // OTP (embedded, not a separate collection)
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },

    // wallet
    walletBalance: { type: Number, default: 0, min: 0 },
    walletId: {
      type: String,
      unique: true,
      default: () => 'wlt_' + crypto.randomBytes(8).toString('hex')
    },

    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' }
  },
  { timestamps: true } // gives createdAt / updatedAt automatically
);

export default mongoose.model('User', userSchema);
