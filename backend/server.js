/**
 * server.js
 * Server entry point - starts the Express application
 * Connects to: app.js
 */

const app = require('./app');
const logger = require('./utils/logger');
const aiParseService = require('./services/aiParseService');

const PORT = process.env.PORT || 3000;

// Pre-initialize auth client for faster first request
aiParseService.initializeAuth().catch(err => {
  logger.warn('Auth pre-initialization failed:', err.message);
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Frontend available at http://localhost:${PORT}`);
  logger.info(`API health check: http://localhost:${PORT}/api/health`);
});


