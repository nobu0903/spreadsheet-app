/**
 * server.js
 * Server entry point - starts the Express application
 * Connects to: app.js
 */

const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const { connectDB } = require('./config/db');
const aiParseService = require('./services/aiParseService');

const PORT = parseInt(process.env.PORT || '3000', 10);

// Connect to MongoDB (seed admin is run inside connectDB after connect)
connectDB().catch(err => {
  logger.error('MongoDB connection failed:', err.message);
});

// Pre-initialize auth client for faster first request
aiParseService.initializeAuth().catch(err => {
  logger.warn('Auth pre-initialization failed:', err.message);
});

function tryListen(port) {
  const server = http.createServer(app);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} is in use, trying ${port + 1}`);
      tryListen(port + 1);
    } else {
      throw err;
    }
  });
  server.listen(port, () => {
    logger.info(`Server running on port ${port}`);
    logger.info(`Frontend available at http://localhost:${port}`);
    logger.info(`API health check: http://localhost:${port}/api/health`);
  });
}

tryListen(PORT);


