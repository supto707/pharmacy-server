import { verifyFirebaseToken } from '../config/firebase.js';
import User from '../models/User.model.js';

export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'অনুমোদন টোকেন প্রদান করা হয়নি'
            });
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify Firebase token
        const decodedToken = await verifyFirebaseToken(token);

        // Find or create user in database
        let user = await User.findOne({ firebaseUid: decodedToken.uid });

        if (!user) {
            // Create new user if doesn't exist
            user = await User.create({
                firebaseUid: decodedToken.uid,
                email: decodedToken.email,
                displayName: decodedToken.name || decodedToken.email.split('@')[0],
                photoURL: decodedToken.picture || null,
                role: 'staff' // Default role
            });
        } else {
            // Update last login
            user.lastLogin = new Date();
            await user.save();
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে'
            });
        }

        req.user = user;
        req.firebaseUser = decodedToken;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({
            success: false,
            message: 'অবৈধ বা মেয়াদোত্তীর্ণ টোকেন'
        });
    }
};

// Role-based access control middleware
export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'প্রথমে লগইন করুন'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'এই কাজটি করার অনুমতি আপনার নেই'
            });
        }

        next();
    };
};

// Admin only middleware
export const requireAdmin = requireRole('admin');

// Staff or Admin middleware
export const requireStaffOrAdmin = requireRole('admin', 'staff');
