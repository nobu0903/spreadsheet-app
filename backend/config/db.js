/**
 * db.js
 * MongoDB connection via Mongoose
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  if (!MONGODB_URI) {
    logger.warn('MONGODB_URI not set. Auth features will not work.');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('MongoDB connected');
    const { ensureAdminUser } = require('../scripts/seedAdmin');
    await ensureAdminUser();
  } catch (err) {
    logger.error('MongoDB connection error:', err.message);
    throw err;
  }
}

module.exports = { connectDB };
