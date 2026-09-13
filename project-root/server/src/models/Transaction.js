import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    senderName: { type: String, required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverName: { type: String, required: true },
    receiverType: { type: String, enum: ['HEAD', 'STUDENT', 'VENDOR'], required: true },

    amount: { type: Number, required: true, min: 0.01 },

    type: {
      type: String,
      enum: ['HEAD_TOPUP', 'HEAD_DISTRIBUTION', 'STUDENT_TO_STUDENT', 'STUDENT_TO_VENDOR'],
      required: true
    },

    status: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' },
    note: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('Transaction', transactionSchema);
