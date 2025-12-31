import express from 'express';
import { authenticate, requireStaffOrAdmin, requireAdmin } from '../middleware/auth.middleware.js';
import StockRequest from '../models/StockRequest.model.js';
import Medicine from '../models/Medicine.model.js';

const router = express.Router();

// Get stock requests
router.get('/', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 50 } = req.query;

        const query = {};

        // Staff sees only their requests, Admin sees all
        if (req.user.role === 'staff') {
            query.requestedBy = req.user._id;
        }

        if (status) {
            query.status = status;
        }

        const requests = await StockRequest.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('medicine', 'name nameBangla power unit stockQuantity')
            .populate('requestedBy', 'displayName email')
            .populate('processedBy', 'displayName');

        const total = await StockRequest.countDocuments(query);

        res.json({
            success: true,
            data: requests,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get stock requests error:', error);
        res.status(500).json({
            success: false,
            message: 'স্টক রিকোয়েস্ট তালিকা পেতে সমস্যা হয়েছে'
        });
    }
});

// Create stock request (Staff)
router.post('/', authenticate, requireStaffOrAdmin, async (req, res) => {
    try {
        const { medicineId, requestedQuantity, reason, priority = 'normal' } = req.body;

        // Verify medicine exists
        const medicine = await Medicine.findById(medicineId);
        if (!medicine) {
            return res.status(404).json({
                success: false,
                message: 'ঔষধ পাওয়া যায়নি'
            });
        }

        // Check for existing pending request
        const existingRequest = await StockRequest.findOne({
            medicine: medicineId,
            requestedBy: req.user._id,
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: 'এই ঔষধের জন্য ইতিমধ্যে একটি পেন্ডিং রিকোয়েস্ট আছে'
            });
        }

        const request = await StockRequest.create({
            medicine: medicineId,
            requestedQuantity,
            reason,
            priority,
            requestedBy: req.user._id
        });

        await request.populate('medicine', 'name nameBangla power unit stockQuantity');
        await request.populate('requestedBy', 'displayName email');

        // Emit real-time update
        const io = req.app.get('io');
        io.to('dashboard').emit('stock-request-created', request);

        res.status(201).json({
            success: true,
            message: 'স্টক রিকোয়েস্ট সফলভাবে জমা দেওয়া হয়েছে',
            data: request
        });
    } catch (error) {
        console.error('Create stock request error:', error);
        res.status(500).json({
            success: false,
            message: 'স্টক রিকোয়েস্ট জমা দিতে সমস্যা হয়েছে'
        });
    }
});

// Process stock request (Admin only)
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { status, adminNotes } = req.body;

        if (!['approved', 'rejected', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'অবৈধ স্ট্যাটাস'
            });
        }

        const request = await StockRequest.findByIdAndUpdate(
            req.params.id,
            {
                status,
                adminNotes,
                processedBy: req.user._id,
                processedAt: new Date()
            },
            { new: true }
        )
            .populate('medicine', 'name nameBangla power unit stockQuantity')
            .populate('requestedBy', 'displayName email')
            .populate('processedBy', 'displayName');

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'রিকোয়েস্ট পাওয়া যায়নি'
            });
        }

        // Emit real-time update
        const io = req.app.get('io');
        io.to('dashboard').emit('stock-request-updated', request);

        const statusMessages = {
            approved: 'রিকোয়েস্ট অনুমোদিত হয়েছে',
            rejected: 'রিকোয়েস্ট প্রত্যাখ্যান করা হয়েছে',
            completed: 'রিকোয়েস্ট সম্পন্ন হয়েছে'
        };

        res.json({
            success: true,
            message: statusMessages[status],
            data: request
        });
    } catch (error) {
        console.error('Process stock request error:', error);
        res.status(500).json({
            success: false,
            message: 'রিকোয়েস্ট প্রক্রিয়া করতে সমস্যা হয়েছে'
        });
    }
});

// Get pending requests count (for notifications)
router.get('/pending-count', authenticate, requireAdmin, async (req, res) => {
    try {
        const count = await StockRequest.countDocuments({ status: 'pending' });
        res.json({
            success: true,
            count
        });
    } catch (error) {
        console.error('Get pending count error:', error);
        res.status(500).json({
            success: false,
            message: 'পেন্ডিং রিকোয়েস্ট সংখ্যা পেতে সমস্যা হয়েছে'
        });
    }
});

export default router;
