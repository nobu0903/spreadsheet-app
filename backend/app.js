/**
 * app.js
 * Express application setup and middleware configuration
 * Connects to: server.js, all route files
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./utils/errorHandler');
const logger = require('./utils/logger');

// Import routes and middleware
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ocrRoutes = require('./routes/ocrRoutes');
const aiRoutes = require('./routes/aiRoutes');
const sheetRoutes = require('./routes/sheetRoutes');
const { authMiddleware } = require('./middleware/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Route root path to login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Admin API routes (require JWT + admin role)
app.use('/api/admin', adminRoutes);

// Protected API routes (require JWT)
app.use('/api/ocr', authMiddleware, ocrRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/sheets', authMiddleware, sheetRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  errorHandler.handleError(err, req, res, next);
});

logger.info('Express app configured');

module.exports = app;


