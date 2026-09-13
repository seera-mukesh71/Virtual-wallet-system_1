import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { transferFunds, WalletError } from '../services/walletService.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

const router = express.Router();
router.use(authenticate);

// GET /api/wallet — current balance + basic profile
router.get('/', (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    data: { walletBalance: u.walletBalance, walletId: u.walletId, name: u.name, role: u.role }
  });
});

// POST /api/wallet/transfer — student sends to student or vendor
const transferSchema = z.object({
  receiverWalletId: z.string().min(1),
  amount: z.number().positive()
});

router.post('/transfer', authorize('STUDENT'), async (req, res, next) => {
  try {
    const { receiverWalletId, amount } = transferSchema.parse(req.body);
    const io = req.app.get('io');

    const txn = await transferFunds({
      senderId: req.user._id,
      receiverWalletId,
      amount,
      io
    });

    res.json({
      success: true,
      message: `₹${amount} sent successfully to ${txn.receiverName}.`,
      data: txn
    });
  } catch (err) {
    if (err instanceof WalletError) {
      return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
    }
    next(err);
  }
});

// GET /api/wallet/transactions — the logged-in user's own history
router.get('/transactions', async (req, res, next) => {
  try {
    const txns = await Transaction.find({
      $or: [{ senderId: req.user._id }, { receiverId: req.user._id }]
    })
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({ success: true, data: txns });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:walletId — public lookup for QR scan (no sensitive fields)
router.get('/lookup/:walletId', async (req, res, next) => {
  try {
    const user = await User.findOne({ walletId: req.params.walletId }).select(
      'name role rollNumber walletId'
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
