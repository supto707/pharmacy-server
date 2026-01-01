import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import { initializeFirebase } from './config/firebase.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import medicineRoutes from './routes/medicine.routes.js';
import saleRoutes from './routes/sale.routes.js';
import purchaseRoutes from './routes/purchase.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import requestRoutes from './routes/request.routes.js';
import userRoutes from './routes/user.routes.js';
import dataRoutes from './routes/data.routes.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Allowed origins
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'https://pharmacy-client-supto.vercel.app'
];

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});

// Apply rate limiting to all requests
app.use('/api/', limiter);

app.use(express.json());

// Initialize Firebase Admin
initializeFirebase();

// Connect to MongoDB
connectDB();

// Basic Routes
app.get('/', (req, res) => {
  res.send('Pharmacy Buddy Server is Running! 🚀');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/users', userRoutes);
app.use('/api/data', dataRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[Error] ${err.stack}`);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    status,
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-dashboard', () => {
    socket.join('dashboard');
    console.log('Client joined dashboard room');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// Export app for Vercel
export default app;

if (!process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Socket.io ready for connections`);
  });
}

export { io };
