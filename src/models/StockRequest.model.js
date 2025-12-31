import mongoose from 'mongoose';

const stockRequestSchema = new mongoose.Schema({
    medicine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true
    },
    requestedQuantity: {
        type: Number,
        required: true,
        min: 1
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: {
        type: Date
    },
    adminNotes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Index for status and date queries
stockRequestSchema.index({ status: 1, createdAt: -1 });
stockRequestSchema.index({ requestedBy: 1, createdAt: -1 });

export default mongoose.model('StockRequest', stockRequestSchema);
