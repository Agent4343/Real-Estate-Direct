const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./auth');
const propertyRoutes = require('./routes/property.routes');
const listingRoutes = require('./routes/listing.routes');
const offerRoutes = require('./routes/offer.routes');
const transactionRoutes = require('./routes/transaction.routes');
const documentRoutes = require('./routes/document.routes');

// Legacy routes (from rental app)
const itemRoutes = require('./item.routes');
const rentalRoutes = require('./rental.routes');

// Province configuration
const { getAllProvinces, calculateLandTransferTax } = require('./config/provinces');

const app = express();

// Security middleware - configure for frontend
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==========================================
// API Routes
// ==========================================

// Authentication
app.use('/api/auth', authRoutes);

// Real Estate Platform Routes
app.use('/api/properties', propertyRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/documents', documentRoutes);

// Legacy routes (keeping for backward compatibility)
app.use('/auth', authRoutes);
app.use('/items', itemRoutes);
app.use('/rentals', rentalRoutes);

// ==========================================
// Utility Endpoints
// ==========================================

// Get all provinces
app.get('/api/provinces', (req, res) => {
  res.json(getAllProvinces());
});

// Calculate land transfer tax
app.get('/api/calculate-tax', (req, res) => {
  try {
    const { province, price, isFirstTimeBuyer, isToronto, isNewlyBuilt } = req.query;

    if (!province || !price) {
      return res.status(400).json({ error: 'Province and price are required' });
    }

    const purchasePrice = parseFloat(price);
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    const result = calculateLandTransferTax(province, purchasePrice, {
      isFirstTimeBuyer: isFirstTimeBuyer === 'true',
      isToronto: isToronto === 'true',
      isNewlyBuilt: isNewlyBuilt === 'true'
    });

    res.json({
      province,
      purchasePrice,
      ...result
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    service: 'Real Estate Direct'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Real Estate Direct API',
    version: '2.0.0',
    description: 'Canadian Real Estate Buying/Selling Platform',
    endpoints: {
      auth: '/api/auth - Authentication (register, login)',
      properties: '/api/properties - Property listings CRUD',
      listings: '/api/listings - Active listing management',
      offers: '/api/offers - Offer submission and negotiation',
      transactions: '/api/transactions - Transaction workflow',
      documents: '/api/documents - Document generation and signing',
      provinces: '/api/provinces - Province information',
      calculateTax: '/api/calculate-tax - Land transfer tax calculator'
    },
    documentation: 'See IMPLEMENTATION_PLAN.md for full API documentation'
  });
});

// ==========================================
// Frontend Catch-all (for SPA routing)
// ==========================================

// Serve frontend for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// Error Handling
// ==========================================

// 404 handler for API routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format'
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      error: 'Duplicate entry',
      field: Object.keys(err.keyValue)[0]
    });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message
  });
});

// ==========================================
// Database Connection & Server Start
// ==========================================

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Database connection error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           Real Estate Direct API Server               ║
╠═══════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                          ║
║  API Base URL: http://localhost:${PORT}/api              ║
║  Health Check: http://localhost:${PORT}/health           ║
╚═══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
