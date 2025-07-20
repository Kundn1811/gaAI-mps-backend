import mongoose from 'mongoose';

// FCM Token Schema
const fcmTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true
  },
  deviceType: {
    type: String,
    enum: ['ios', 'android', 'web'],
    required: true
  },
  appVersion: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes
fcmTokenSchema.index({ userId: 1, deviceId: 1 });
fcmTokenSchema.index({ userId: 1, isActive: 1 });

fcmTokenSchema.pre('save', function(this: any, next: any) {
  this.updatedAt = Date.now();
  next();
});


const FCMToken = mongoose.model('FCMToken', fcmTokenSchema);

export default FCMToken;