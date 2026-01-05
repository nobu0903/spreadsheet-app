/**
 * errorHandler.js
 * Centralized error handling utility
 * Used by: All controllers
 */

const logger = require('./logger');

function handleError(error, req, res, next) {
  logger.error('Error occurred:', error);

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  res.status(statusCode).json({
    error: {
      message,
      statusCode
    }
  });
}

module.exports = {
  handleError
};


