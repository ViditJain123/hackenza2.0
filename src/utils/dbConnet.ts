import mongoose from 'mongoose';

// Extend the NodeJS global interface to include mongoose
declare global {
  var mongoose: { conn: mongoose.Connection | null; promise: Promise<mongoose.Connection> | null } | undefined;
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached?.conn) {
    console.log('🔄 Using existing database connection');
    return cached.conn;
  }

  if (!cached?.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
      connectTimeoutMS: 5000, // 5 seconds connection timeout
      socketTimeoutMS: 5000, // 5 seconds socket timeout
    };

    console.log('🔄 Creating new database connection');
    if (cached) {
      cached.promise = mongoose.connect(MONGODB_URI as string, opts).then((mongooseInstance) => {
        return mongooseInstance.connection;
      });
    }
  }
  
  try {
    if (cached) {
      cached.conn = await cached.promise;
      return cached.conn;
    }
    throw new Error('Database connection not initialized');
  } catch (e) {
    if (cached) {
      cached.promise = null;
    }
    throw e;
  }
}

export default connectDB;
