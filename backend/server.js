/**
 * server.js
 * Server entry point - starts the Express application
 * Connects to: app.js
 */

const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Frontend available at http://localhost:${PORT}`);
  logger.info(`API health check: http://localhost:${PORT}/api/health`);
});


