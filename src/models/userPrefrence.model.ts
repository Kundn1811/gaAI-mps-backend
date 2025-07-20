import mongoose from 'mongoose';

// User Notification Preferences Schema (Phase 2)
const userPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    unique: true,
    index: true
  },
  globalEnabled: {
    type: Boolean,
    default: true
  },
  categories: {
    marketing: { type: Boolean, default: true },
    transactional: { type: Boolean, default: true },
    alerts: { type: Boolean, default: true },
    social: { type: Boolean, default: true },
    news: { type: Boolean, default: true }
  },
  quietHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '22:00' }, // 24hr format
    endTime: { type: String, default: '08:00' },
    timezone: { type: String, default: 'UTC' }
  },
  frequency: {
    type: String,
    enum: ['immediate', 'batched', 'daily_digest'],
    default: 'immediate'
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

userPreferencesSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);
export default UserPreferences;