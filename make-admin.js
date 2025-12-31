import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.model.js';

dotenv.config();

// MongoDB URI - uses environment variable with fallback for development
const DEFAULT_MONGODB_URI = 'mongodb+srv://pharmacy_db_user:OFLwab2QdOwLObqa@cluster0.dwcxqlg.mongodb.net/pharmacy-buddy?retryWrites=true&w=majority&appName=Cluster0';

const makeAdmin = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
        await mongoose.connect(mongoURI);
        console.log('✅ Connected to MongoDB');

        const users = await User.find({});
        console.log(`Found ${users.length} users.`);

        if (users.length === 0) {
            console.log('❌ No users found. Please login first to create a user account.');
            process.exit(0);
        }

        // List users
        users.forEach((u, i) => {
            console.log(`${i + 1}. ${u.displayName} (${u.email}) - Role: ${u.role}`);
        });

        // Automatically promote the first user if only one, or the one with pharmacy email if matches
        // For now, let's just promote the first user found or specific one if argument provided
        const emailToPromote = process.argv[2];

        let targetUser;

        if (emailToPromote) {
            targetUser = await User.findOne({ email: emailToPromote });
        } else if (users.length > 0) {
            // Default to first user if no arg
            targetUser = users[0];
        }

        if (!targetUser) {
            console.log('❌ User not found.');
            process.exit(1);
        }

        targetUser.role = 'admin';
        await targetUser.save();

        console.log(`\n🎉 Successfully promoted ${targetUser.displayName} (${targetUser.email}) to ADMIN!`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

makeAdmin();
