// MongoDB Schemas
import mongoose, { Schema, Document, Types } from 'mongoose';


// Types and Interfaces
interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
}, { 
  timestamps: true,
  versionKey: false 
});