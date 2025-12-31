import admin from 'firebase-admin';

let firebaseInitialized = false;

export const initializeFirebase = () => {
    try {
        // Check if Firebase credentials are provided via environment variable
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
        const projectId = process.env.FIREBASE_PROJECT_ID || 'pharmacy-5449b';

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(serviceAccount))
            });
            firebaseInitialized = true;
        } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            // Alternative: Use individual environment variables
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: projectId,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
                })
            });
            firebaseInitialized = true;
        } else {
            console.warn('⚠️ Firebase Admin credentials not configured.');
            console.warn('   To enable Google Auth verification, please add Firebase Service Account');
            console.warn('   credentials to your .env file. See .env.example for details.');
            console.warn('   For now, running in development mode without token verification.');
            return;
        }

        console.log('✅ Firebase Admin initialized successfully');
    } catch (error) {
        console.error('❌ Firebase initialization error:', error.message);
        console.warn('   Running without Firebase authentication.');
    }
};

export const verifyFirebaseToken = async (token) => {
    if (!firebaseInitialized) {
        // Development mode: Skip verification but parse the token
        console.warn('⚠️ Firebase not initialized. Skipping token verification (Development mode).');
        // For development, we'll trust the token and decode it manually
        // This is NOT secure for production!
        try {
            // Decode the JWT token without verification (development only)
            const base64Payload = token.split('.')[1];
            const payload = Buffer.from(base64Payload, 'base64').toString('utf-8');
            const decoded = JSON.parse(payload);
            return {
                uid: decoded.user_id || decoded.sub,
                email: decoded.email,
                name: decoded.name,
                picture: decoded.picture
            };
        } catch (e) {
            throw new Error('Invalid token format');
        }
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

export const isFirebaseInitialized = () => firebaseInitialized;
