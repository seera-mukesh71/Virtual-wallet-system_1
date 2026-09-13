import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

class WalletError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Atomically transfers virtual money from one user to another.
 * Used for STUDENT_TO_STUDENT and STUDENT_TO_VENDOR transfers.
 * Does NOT create new money — sender must already hold the balance.
 */
export async function transferFunds({ senderId, receiverWalletId, amount, io }) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new WalletError('Amount must be a positive number', 'INVALID_AMOUNT');
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const sender = await User.findById(senderId).session(session);
      const receiver = await User.findOne({ walletId: receiverWalletId }).session(session);

      if (!sender) throw new WalletError('Sender not found', 'SENDER_NOT_FOUND', 404);
      if (!receiver) throw new WalletError('Recipient not found', 'RECEIVER_NOT_FOUND', 404);
      if (String(sender._id) === String(receiver._id)) {
        throw new WalletError('Cannot send money to yourself', 'SELF_TRANSFER');
      }
      if (!['STUDENT', 'VENDOR'].includes(receiver.role)) {
        throw new WalletError('Invalid recipient role', 'INVALID_RECEIVER_ROLE');
      }
      if (sender.walletBalance < amount) {
        throw new WalletError('Insufficient balance', 'INSUFFICIENT_BALANCE');
      }

      sender.walletBalance -= amount;
      receiver.walletBalance += amount;
      await sender.save({ session });
      await receiver.save({ session });

      const type = receiver.role === 'VENDOR' ? 'STUDENT_TO_VENDOR' : 'STUDENT_TO_STUDENT';

      const [txn] = await Transaction.create(
        [{
          senderId: sender._id,
          senderName: sender.name,
          receiverId: receiver._id,
          receiverName: receiver.name,
          receiverType: receiver.role,
          amount,
          type,
          status: 'SUCCESS'
        }],
        { session }
      );

      result = { txn, sender, receiver };
    });

    // Notify vendor in real-time AFTER the transaction has committed successfully
    if (result.receiver.role === 'VENDOR' && io) {
      io.to(`vendor:${result.receiver._id}`).emit('payment_received', {
        transactionId: result.txn._id,
        amount: result.txn.amount,
        senderName: result.txn.senderName,
        timestamp: result.txn.createdAt
      });
    }

    return result.txn;
  } finally {
    session.endSession();
  }
}

/**
 * HEAD_TOPUP — the only operation allowed to create new virtual money.
 */
export async function topUpHead({ headId, amount }) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new WalletError('Amount must be a positive number', 'INVALID_AMOUNT');
  }

  const session = await mongoose.startSession();
  try {
    let txn;
    await session.withTransaction(async () => {
      const head = await User.findById(headId).session(session);
      if (!head || head.role !== 'HEAD') {
        throw new WalletError('Only Head can top up', 'FORBIDDEN', 403);
      }

      head.walletBalance += amount;
      await head.save({ session });

      [txn] = await Transaction.create(
        [{
          senderId: head._id,
          senderName: head.name,
          receiverId: head._id,
          receiverName: head.name,
          receiverType: 'HEAD',
          amount,
          type: 'HEAD_TOPUP',
          status: 'SUCCESS'
        }],
        { session }
      );
    });
    return txn;
  } finally {
    session.endSession();
  }
}

export { WalletError };
