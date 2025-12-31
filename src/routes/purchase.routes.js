import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import Purchase from '../models/Purchase.model.js';
import Medicine from '../models/Medicine.model.js';

const router = express.Router();

// Get all purchases (Admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            medicineId,
            page = 1,
            limit = 50
        } = req.query;

        const query = {};

        // Date range filter
        if (startDate || endDate) {
            query.purchaseDate = {};
            if (startDate) query.purchaseDate.$gte = new Date(startDate);
            if (endDate) query.purchaseDate.$lte = new Date(endDate);
        }

        // Medicine filter
        if (medicineId) {
            query.medicine = medicineId;
        }

        const purchases = await Purchase.find(query)
            .sort({ purchaseDate: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('medicine', 'name nameBangla power unit')
            .populate('purchasedBy', 'displayName');

        const total = await Purchase.countDocuments(query);

        // Calculate totals
        const totals = await Purchase.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalQuantity: { $sum: '$quantity' },
                    totalCost: { $sum: '$totalCost' }
                }
            }
        ]);

        res.json({
            success: true,
            data: purchases,
            totals: totals[0] || { totalQuantity: 0, totalCost: 0 },
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get purchases error:', error);
        res.status(500).json({
            success: false,
            message: 'ক্রয়ের তালিকা পেতে সমস্যা হয়েছে'
        });
    }
});

// Create purchase (Admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const {
            medicineId,
            quantity,
            purchasePrice,
            supplier,
            invoiceNumber,
            batchNumber,
            expiryDate,
            purchaseDate,
            notes
        } = req.body;

        // Find the medicine
        const medicine = await Medicine.findById(medicineId);
        if (!medicine) {
            return res.status(404).json({
                success: false,
                message: 'ঔষধ পাওয়া যায়নি'
            });
        }

        const totalCost = quantity * purchasePrice;

        // Create purchase record
        const purchase = await Purchase.create({
            medicine: medicineId,
            quantity,
            purchasePrice,
            totalCost,
            supplier,
            invoiceNumber,
            batchNumber,
            expiryDate,
            purchaseDate: purchaseDate || new Date(),
            notes,
            purchasedBy: req.user._id
        });

        // Update medicine stock and purchase price
        medicine.stockQuantity += quantity;
        medicine.purchasePrice = purchasePrice;
        if (batchNumber) medicine.batchNumber = batchNumber;
        if (expiryDate) medicine.expiryDate = expiryDate;
        medicine.updatedBy = req.user._id;
        await medicine.save();

        // Populate the purchase
        await purchase.populate('medicine', 'name nameBangla power unit');
        await purchase.populate('purchasedBy', 'displayName');

        // Emit real-time updates
        const io = req.app.get('io');
        io.to('dashboard').emit('purchase-created', purchase);
        io.to('dashboard').emit('medicine-updated', medicine);
        io.to('dashboard').emit('stock-updated', {
            medicineId,
            stockQuantity: medicine.stockQuantity
        });

        res.status(201).json({
            success: true,
            message: 'ক্রয় সফলভাবে রেকর্ড করা হয়েছে',
            data: purchase
        });
    } catch (error) {
        console.error('Create purchase error:', error);
        res.status(500).json({
            success: false,
            message: 'ক্রয় রেকর্ড করতে সমস্যা হয়েছে'
        });
    }
});

// Get purchase by ID
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const purchase = await Purchase.findById(req.params.id)
            .populate('medicine', 'name nameBangla power unit')
            .populate('purchasedBy', 'displayName');

        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: 'ক্রয় রেকর্ড পাওয়া যায়নি'
            });
        }

        res.json({
            success: true,
            data: purchase
        });
    } catch (error) {
        console.error('Get purchase error:', error);
        res.status(500).json({
            success: false,
            message: 'ক্রয়ের তথ্য পেতে সমস্যা হয়েছে'
        });
    }
});

export default router;
