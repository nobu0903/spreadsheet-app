/**
 * sheetController.js
 * Handles Google Sheets read/write operations
 * Connects to: services/sheetService.js, routes/sheetRoutes.js
 */

const sheetService = require('../services/sheetService');
const errorHandler = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Utility: process items with a concurrency limit
 * @param {Array<any>} items
 * @param {number} concurrencyLimit
 * @param {(item: any) => Promise<void>} processor
 */
async function processWithConcurrencyLimit(items, concurrencyLimit, processor) {
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => processor(item));
    executing.push(p);

    if (executing.length >= concurrencyLimit) {
      await Promise.race(executing);
      // remove settled promises
      for (let i = executing.length - 1; i >= 0; i--) {
        if (executing[i].settled) continue;
      }
    }

    // attach settled flag
    p.finally(() => {
      const idx = executing.indexOf(p);
      if (idx !== -1) {
        executing.splice(idx, 1);
      }
    });
  }

  await Promise.allSettled(executing);
}

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

    // Validate required fields（日付・店舗名・金額税込の4項目に絞る）
    const requiredFields = ['date', 'storeName', 'amountInclTax'];
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

    // Validate required fields for each receipt（日付・店舗名・金額税込）
    const requiredFields = ['date', 'storeName', 'amountInclTax'];
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

    // Group receipts by target sheet (month)
    const { getSheetNameFromDate } = sheetService;
    const receiptsBySheet = {};
    receipts.forEach((receipt, index) => {
      const sheetName = getSheetNameFromDate(receipt.date);
      if (!receiptsBySheet[sheetName]) {
        receiptsBySheet[sheetName] = [];
      }
      receiptsBySheet[sheetName].push({ receipt, index });
    });

    const sheetNames = Object.keys(receiptsBySheet);

    // Ensure all required sheets exist (with concurrency limit)
    const maxConcurrency = parseInt(process.env.SHEETS_MAX_CONCURRENCY || '5', 10);

    await processWithConcurrencyLimit(sheetNames, maxConcurrency, async (sheetName) => {
      await sheetService.ensureSheetExists(sheetName, spreadsheetId);
    });

    // Batch write per sheet (with concurrency limit)
    const results = new Array(receipts.length);
    let successCount = 0;
    let failureCount = 0;

    const sheetEntries = Object.entries(receiptsBySheet);

    await processWithConcurrencyLimit(sheetEntries, maxConcurrency, async ([sheetName, group]) => {
      try {
        const writeResults = await sheetService.batchWriteToSheet(
          sheetName,
          group.map((g) => g.receipt),
          spreadsheetId
        );

        writeResults.forEach((resItem, idx) => {
          const originalIndex = group[idx].index;
          results[originalIndex] = {
            index: originalIndex,
            success: resItem.success,
            sheetName,
            rowNumber: resItem.rowNumber
          };
          if (resItem.success) {
            successCount++;
          } else {
            failureCount++;
          }
        });
      } catch (err) {
        logger.error(`Batch write for sheet ${sheetName} failed:`, err);
        group.forEach(({ index }) => {
          results[index] = {
            index,
            success: false,
            error: err.message || 'Unknown error'
          };
          failureCount++;
        });
      }
    });

    logger.info(`Batch write completed: ${successCount} successful, ${failureCount} failed`);

    res.status(200).json({
      success: true,
      successCount,
      failureCount,
      total: receipts.length,
      results
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

