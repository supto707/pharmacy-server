import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import User from '../models/User.model.js';

const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const { role, isActive, page = 1, limit = 50 } = req.query;

        const query = {};
        if (role) query.role = role;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .select('-firebaseUid');

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'ব্যবহারকারী তালিকা পেতে সমস্যা হয়েছে'
        });
    }
});

// Get single user (Admin only)
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-firebaseUid');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'ব্যবহারকারী পাওয়া যায়নি'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'ব্যবহারকারীর তথ্য পেতে সমস্যা হয়েছে'
        });
    }
});

// Update user role (Admin only)
router.patch('/:id/role', authenticate, requireAdmin, async (req, res) => {
    try {
        const { role } = req.body;

        if (!['admin', 'staff', 'viewer'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'অবৈধ ভূমিকা'
            });
        }

        // Prevent removing own admin role
        if (req.params.id === req.user._id.toString() && role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'নিজের অ্যাডমিন ভূমিকা সরাতে পারবেন না'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-firebaseUid');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'ব্যবহারকারী পাওয়া যায়নি'
            });
        }

        res.json({
            success: true,
            message: `ব্যবহারকারীর ভূমিকা "${role === 'admin' ? 'অ্যাডমিন' : role === 'staff' ? 'স্টাফ' : 'ভিউয়ার'}" হিসেবে আপডেট করা হয়েছে`,
            data: user
        });
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({
            success: false,
            message: 'ভূমিকা আপডেট করতে সমস্যা হয়েছে'
        });
    }
});

// Toggle user active status (Admin only)
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
    try {
        const { isActive } = req.body;

        // Prevent deactivating self
        if (req.params.id === req.user._id.toString() && isActive === false) {
            return res.status(400).json({
                success: false,
                message: 'নিজের অ্যাকাউন্ট নিষ্ক্রিয় করতে পারবেন না'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true }
        ).select('-firebaseUid');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'ব্যবহারকারী পাওয়া যায়নি'
            });
        }

        res.json({
            success: true,
            message: `ব্যবহারকারী ${isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'} করা হয়েছে`,
            data: user
        });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            success: false,
            message: 'স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে'
        });
    }
});

// Get staff list (for dropdowns)
router.get('/list/staff', authenticate, requireAdmin, async (req, res) => {
    try {
        const staff = await User.find({ role: 'staff', isActive: true })
            .select('displayName email photoURL')
            .sort({ displayName: 1 });

        res.json({
            success: true,
            data: staff
        });
    } catch (error) {
        console.error('Get staff list error:', error);
        res.status(500).json({
            success: false,
            message: 'স্টাফ তালিকা পেতে সমস্যা হয়েছে'
        });
    }
});

export default router;
