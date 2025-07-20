import mongoose from 'mongoose';
// Broadcast Notification Schema (Phase 2)
const broadcastNotificationSchema = new mongoose.Schema({
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
  targetCriteria: {
    userIds: [mongoose.Schema.Types.ObjectId],
    deviceTypes: [{
      type: String,
      enum: ['ios', 'android', 'web']
    }],
    categories: [String], // notification categories
    isActive: { type: Boolean, default: true }
  },
  scheduledFor: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['scheduled', 'processing', 'completed', 'failed'],
    default: 'scheduled',
    index: true
  },
  stats: {
    totalTargeted: { type: Number, default: 0 },
    totalSent: { type: Number, default: 0 },
    totalFailed: { type: Number, default: 0 }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  }
});

const BroadcastNotification = mongoose.model('BroadcastNotification', broadcastNotificationSchema);

export default BroadcastNotification;