import mongoose from 'mongoose';

// Create a connection function that can be reused across the application
const connectDB = async () => {
  // If the connection is already established, return early
  if (mongoose.connections[0].readyState) return;
  
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error('Failed to connect to database');
  }
};

export default connectDB;
