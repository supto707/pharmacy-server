import express from 'express';
import { authenticate, requireStaffOrAdmin, requireAdmin, requireViewer } from '../middleware/auth.middleware.js';
import Sale from '../models/Sale.model.js';
import Medicine from '../models/Medicine.model.js';

const router = express.Router();

// Get all sales
router.get('/', authenticate, requireViewer, async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            soldBy,
            page = 1,
            limit = 50
        } = req.query;

        const query = {};

        // Date range filter
        if (startDate || endDate) {
            query.saleDate = {};
            if (startDate) query.saleDate.$gte = new Date(startDate);
            if (endDate) query.saleDate.$lte = new Date(endDate);
        }

        // Staff filter (Admin can see all, Staff sees own)
        if (req.user.role === 'staff') {
            query.soldBy = req.user._id;
        } else if (soldBy) {
            query.soldBy = soldBy;
        }

        const sales = await Sale.find(query)
            .sort({ saleDate: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('soldBy', 'displayName email');

        const total = await Sale.countDocuments(query);

        // Calculate totals
        const totals = await Sale.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$finalAmount' },
                    totalProfit: { $sum: '$totalProfit' },
                    totalSales: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: sales,
            totals: totals[0] || { totalAmount: 0, totalProfit: 0, totalSales: 0 },
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get sales error:', error);
        res.status(500).json({
            success: false,
            message: 'বিক্রয়ের তালিকা পেতে সমস্যা হয়েছে'
        });
    }
});

// Create sale (Staff and Admin)
router.post('/', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const {
            items,
            discount = 0,
            extraCharge = 0,
            paymentMethod = 'নগদ',
            customerName,
            customerPhone,
            notes
        } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'অন্তত একটি ঔষধ নির্বাচন করুন'
            });
        }

        // Validate and prepare items
        const saleItems = [];
        let totalAmount = 0;
        let totalProfit = 0;

        for (const item of items) {
            const medicine = await Medicine.findById(item.medicineId);

            if (!medicine) {
                return res.status(404).json({
                    success: false,
                    message: `ঔষধ পাওয়া যায়নি: ${item.medicineId}`
                });
            }

            if (medicine.stockQuantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `"${medicine.name}" - পর্যাপ্ত স্টক নেই। বর্তমান স্টক: ${medicine.stockQuantity}`
                });
            }

            const itemTotal = medicine.sellingPrice * item.quantity;
            const itemProfit = (medicine.sellingPrice - medicine.purchasePrice) * item.quantity;

            saleItems.push({
                medicine: medicine._id,
                medicineName: medicine.name,
                medicinePower: medicine.power,
                quantity: item.quantity,
                purchasePrice: medicine.purchasePrice,
                sellingPrice: medicine.sellingPrice,
                itemTotal,
                profit: itemProfit
            });

            totalAmount += itemTotal;
            totalProfit += itemProfit;

            // Update stock
            medicine.stockQuantity -= item.quantity;
            await medicine.save();
        }

        const finalAmount = totalAmount - discount + extraCharge;
        const adjustedProfit = totalProfit - discount + extraCharge;

        // Create sale
        const sale = await Sale.create({
            items: saleItems,
            totalAmount,
            totalProfit: adjustedProfit,
            discount,
            extraCharge,
            finalAmount,
            paymentMethod,
            customerName,
            customerPhone,
            notes,
            soldBy: req.user._id
        });

        await sale.populate('soldBy', 'displayName email');

        // Emit real-time updates
        const io = req.app.get('io');
        io.to('dashboard').emit('sale-created', sale);
        io.to('dashboard').emit('stock-updated', {
            items: saleItems.map(item => ({
                medicineId: item.medicine,
                medicineName: item.medicineName
            }))
        });

        res.status(201).json({
            success: true,
            message: 'বিক্রয় সফলভাবে সম্পন্ন হয়েছে',
            data: sale
        });
    } catch (error) {
        console.error('Create sale error:', error);
        res.status(500).json({
            success: false,
            message: 'বিক্রয় করতে সমস্যা হয়েছে'
        });
    }
});

// Get sale by ID
router.get('/:id', authenticate, requireViewer, async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id)
            .populate('soldBy', 'displayName email');

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: 'বিক্রয় রেকর্ড পাওয়া যায়নি'
            });
        }

        // Staff can only view their own sales
        if (req.user.role === 'staff' && sale.soldBy._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'এই বিক্রয় দেখার অনুমতি আপনার নেই'
            });
        }

        res.json({
            success: true,
            data: sale
        });
    } catch (error) {
        console.error('Get sale error:', error);
        res.status(500).json({
            success: false,
            message: 'বিক্রয়ের তথ্য পেতে সমস্যা হয়েছে'
        });
    }
});

// Get sales by staff (Admin only)
router.get('/staff/:staffId', authenticate, requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 50 } = req.query;

        const query = { soldBy: req.params.staffId };

        if (startDate || endDate) {
            query.saleDate = {};
            if (startDate) query.saleDate.$gte = new Date(startDate);
            if (endDate) query.saleDate.$lte = new Date(endDate);
        }

        const sales = await Sale.find(query)
            .sort({ saleDate: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('soldBy', 'displayName email');

        const total = await Sale.countDocuments(query);

        const totals = await Sale.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$finalAmount' },
                    totalProfit: { $sum: '$totalProfit' },
                    totalSales: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: sales,
            totals: totals[0] || { totalAmount: 0, totalProfit: 0, totalSales: 0 },
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get staff sales error:', error);
        res.status(500).json({
            success: false,
            message: 'স্টাফ বিক্রয় তালিকা পেতে সমস্যা হয়েছে'
        });
    }
});

export default router;
