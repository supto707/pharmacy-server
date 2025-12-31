import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        required: true
    },
    photoURL: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['admin', 'staff', 'viewer'],
        default: 'staff'
    },
    isActive: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

export default mongoose.model('User', userSchema);
