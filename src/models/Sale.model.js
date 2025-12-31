import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
    medicine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true
    },
    medicineName: {
        type: String,
        required: true
    },
    medicinePower: {
        type: String,
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
    sellingPrice: {
        type: Number,
        required: true,
        min: 0
    },
    itemTotal: {
        type: Number,
        required: true,
        min: 0
    },
    profit: {
        type: Number,
        required: true
    }
});

const saleSchema = new mongoose.Schema({
    items: [saleItemSchema],
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    totalProfit: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    extraCharge: {
        type: Number,
        default: 0,
        min: 0
    },
    finalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentMethod: {
        type: String,
        enum: ['নগদ', 'বিকাশ', 'নগদ অ্যাপ', 'রকেট', 'কার্ড'],
        default: 'নগদ'
    },
    customerName: {
        type: String,
        trim: true
    },
    customerPhone: {
        type: String,
        trim: true
    },
    invoiceNumber: {
        type: String,
        unique: true
    },
    saleDate: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        trim: true
    },
    soldBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Generate invoice number before saving
saleSchema.pre('save', async function (next) {
    if (!this.invoiceNumber) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.invoiceNumber = `INV-${year}${month}${day}-${random}`;
    }
    next();
});

// Index for date-based queries
saleSchema.index({ saleDate: -1 });
saleSchema.index({ soldBy: 1, saleDate: -1 });

export default mongoose.model('Sale', saleSchema);
