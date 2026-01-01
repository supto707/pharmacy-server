import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    nameBangla: {
        type: String,
        trim: true
    },
    power: {
        type: String,
        required: true,
        trim: true
    },
    unit: {
        type: String,
        required: true,
        enum: ['পাতা', 'পিস', 'বোতল', 'বক্স', 'টিউব', 'স্ট্রিপ', 'প্যাকেট'],
        default: 'পাতা'
    },
    unitsPerPackage: {
        type: Number,
        default: 10 // e.g., 10 tablets per strip
    },
    tradePrice: {
        type: Number,
        default: 0,
        min: 0
    },
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    discountAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    purchasePrice: {
        type: Number,
        required: true,
        min: 0
    },
    mrp: {
        type: Number,
        default: 0,
        min: 0
    },
    sellingDiscountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    sellingDiscountAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    sellingPrice: {
        type: Number,
        required: true,
        min: 0
    },
    stockQuantity: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    lowStockThreshold: {
        type: Number,
        default: 10
    },
    manufacturer: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        trim: true
    },
    expiryDate: {
        type: Date
    },
    batchNumber: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Virtual for profit margin
medicineSchema.virtual('profitMargin').get(function () {
    if (this.purchasePrice === 0) return 0;
    return ((this.sellingPrice - this.purchasePrice) / this.purchasePrice * 100).toFixed(2);
});

// Virtual for profit per unit
medicineSchema.virtual('profitPerUnit').get(function () {
    return this.sellingPrice - this.purchasePrice;
});

// Check if stock is low
medicineSchema.virtual('isLowStock').get(function () {
    return this.stockQuantity <= this.lowStockThreshold;
});

// Check if out of stock
medicineSchema.virtual('isOutOfStock').get(function () {
    return this.stockQuantity === 0;
});

// Include virtuals in JSON
medicineSchema.set('toJSON', { virtuals: true });
medicineSchema.set('toObject', { virtuals: true });

// Index for better search performance
medicineSchema.index({ name: 'text', nameBangla: 'text', manufacturer: 'text' });

export default mongoose.model('Medicine', medicineSchema);
