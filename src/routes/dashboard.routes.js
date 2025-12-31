import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import Sale from '../models/Sale.model.js';
import Purchase from '../models/Purchase.model.js';
import Medicine from '../models/Medicine.model.js';
import User from '../models/User.model.js';
import StockRequest from '../models/StockRequest.model.js';

const router = express.Router();

// Get dashboard summary (Admin only)
router.get('/summary', authenticate, requireAdmin, async (req, res) => {
    try {
        // Get date range for last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        // Today's date range
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Get total medicines and stock info
        const medicineStats = await Medicine.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: null,
                    totalMedicines: { $sum: 1 },
                    totalStock: { $sum: '$stockQuantity' },
                    lowStockCount: {
                        $sum: { $cond: [{ $lte: ['$stockQuantity', '$lowStockThreshold'] }, 1, 0] }
                    },
                    outOfStockCount: {
                        $sum: { $cond: [{ $eq: ['$stockQuantity', 0] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get sales summary (last 6 months)
        const salesSummary = await Sale.aggregate([
            { $match: { saleDate: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: 1 },
                    totalRevenue: { $sum: '$finalAmount' },
                    totalProfit: { $sum: '$totalProfit' },
                    totalItemsSold: { $sum: { $sum: '$items.quantity' } }
                }
            }
        ]);

        // Get purchase summary (last 6 months)
        const purchaseSummary = await Purchase.aggregate([
            { $match: { purchaseDate: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: null,
                    totalPurchases: { $sum: 1 },
                    totalCost: { $sum: '$totalCost' },
                    totalItemsPurchased: { $sum: '$quantity' }
                }
            }
        ]);

        // Get today's sales
        const todaySales = await Sale.aggregate([
            { $match: { saleDate: { $gte: todayStart, $lte: todayEnd } } },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    revenue: { $sum: '$finalAmount' },
                    profit: { $sum: '$totalProfit' }
                }
            }
        ]);

        // Get pending stock requests
        const pendingRequests = await StockRequest.countDocuments({ status: 'pending' });

        // Get staff count
        const staffCount = await User.countDocuments({ role: 'staff', isActive: true });

        res.json({
            success: true,
            data: {
                medicines: medicineStats[0] || {
                    totalMedicines: 0,
                    totalStock: 0,
                    lowStockCount: 0,
                    outOfStockCount: 0
                },
                sales: salesSummary[0] || {
                    totalSales: 0,
                    totalRevenue: 0,
                    totalProfit: 0,
                    totalItemsSold: 0
                },
                purchases: purchaseSummary[0] || {
                    totalPurchases: 0,
                    totalCost: 0,
                    totalItemsPurchased: 0
                },
                today: todaySales[0] || {
                    count: 0,
                    revenue: 0,
                    profit: 0
                },
                pendingRequests,
                staffCount
            }
        });
    } catch (error) {
        console.error('Get dashboard summary error:', error);
        res.status(500).json({
            success: false,
            message: 'ড্যাশবোর্ড তথ্য পেতে সমস্যা হয়েছে'
        });
    }
});

// Get monthly statistics (last 6 months)
router.get('/monthly-stats', authenticate, requireAdmin, async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        // Monthly sales
        const monthlySales = await Sale.aggregate([
            { $match: { saleDate: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$saleDate' },
                        month: { $month: '$saleDate' }
                    },
                    sales: { $sum: 1 },
                    revenue: { $sum: '$finalAmount' },
                    profit: { $sum: '$totalProfit' },
                    itemsSold: { $sum: { $sum: '$items.quantity' } }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Monthly purchases
        const monthlyPurchases = await Purchase.aggregate([
            { $match: { purchaseDate: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$purchaseDate' },
                        month: { $month: '$purchaseDate' }
                    },
                    purchases: { $sum: 1 },
                    cost: { $sum: '$totalCost' },
                    itemsPurchased: { $sum: '$quantity' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Format data with Bengali month names
        const monthNames = [
            '', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
            'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
        ];

        const formattedData = [];

        // Create a map for easy lookup
        const salesMap = new Map();
        const purchasesMap = new Map();

        monthlySales.forEach(s => {
            salesMap.set(`${s._id.year}-${s._id.month}`, s);
        });

        monthlyPurchases.forEach(p => {
            purchasesMap.set(`${p._id.year}-${p._id.month}`, p);
        });

        // Generate last 6 months data
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const key = `${year}-${month}`;

            const salesData = salesMap.get(key) || { sales: 0, revenue: 0, profit: 0, itemsSold: 0 };
            const purchaseData = purchasesMap.get(key) || { purchases: 0, cost: 0, itemsPurchased: 0 };

            formattedData.push({
                month: monthNames[month],
                year,
                sales: salesData.sales,
                revenue: salesData.revenue,
                profit: salesData.profit,
                itemsSold: salesData.itemsSold,
                purchases: purchaseData.purchases,
                cost: purchaseData.cost,
                itemsPurchased: purchaseData.itemsPurchased
            });
        }

        res.json({
            success: true,
            data: formattedData
        });
    } catch (error) {
        console.error('Get monthly stats error:', error);
        res.status(500).json({
            success: false,
            message: 'মাসিক পরিসংখ্যান পেতে সমস্যা হয়েছে'
        });
    }
});

// Get top selling medicines
router.get('/top-medicines', authenticate, requireAdmin, async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const topMedicines = await Sale.aggregate([
            { $match: { saleDate: { $gte: sixMonthsAgo } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.medicine',
                    name: { $first: '$items.medicineName' },
                    power: { $first: '$items.medicinePower' },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: '$items.itemTotal' },
                    totalProfit: { $sum: '$items.profit' }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({
            success: true,
            data: topMedicines
        });
    } catch (error) {
        console.error('Get top medicines error:', error);
        res.status(500).json({
            success: false,
            message: 'সবচেয়ে বিক্রিত ঔষধ তালিকা পেতে সমস্যা হয়েছে'
        });
    }
});

// Get staff performance
router.get('/staff-performance', authenticate, requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateMatch = {};
        if (startDate) dateMatch.$gte = new Date(startDate);
        if (endDate) dateMatch.$lte = new Date(endDate);

        const match = Object.keys(dateMatch).length > 0 ? { saleDate: dateMatch } : {};

        const staffPerformance = await Sale.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$soldBy',
                    totalSales: { $sum: 1 },
                    totalRevenue: { $sum: '$finalAmount' },
                    totalProfit: { $sum: '$totalProfit' },
                    totalItems: { $sum: { $sum: '$items.quantity' } }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 1,
                    displayName: '$user.displayName',
                    email: '$user.email',
                    photoURL: '$user.photoURL',
                    role: '$user.role',
                    totalSales: 1,
                    totalRevenue: 1,
                    totalProfit: 1,
                    totalItems: 1
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        res.json({
            success: true,
            data: staffPerformance
        });
    } catch (error) {
        console.error('Get staff performance error:', error);
        res.status(500).json({
            success: false,
            message: 'স্টাফ পারফরম্যান্স তথ্য পেতে সমস্যা হয়েছে'
        });
    }
});

// Get recent transactions
router.get('/recent-transactions', authenticate, requireAdmin, async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const recentSales = await Sale.find()
            .sort({ saleDate: -1 })
            .limit(parseInt(limit))
            .populate('soldBy', 'displayName photoURL');

        const recentPurchases = await Purchase.find()
            .sort({ purchaseDate: -1 })
            .limit(parseInt(limit))
            .populate('medicine', 'name power')
            .populate('purchasedBy', 'displayName');

        res.json({
            success: true,
            data: {
                sales: recentSales,
                purchases: recentPurchases
            }
        });
    } catch (error) {
        console.error('Get recent transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'সাম্প্রতিক লেনদেন পেতে সমস্যা হয়েছে'
        });
    }
});

export default router;
