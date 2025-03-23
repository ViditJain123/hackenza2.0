import mongoose, { Document, Schema } from 'mongoose';

interface IUser extends Document {
  clerkId: string;
  name: string;
  email: string;
  specialty: string;
  phoneNumber?: string;
  isOnboarded: boolean;
}

const userSchema = new Schema<IUser>({
  clerkId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  specialty: { type: String, required: true },
  phoneNumber: { type: String },
  isOnboarded: { type: Boolean, default: false }
}, {
  timestamps: true 
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;
