import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { topUpHead, transferFunds, WalletError } from '../services/walletService.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();
router.use(authenticate, authorize('HEAD'));

// ---- Top up (creates new virtual money) ----
const topupSchema = z.object({ amount: z.number().positive() });

router.post('/topup', async (req, res, next) => {
  try {
    const { amount } = topupSchema.parse(req.body);
    const txn = await topUpHead({ headId: req.user._id, amount });
    res.json({ success: true, message: `₹${amount} added to Head balance.`, data: txn });
  } catch (err) {
    if (err instanceof WalletError) {
      return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
    }
    next(err);
  }
});

// ---- Distribute to a single student/vendor ----
const distributeSchema = z.object({
  receiverWalletId: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().optional()
});

router.post('/distribute', async (req, res, next) => {
  try {
    const { receiverWalletId, amount } = distributeSchema.parse(req.body);
    const io = req.app.get('io');
    const txn = await transferFunds({ senderId: req.user._id, receiverWalletId, amount, io });

    // Relabel as HEAD_DISTRIBUTION for clarity in the ledger (transferFunds sets STUDENT_* types by default)
    txn.type = 'HEAD_DISTRIBUTION';
    await txn.save();

    res.json({ success: true, message: `₹${amount} sent to ${txn.receiverName}.`, data: txn });
  } catch (err) {
    if (err instanceof WalletError) {
      return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
    }
    next(err);
  }
});

// ---- Bulk distribute ----
const bulkSchema = z.object({
  distributions: z.array(z.object({
    receiverWalletId: z.string().min(1),
    amount: z.number().positive()
  })).min(1).max(100)
});

router.post('/bulk-distribute', async (req, res, next) => {
  try {
    const { distributions } = bulkSchema.parse(req.body);
    const io = req.app.get('io');

    const totalNeeded = distributions.reduce((sum, d) => sum + d.amount, 0);
    const head = await User.findById(req.user._id);
    if (head.walletBalance < totalNeeded) {
      return res.status(400).json({
        success: false,
        message: `Insufficient Head balance. Need ₹${totalNeeded}, have ₹${head.walletBalance}.`,
        code: 'INSUFFICIENT_BALANCE'
      });
    }

    const results = [];
    for (const d of distributions) {
      try {
        const txn = await transferFunds({
          senderId: req.user._id,
          receiverWalletId: d.receiverWalletId,
          amount: d.amount,
          io
        });
        txn.type = 'HEAD_DISTRIBUTION';
        await txn.save();
        results.push({ success: true, receiverWalletId: d.receiverWalletId, transactionId: txn._id });
      } catch (err) {
        const message = err instanceof WalletError ? err.message : 'Transfer failed';
        results.push({ success: false, receiverWalletId: d.receiverWalletId, message });
      }
    }

    const failedCount = results.filter((r) => !r.success).length;
    res.json({
      success: true,
      message: `Processed ${results.length} distributions (${failedCount} failed).`,
      data: results
    });
  } catch (err) {
    next(err);
  }
});

// ---- Dashboard stats ----
router.get('/dashboard', async (req, res, next) => {
  try {
    const [studentAgg, vendorAgg, headAgg, txnCount, studentCount, vendorCount, topupAgg] = await Promise.all([
      User.aggregate([{ $match: { role: 'STUDENT' } }, { $group: { _id: null, total: { $sum: '$walletBalance' } } }]),
      User.aggregate([{ $match: { role: 'VENDOR' } }, { $group: { _id: null, total: { $sum: '$walletBalance' } } }]),
      User.aggregate([{ $match: { role: 'HEAD' } }, { $group: { _id: null, total: { $sum: '$walletBalance' } } }]),
      Transaction.countDocuments(),
      User.countDocuments({ role: 'STUDENT' }),
      User.countDocuments({ role: 'VENDOR' }),
      Transaction.aggregate([{ $match: { type: 'HEAD_TOPUP' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    ]);

    const vendorWise = await Transaction.aggregate([
      { $match: { receiverType: 'VENDOR', status: 'SUCCESS' } },
      { $group: { _id: '$receiverId', name: { $first: '$receiverName' }, total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]);

    const recent = await Transaction.find().sort({ createdAt: -1 }).limit(20);

    res.json({
      success: true,
      data: {
        totalIntroduced: topupAgg[0]?.total || 0,
        heldByStudents: studentAgg[0]?.total || 0,
        heldByVendors: vendorAgg[0]?.total || 0,
        heldByHead: headAgg[0]?.total || 0,
        totalTransactions: txnCount,
        studentCount,
        vendorCount,
        vendorWiseReceived: vendorWise,
        recentTransactions: recent
      }
    });
  } catch (err) {
    next(err);
  }
});

// ---- All transactions with filters ----
router.get('/transactions', async (req, res, next) => {
  try {
    const { type, from, to, userId } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (userId) filter.$or = [{ senderId: userId }, { receiverId: userId }];
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const txns = await Transaction.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, data: txns });
  } catch (err) {
    next(err);
  }
});

// ---- List students / vendors ----
router.get('/students', async (req, res, next) => {
  try {
    const students = await User.find({ role: 'STUDENT' }).select('-passwordHash -otpHash');
    res.json({ success: true, data: students });
  } catch (err) {
    next(err);
  }
});

router.get('/vendors', async (req, res, next) => {
  try {
    const vendors = await User.find({ role: 'VENDOR' }).select('-passwordHash -otpHash');
    res.json({ success: true, data: vendors });
  } catch (err) {
    next(err);
  }
});

// ---- Search (roll number / name / email) ----
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });

    const regex = new RegExp(q, 'i');
    const results = await User.find({
      role: { $in: ['STUDENT', 'VENDOR'] },
      $or: [{ name: regex }, { email: regex }, { rollNumber: regex }]
    }).select('name email rollNumber role walletId walletBalance');

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// ---- Accounting invariant check ----
router.get('/verify-invariant', async (req, res, next) => {
  try {
    const topupAgg = await Transaction.aggregate([
      { $match: { type: 'HEAD_TOPUP' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const balanceAgg = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$walletBalance' } } }
    ]);

    const totalTopUp = topupAgg[0]?.total || 0;
    const totalBalances = balanceAgg[0]?.total || 0;
    const isConsistent = totalTopUp === totalBalances;

    res.json({
      success: true,
      data: { totalTopUp, totalBalances, isConsistent }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
