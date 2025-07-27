import mongoose, { Schema, Document } from 'mongoose';

// Interface for the FCM Token
interface IFCMToken extends Document {
  userId: Schema.Types.ObjectId;  // Reference to the User model
  token: string;  // FCM token
  createdAt: Date;  // Optional: You can track when the token was created
}

const fcmTokenSchema = new Schema<IFCMToken>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },  // Ensure only one token per user
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Ensure that the token is unique for each user
fcmTokenSchema.index({ userId: 1 }, { unique: true });

const FCMToken = mongoose.model<IFCMToken>('FCMToken', fcmTokenSchema);
export default FCMToken;
