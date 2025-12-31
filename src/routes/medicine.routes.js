import express from 'express';
import { authenticate, requireAdmin, requireStaffOrAdmin } from '../middleware/auth.middleware.js';
import Medicine from '../models/Medicine.model.js';

const router = express.Router();

// Get all medicines (Staff and Admin)
router.get('/', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const {
            search,
            category,
            lowStock,
            outOfStock,
            page = 1,
            limit = 50,
            sortBy = 'name',
            sortOrder = 'asc'
        } = req.query;

        const query = { isActive: true };

        // Search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { nameBangla: { $regex: search, $options: 'i' } },
                { manufacturer: { $regex: search, $options: 'i' } }
            ];
        }

        // Category filter
        if (category) {
            query.category = category;
        }

        // Low stock filter
        if (lowStock === 'true') {
            query.$expr = { $lte: ['$stockQuantity', '$lowStockThreshold'] };
        }

        // Out of stock filter
        if (outOfStock === 'true') {
            query.stockQuantity = 0;
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const medicines = await Medicine.find(query)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('createdBy', 'displayName')
            .populate('updatedBy', 'displayName');

        const total = await Medicine.countDocuments(query);

        res.json({
            success: true,
            data: medicines,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get medicines error:', error);
        res.status(500).json({
            success: false,
            message: 'ঔষধের তালিকা পেতে সমস্যা হয়েছে'
        });
    }
});

// Get single medicine
router.get('/:id', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id)
            .populate('createdBy', 'displayName')
            .populate('updatedBy', 'displayName');

        if (!medicine) {
            return res.status(404).json({
                success: false,
                message: 'ঔষধ পাওয়া যায়নি'
            });
        }

        res.json({
            success: true,
            data: medicine
        });
    } catch (error) {
        console.error('Get medicine error:', error);
        res.status(500).json({
            success: false,
            message: 'ঔষধের তথ্য পেতে সমস্যা হয়েছে'
        });
    }
});

// Create medicine (Admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const {
            name,
            nameBangla,
            power,
            unit,
            unitsPerPackage,
            purchasePrice,
            sellingPrice,
            stockQuantity,
            lowStockThreshold,
            manufacturer,
            category,
            expiryDate,
            batchNumber,
            description
        } = req.body;

        const medicine = await Medicine.create({
            name,
            nameBangla,
            power,
            unit,
            unitsPerPackage,
            purchasePrice,
            sellingPrice,
            stockQuantity,
            lowStockThreshold,
            manufacturer,
            category,
            expiryDate,
            batchNumber,
            description,
            createdBy: req.user._id
        });

        // Emit real-time update
        const io = req.app.get('io');
        io.to('dashboard').emit('medicine-added', medicine);

        res.status(201).json({
            success: true,
            message: 'ঔষধ সফলভাবে যোগ করা হয়েছে',
            data: medicine
        });
    } catch (error) {
        console.error('Create medicine error:', error);
        res.status(500).json({
            success: false,
            message: 'ঔষধ যোগ করতে সমস্যা হয়েছে'
        });
    }
});

// Update medicine (Admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const medicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            {
                ...req.body,
                updatedBy: req.user._id
            },
            { new: true, runValidators: true }
        );

        if (!medicine) {
            return res.status(404).json({
                success: false,
                message: 'ঔষধ পাওয়া যায়নি'
            });
        }

        // Emit real-time update
        const io = req.app.get('io');
        io.to('dashboard').emit('medicine-updated', medicine);

        res.json({
            success: true,
            message: 'ঔষধের তথ্য আপডেট করা হয়েছে',
            data: medicine
        });
    } catch (error) {
        console.error('Update medicine error:', error);
        res.status(500).json({
            success: false,
            message: 'ঔষধের তথ্য আপডেট করতে সমস্যা হয়েছে'
        });
    }
});

// Delete medicine (Admin only - soft delete)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const medicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            { isActive: false, updatedBy: req.user._id },
            { new: true }
        );

        if (!medicine) {
            return res.status(404).json({
                success: false,
                message: 'ঔষধ পাওয়া যায়নি'
            });
        }

        // Emit real-time update
        const io = req.app.get('io');
        io.to('dashboard').emit('medicine-deleted', { id: req.params.id });

        res.json({
            success: true,
            message: 'ঔষধ সফলভাবে মুছে ফেলা হয়েছে'
        });
    } catch (error) {
        console.error('Delete medicine error:', error);
        res.status(500).json({
            success: false,
            message: 'ঔষধ মুছতে সমস্যা হয়েছে'
        });
    }
});

// Get categories list
router.get('/meta/categories', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const categories = await Medicine.distinct('category', { isActive: true });
        res.json({
            success: true,
            data: categories.filter(c => c)
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'ক্যাটাগরি তালিকা পেতে সমস্যা হয়েছে'
        });
    }
});

export default router;
