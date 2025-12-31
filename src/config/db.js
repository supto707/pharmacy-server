import mongoose from 'mongoose';

// MongoDB URI - uses environment variable with fallback for development
const DEFAULT_MONGODB_URI = 'mongodb+srv://pharmacy_db_user:OFLwab2QdOwLObqa@cluster0.dwcxqlg.mongodb.net/pharmacy-buddy?retryWrites=true&w=majority&appName=Cluster0';

export const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;

        const conn = await mongoose.connect(mongoURI);

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
};
