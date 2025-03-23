import mongoose from 'mongoose';

interface Connection {
    isConnected?: number;
}

const connection: Connection = {};

async function dbConnect() {
    if (connection.isConnected) {
        console.log("Already Connected");
        return;
    }
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is not defined in environment variables");
        }
        const db = await mongoose.connect(process.env.MONGODB_URI);
        connection.isConnected = db.connections[0].readyState;
        console.log("Connected to MongoDB");
    } catch (error) {
        console.log("Error connecting to MongoDB:", error);
        process.exit(1);
    }
}

export default dbConnect;