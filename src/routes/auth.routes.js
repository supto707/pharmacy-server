import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import User from '../models/User.model.js';

const router = express.Router();

// Login/Register - creates or updates user
router.post('/login', authenticate, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'সফলভাবে লগইন হয়েছে',
            user: {
                id: req.user._id,
                email: req.user.email,
                displayName: req.user.displayName,
                photoURL: req.user.photoURL,
                role: req.user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'লগইনে সমস্যা হয়েছে'
        });
    }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                email: req.user.email,
                displayName: req.user.displayName,
                photoURL: req.user.photoURL,
                role: req.user.role,
                isActive: req.user.isActive,
                lastLogin: req.user.lastLogin
            }
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'ব্যবহারকারীর তথ্য পেতে সমস্যা হয়েছে'
        });
    }
});

// Verify token
router.get('/verify', authenticate, (req, res) => {
    res.json({
        success: true,
        valid: true,
        user: {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role
        }
    });
});

export default router;
