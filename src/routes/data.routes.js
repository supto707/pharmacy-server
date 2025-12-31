import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import Medicine from '../models/Medicine.model.js';
import Sale from '../models/Sale.model.js';
import Purchase from '../models/Purchase.model.js';
import StockRequest from '../models/StockRequest.model.js';

const router = express.Router();

// Erase all data (Admin only) - DANGER ZONE
router.delete('/erase', authenticate, requireAdmin, async (req, res) => {
    try {
        // Delete all medicines
        await Medicine.deleteMany({});

        // Delete all sales
        await Sale.deleteMany({});

        // Delete all purchases
        await Purchase.deleteMany({});

        // Delete all stock requests
        await StockRequest.deleteMany({});

        // Emit real-time update
        const io = req.app.get('io');
        io.to('dashboard').emit('data-erased');

        res.json({
            success: true,
            message: 'সমস্ত ডেটা সফলভাবে মুছে ফেলা হয়েছে'
        });
    } catch (error) {
        console.error('Erase data error:', error);
        res.status(500).json({
            success: false,
            message: 'ডেটা মুছতে সমস্যা হয়েছে'
        });
    }
});

// Export all data as JSON (for client-side Excel conversion)
router.get('/export', authenticate, requireAdmin, async (req, res) => {
    try {
        const { type } = req.query;

        let data = {};

        switch (type) {
            case 'medicines':
                data = await Medicine.find({ isActive: true })
                    .select('-__v -createdBy -updatedBy')
                    .lean();
                break;
            case 'sales':
                data = await Sale.find()
                    .populate('soldBy', 'displayName email')
                    .select('-__v')
                    .lean();
                break;
            case 'purchases':
                data = await Purchase.find()
                    .populate('medicine', 'name power')
                    .populate('purchasedBy', 'displayName')
                    .select('-__v')
                    .lean();
                break;
            case 'all':
            default:
                const medicines = await Medicine.find({ isActive: true }).select('-__v').lean();
                const sales = await Sale.find().populate('soldBy', 'displayName').select('-__v').lean();
                const purchases = await Purchase.find().populate('medicine', 'name power').select('-__v').lean();
                const requests = await StockRequest.find().populate('medicine', 'name power').select('-__v').lean();

                data = {
                    medicines,
                    sales,
                    purchases,
                    stockRequests: requests
                };
                break;
        }

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Export data error:', error);
        res.status(500).json({
            success: false,
            message: 'ডেটা রপ্তানি করতে সমস্যা হয়েছে'
        });
    }
});

export default router;
