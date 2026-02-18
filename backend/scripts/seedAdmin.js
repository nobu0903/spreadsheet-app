/**
 * seedAdmin.js
 * Ensures default admin user exists (username: admin, password: admin)
 */

const User = require('../models/User');
const logger = require('../utils/logger');

async function ensureAdminUser() {
  try {
    const existing = await User.findOne({ username: 'admin' });
    if (existing) {
      logger.info('Admin user already exists');
      return;
    }
    await User.create({
      username: 'admin',
      password: 'admin',
      role: 'admin'
    });
    logger.info('Default admin user created (username: admin, password: admin)');
  } catch (err) {
    logger.error('Seed admin error:', err.message);
  }
}

module.exports = { ensureAdminUser };
