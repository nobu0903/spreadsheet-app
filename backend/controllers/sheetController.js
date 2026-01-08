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

    // Extract spreadsheetId from request (optional, falls back to environment variable)
    const spreadsheetId = receiptData.spreadsheetId?.trim() || null;
    
    // Remove spreadsheetId from receiptData before passing to service
    const { spreadsheetId: _, ...receiptDataWithoutId } = receiptData;

    // Call sheet service to write receipt
    const result = await sheetService.writeReceipt(receiptDataWithoutId, spreadsheetId);

    logger.info(`Receipt written successfully to sheet ${result.sheetName}, row ${result.rowNumber}`);

    res.status(200).json(result);
  } catch (error) {
    logger.error('Error writing to Google Sheets:', error);
    errorHandler.handleError(error, req, res);
  }
}

/**
 * Batch write receipt data to Google Sheets
 * POST /api/sheets/batch-write
 */
async function batchWrite(req, res) {
  try {
    logger.info('Google Sheets batch write request received');

    // Validate request body
    if (!req.body || !Array.isArray(req.body.receipts)) {
      return res.status(400).json({
        error: {
          message: 'Request body must contain receipts array',
          statusCode: 400
        }
      });
    }

    const receipts = req.body.receipts;
    const spreadsheetId = req.body.spreadsheetId?.trim() || null;

    if (receipts.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Receipts array cannot be empty',
          statusCode: 400
        }
      });
    }

    // Validate required fields for each receipt
    const requiredFields = ['date', 'storeName', 'payer', 'amountInclTax'];
    const invalidReceipts = [];
    
    receipts.forEach((receipt, index) => {
      const missingFields = requiredFields.filter(field => !receipt[field]);
      if (missingFields.length > 0) {
        invalidReceipts.push({
          index: index,
          missingFields: missingFields
        });
      }
    });

    if (invalidReceipts.length > 0) {
      return res.status(400).json({
        error: {
          message: `Some receipts are missing required fields`,
          statusCode: 400,
          invalidReceipts: invalidReceipts
        }
      });
    }

    // Write receipts sequentially
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < receipts.length; i++) {
      const receipt = receipts[i];
      try {
        const result = await sheetService.writeReceipt(receipt, spreadsheetId);
        results.push({
          index: i,
          success: true,
          sheetName: result.sheetName,
          rowNumber: result.rowNumber
        });
        successCount++;
        logger.info(`Batch write ${i + 1}/${receipts.length}: Success`);
      } catch (writeError) {
        const errorMessage = writeError.message || 'Unknown error';
        results.push({
          index: i,
          success: false,
          error: errorMessage
        });
        failureCount++;
        logger.error(`Batch write ${i + 1}/${receipts.length}: Failed - ${errorMessage}`);
      }
    }

    logger.info(`Batch write completed: ${successCount} successful, ${failureCount} failed`);

    res.status(200).json({
      success: true,
      successCount: successCount,
      failureCount: failureCount,
      total: receipts.length,
      results: results
    });
  } catch (error) {
    logger.error('Error in batch write:', error);
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
  batchWrite,
  getHistory
};

