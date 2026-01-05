/**
 * sheetController.js
 * Handles Google Sheets read/write operations
 * Connects to: services/sheetService.js, routes/sheetRoutes.js
 */

const sheetService = require('../services/sheetService');
const errorHandler = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Write receipt data to Google Sheets
 * POST /api/sheets/write
 */
async function writeToSheet(req, res) {
  try {
    logger.info('Google Sheets write request received');

    // Validate request body
    if (!req.body) {
      return res.status(400).json({
        error: {
          message: 'Request body is required',
          statusCode: 400
        }
      });
    }

    const receiptData = req.body;

    // Validate required fields
    const requiredFields = ['date', 'storeName', 'payer', 'amountInclTax'];
    const missingFields = requiredFields.filter(field => !receiptData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: {
          message: `Missing required fields: ${missingFields.join(', ')}`,
          statusCode: 400
        }
      });
    }

    // Call sheet service to write receipt
    const result = await sheetService.writeReceipt(receiptData);

    logger.info(`Receipt written successfully to sheet ${result.sheetName}, row ${result.rowNumber}`);

    res.status(200).json(result);
  } catch (error) {
    logger.error('Error writing to Google Sheets:', error);
    errorHandler.handleError(error, req, res);
  }
}

/**
 * Get receipt history from Google Sheets
 * GET /api/sheets/history
 */
async function getHistory(req, res) {
  try {
    logger.info('History retrieval request received');

    // Extract query parameters
    const options = {
      month: req.query.month || null,
      limit: req.query.limit ? parseInt(req.query.limit) : 50
    };

    // Validate limit
    if (isNaN(options.limit) || options.limit < 1 || options.limit > 1000) {
      options.limit = 50;
    }

    // Call sheet service to get history
    const receipts = await sheetService.getHistory(options);

    logger.info(`Retrieved ${receipts.length} receipts from history`);

    res.status(200).json({
      receipts: receipts,
      total: receipts.length
    });
  } catch (error) {
    logger.error('Error retrieving history:', error);
    errorHandler.handleError(error, req, res);
  }
}

module.exports = {
  writeToSheet,
  getHistory
};

