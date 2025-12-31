import express from 'express';
import { authenticate, requireAdmin, requireStaffOrAdmin, requireViewer } from '../middleware/auth.middleware.js';
import Medicine from '../models/Medicine.model.js';
import multer from 'multer';
import * as XLSX from 'xlsx';

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Get public medicines (No Auth Required)
router.get('/public', async (req, res) => {
    try {
        const { limit = 12 } = req.query;
        const query = { isActive: true };

        const medicines = await Medicine.find(query)
            .select('name nameBangla power unit sellingPrice manufacturer category image')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: medicines
        });
    } catch (error) {
        console.error('Get public medicines error:', error);
        res.status(500).json({
            success: false,
            message: 'ঔষধের তালিকা পেতে সমস্যা হয়েছে'
        });
    }
});

// Get all medicines (Viewer, Staff and Admin)
router.get('/', authenticate, requireViewer, async (req, res) => {
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
router.get('/:id', authenticate, requireViewer, async (req, res) => {
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

// Create medicine (Staff and Admin)
router.post('/', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const {
            name,
            nameBangla,
            power,
            unit,
            unitsPerPackage,
            tradePrice,
            discountPercent,
            discountAmount,
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
            unit,
            unitsPerPackage,
            tradePrice,
            discountPercent,
            discountAmount,
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

// Bulk Import Medicines (Staff and Admin)
router.post('/bulk-import', authenticate, requireStaffOrAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'কোন ফাইল আপলোড করা হয়নি'
            });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        if (!data || data.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'ফাইলে কোন তথ্য পাওয়া যায়নি'
            });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        const medicinesToInsert = [];

        for (const [index, row] of data.entries()) {
            try {
                // Basic validation
                if (!row.name || !row.sellingPrice) {
                    throw new Error('নাম এবং বিক্রয় মূল্য আবশ্যক');
                }

                const medicineData = {
                    name: row.name,
                    nameBangla: row.nameBangla || '',
                    power: row.power || '',
                    unit: row.unit || 'পিস',
                    unitsPerPackage: Number(row.unitsPerPackage) || 1,
                    tradePrice: Number(row.tradePrice) || 0,
                    purchasePrice: Number(row.purchasePrice) || 0,
                    sellingPrice: Number(row.sellingPrice) || 0,
                    stockQuantity: Number(row.stockQuantity) || 0,
                    lowStockThreshold: Number(row.lowStockThreshold) || 10,
                    manufacturer: row.manufacturer || '',
                    category: row.category || 'সাধারণ',
                    description: row.description || '',
                    discountPercent: Number(row.discountPercent) || 0,
                    discountAmount: Number(row.discountAmount) || 0,
                    isActive: true,
                    createdBy: req.user._id
                };

                medicinesToInsert.push(medicineData);
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${index + 2}: ${error.message}`);
            }
        }

        if (medicinesToInsert.length > 0) {
            await Medicine.insertMany(medicinesToInsert);

            // Emit real-time update
            const io = req.app.get('io');
            io.to('dashboard').emit('medicines-bulk-added', { count: medicinesToInsert.length });
        }

        res.json({
            success: true,
            message: `${results.success} টি ঔষধ সফলভাবে ইম্পোর্ট করা হয়েছে`,
            results
        });

    } catch (error) {
        console.error('Bulk import error:', error);
        res.status(500).json({
            success: false,
            message: 'ইম্পোর্ট করতে সমস্যা হয়েছে'
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
router.get('/meta/categories', authenticate, requireViewer, async (req, res) => {
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
