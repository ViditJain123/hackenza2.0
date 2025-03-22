import mongoose, { Document, Schema } from 'mongoose';

interface IUser extends Document {
  userName: string;
  age: number;
  phoneNumber: string;
  onboardingStatus: string;
}

const userSchema = new Schema<IUser>({
  userName: {
    type: String,
    required: false, // Changed to false as it will be filled during onboarding
    trim: true
  },
  age: {
    type: Number,
    required: false // Changed to false as it will be filled during onboarding
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  onboardingStatus: {
    type: String,
    enum: ['new', 'awaiting_name', 'awaiting_age', 'completed'],
    default: 'new'
  }
}, {
  timestamps: true 
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;
