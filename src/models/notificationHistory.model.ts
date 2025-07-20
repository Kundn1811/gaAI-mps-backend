import mongoose from 'mongoose';

const notificationHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  type: {
    type: String,
    enum: ['single', 'multiple', 'broadcast'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'partial'],
    default: 'pending',
    index: true
  },
  sentAt: {
    type: Date,
    default: null
  },
  deliveryDetails: {
    totalTokens: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    invalidTokens: [String]
  },
  fcmResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound indexes for efficient queries
notificationHistorySchema.index({ userId: 1, createdAt: -1 });
notificationHistorySchema.index({ status: 1, createdAt: -1 });
notificationHistorySchema.index({ type: 1, createdAt: -1 });


const NotificationHistory = mongoose.model('NotificationHistory', notificationHistorySchema);
export default NotificationHistory;