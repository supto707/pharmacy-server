import mongoose from 'mongoose';

const purchaseSchema = new mongoose.Schema({
    medicine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    purchasePrice: {
        type: Number,
        required: true,
        min: 0
    },
    totalCost: {
        type: Number,
        required: true,
        min: 0
    },
    supplier: {
        type: String,
        trim: true
    },
    invoiceNumber: {
        type: String,
        trim: true
    },
    batchNumber: {
        type: String,
        trim: true
    },
    expiryDate: {
        type: Date
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        trim: true
    },
    purchasedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index for date-based queries
purchaseSchema.index({ purchaseDate: -1 });
purchaseSchema.index({ medicine: 1, purchaseDate: -1 });

export default mongoose.model('Purchase', purchaseSchema);
