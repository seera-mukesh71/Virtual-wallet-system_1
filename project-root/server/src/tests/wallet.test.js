import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { transferFunds, topUpHead, WalletError } from '../services/walletService.js';

// IMPORTANT: point TEST_MONGODB_URI at a separate test database/cluster —
// never run tests against your real event data, since this suite creates and deletes users.
const TEST_URI = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;

let head, studentA, studentB, vendor;

beforeAll(async () => {
  await mongoose.connect(TEST_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({ email: /@wallettest\.local$/ });
  await Transaction.deleteMany({});

  const pw = await bcrypt.hash('testpass123', 10);

  head = await User.create({ name: 'Test Head', email: 'head@wallettest.local', role: 'HEAD', passwordHash: pw, isVerified: true });
  studentA = await User.create({ name: 'Student A', email: 'a@wallettest.local', rollNumber: 'TST001', role: 'STUDENT', passwordHash: pw, isVerified: true, walletBalance: 500 });
  studentB = await User.create({ name: 'Student B', email: 'b@wallettest.local', rollNumber: 'TST002', role: 'STUDENT', passwordHash: pw, isVerified: true, walletBalance: 0 });
  vendor = await User.create({ name: 'Test Vendor', email: 'v@wallettest.local', role: 'VENDOR', passwordHash: pw, isVerified: true, walletBalance: 0 });
});

describe('Money creation rules', () => {
  test('Head can top up, increasing total circulation', async () => {
    await topUpHead({ headId: head._id, amount: 1000 });
    const updated = await User.findById(head._id);
    expect(updated.walletBalance).toBe(1000);

    const txn = await Transaction.findOne({ type: 'HEAD_TOPUP' });
    expect(txn.amount).toBe(1000);
  });

  test('Non-head cannot top up (service rejects non-HEAD id)', async () => {
    await expect(topUpHead({ headId: studentA._id, amount: 1000 })).rejects.toThrow(WalletError);
    const updated = await User.findById(studentA._id);
    expect(updated.walletBalance).toBe(500); // unchanged
  });
});

describe('Transfer validation', () => {
  test('Student can send money to another student', async () => {
    await transferFunds({ senderId: studentA._id, receiverWalletId: studentB.walletId, amount: 100 });
    const a = await User.findById(studentA._id);
    const b = await User.findById(studentB._id);
    expect(a.walletBalance).toBe(400);
    expect(b.walletBalance).toBe(100);
  });

  test('Student can send money to a vendor', async () => {
    await transferFunds({ senderId: studentA._id, receiverWalletId: vendor.walletId, amount: 120 });
    const a = await User.findById(studentA._id);
    const v = await User.findById(vendor._id);
    expect(a.walletBalance).toBe(380);
    expect(v.walletBalance).toBe(120);

    const txn = await Transaction.findOne({ receiverId: vendor._id });
    expect(txn.type).toBe('STUDENT_TO_VENDOR');
  });

  test('Cannot send more than available balance', async () => {
    await expect(
      transferFunds({ senderId: studentA._id, receiverWalletId: studentB.walletId, amount: 999999 })
    ).rejects.toThrow('Insufficient balance');

    const a = await User.findById(studentA._id);
    expect(a.walletBalance).toBe(500); // unchanged — no partial transaction
  });

  test('Cannot send a negative amount', async () => {
    await expect(
      transferFunds({ senderId: studentA._id, receiverWalletId: studentB.walletId, amount: -50 })
    ).rejects.toThrow('Amount must be a positive number');
  });

  test('Cannot send zero', async () => {
    await expect(
      transferFunds({ senderId: studentA._id, receiverWalletId: studentB.walletId, amount: 0 })
    ).rejects.toThrow('Amount must be a positive number');
  });

  test('Cannot send to self', async () => {
    await expect(
      transferFunds({ senderId: studentA._id, receiverWalletId: studentA.walletId, amount: 10 })
    ).rejects.toThrow('Cannot send money to yourself');
  });

  test('Transfer to nonexistent wallet fails cleanly, no balance change', async () => {
    await expect(
      transferFunds({ senderId: studentA._id, receiverWalletId: 'wlt_doesnotexist', amount: 10 })
    ).rejects.toThrow('Recipient not found');

    const a = await User.findById(studentA._id);
    expect(a.walletBalance).toBe(500);
  });
});

describe('Double-spend prevention', () => {
  test('Two concurrent transfers cannot both succeed if balance only covers one', async () => {
    // Student A has 500. Fire two transfers of 400 each at the same time.
    // Exactly one should succeed; the other must fail with insufficient balance.
    const results = await Promise.allSettled([
      transferFunds({ senderId: studentA._id, receiverWalletId: studentB.walletId, amount: 400 }),
      transferFunds({ senderId: studentA._id, receiverWalletId: vendor.walletId, amount: 400 })
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);

    const a = await User.findById(studentA._id);
    expect(a.walletBalance).toBe(100); // 500 - 400, never went negative
  });
});

describe('Accounting invariant', () => {
  test('Total circulation equals total HEAD_TOPUP after a series of transfers', async () => {
    await topUpHead({ headId: head._id, amount: 2000 });
    await transferFunds({ senderId: head._id, receiverWalletId: studentA.walletId, amount: 500 });
    await transferFunds({ senderId: studentA._id, receiverWalletId: studentB.walletId, amount: 200 });
    await transferFunds({ senderId: studentB._id, receiverWalletId: vendor.walletId, amount: 100 });

    const topupAgg = await Transaction.aggregate([
      { $match: { type: 'HEAD_TOPUP' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const balanceAgg = await User.aggregate([
      { $match: { email: /@wallettest\.local$/ } },
      { $group: { _id: null, total: { $sum: '$walletBalance' } } }
    ]);

    expect(topupAgg[0].total).toBe(balanceAgg[0].total);
  });
});
