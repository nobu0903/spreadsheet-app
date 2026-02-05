/**
 * sheetService.js
 * Google Sheets API integration for reading/writing receipt data
 * Connects to: controllers/sheetController.js
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

let sheetsClient = null;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

// Cache for sheet existence checks (per process)
const sheetExistenceCache = new Set();

if (!SPREADSHEET_ID) {
  logger.warn('GOOGLE_SHEETS_ID environment variable is not set');
}

/**
 * Retry helper with exponential backoff for transient / rate limit errors
 * @param {Function} fn - async function to execute
 * @param {number} maxRetries
 * @param {number} baseDelay - in milliseconds
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const status = error.code || error.status || error.statusCode;
      const message = error.message || '';

      const isRateLimitError =
        status === 429 ||
        message.toLowerCase().includes('rate limit') ||
        message.toLowerCase().includes('quota') ||
        (status >= 500 && status < 600);

      if (!isRateLimitError || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(
        `Transient error detected (status=${status || 'n/a'}). Retrying after ${delay}ms (attempt ${
          attempt + 1
        }/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Initialize Google Sheets API client
 */
async function getSheetsClient() {
  if (!sheetsClient) {
    // Support for Render: Use GOOGLE_CREDENTIALS (JSON string) or GOOGLE_CREDENTIALS_PATH (file path)
    let authOptions = {
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    };
    
    if (process.env.GOOGLE_CREDENTIALS) {
      // Render deployment: credentials as JSON string in environment variable
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        authOptions.credentials = credentials;
        logger.info('Using credentials from GOOGLE_CREDENTIALS environment variable');
      } catch (error) {
        logger.error('Failed to parse GOOGLE_CREDENTIALS:', error);
        throw new Error('Invalid GOOGLE_CREDENTIALS format. Must be valid JSON string.');
      }
    } else if (process.env.GOOGLE_CREDENTIALS_PATH) {
      // Local development: credentials from file path
      const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
      if (!fs.existsSync(credentialsPath)) {
        throw new Error(`Credentials file not found at: ${credentialsPath}`);
      }
      authOptions.keyFile = credentialsPath;
      logger.info(`Using credentials from file: ${credentialsPath}`);
    } else {
      // Production environment should have GOOGLE_CREDENTIALS set
      if (process.env.NODE_ENV === 'production') {
        throw new Error('GOOGLE_CREDENTIALS environment variable is required in production. Please set it in Render dashboard.');
      }
      // Fallback for local development
      const credentialsPath = path.join(__dirname, '../config/credentials.json');
      if (!fs.existsSync(credentialsPath)) {
        throw new Error(`Credentials file not found at: ${credentialsPath}. Please set GOOGLE_CREDENTIALS or GOOGLE_CREDENTIALS_PATH environment variable.`);
      }
      authOptions.keyFile = credentialsPath;
      logger.info(`Using credentials from default file: ${credentialsPath}`);
    }
    
    const auth = new google.auth.GoogleAuth(authOptions);
    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: authClient });
    
    logger.info('Google Sheets API client initialized');
  }
  return sheetsClient;
}

/**
 * Generate sheet name from date (format: YYYY_MM)
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Sheet name like "2025_01"
 */
function getSheetNameFromDate(dateString) {
  if (!dateString) {
    const now = new Date();
    return `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  
  return `${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Ensure sheet exists, create if it doesn't
 * @param {string} sheetName - Name of the sheet
 * @param {string|null} spreadsheetId - Optional spreadsheet ID (falls back to environment variable)
 */
async function ensureSheetExists(sheetName, spreadsheetId = null) {
  const sheets = await getSheetsClient();
  const targetSpreadsheetId = spreadsheetId || SPREADSHEET_ID;

  if (!targetSpreadsheetId) {
    throw new Error('Spreadsheet ID is required for ensureSheetExists');
  }

  const cacheKey = `${targetSpreadsheetId}_${sheetName}`;
  if (sheetExistenceCache.has(cacheKey)) {
    return;
  }

  try {
    await retryWithBackoff(async () => {
      // Get spreadsheet metadata
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: targetSpreadsheetId
      });

      const existingSheets = spreadsheet.data.sheets || [];
      const sheetExists = existingSheets.some(
        (sheet) => sheet.properties.title === sheetName
      );

      if (!sheetExists) {
        logger.info(`Creating new sheet: ${sheetName}`);

        // Create new sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: targetSpreadsheetId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }
            ]
          }
        });

        // Add header row（日付・店舗名・金額税抜・金額税込の4列のみ）
        const headers = [
          'Date',
          'Store name',
          'Amount (tax excluded)',
          'Amount (tax included)'
        ];

        await sheets.spreadsheets.values.update({
          spreadsheetId: targetSpreadsheetId,
          range: `${sheetName}!A1:D1`,
          valueInputOption: 'RAW',
          resource: {
            values: [headers]
          }
        });

        logger.info(`Sheet ${sheetName} created with headers`);
      }

      // cache regardless of existed or newly created
      sheetExistenceCache.add(cacheKey);
    });
  } catch (error) {
    logger.error(`Error ensuring sheet exists: ${error.message}`);
    throw error;
  }
}

/**
 * Batch write multiple receipts into the same sheet using a single API call
 * @param {string} sheetName
 * @param {Array<Object>} receipts
 * @param {string|null} spreadsheetId
 * @returns {Promise<Array<{success: boolean, rowNumber: number}>>}
 */
async function batchWriteToSheet(sheetName, receipts, spreadsheetId = null) {
  const sheets = await getSheetsClient();
  const targetSpreadsheetId = spreadsheetId || SPREADSHEET_ID;

  if (!targetSpreadsheetId) {
    throw new Error('Spreadsheet ID is required');
  }

  const rows = receipts.map((receiptData) => [
    receiptData.date || '',
    receiptData.storeName || '',
    receiptData.amountExclTax !== null &&
    receiptData.amountExclTax !== undefined
      ? receiptData.amountExclTax
      : '',
    receiptData.amountInclTax !== null &&
    receiptData.amountInclTax !== undefined
      ? receiptData.amountInclTax
      : ''
  ]);

  const response = await retryWithBackoff(async () => {
    return sheets.spreadsheets.values.append({
      spreadsheetId: targetSpreadsheetId,
      range: `${sheetName}!A:D`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: rows
      }
    });
  });

  const updatedRange = response.data.updates?.updatedRange;
  const startRow = updatedRange
    ? parseInt(updatedRange.match(/A(\d+)/)?.[1] || '0', 10)
    : 0;

  logger.info(
    `Batch wrote ${rows.length} receipts to sheet ${sheetName}, starting at row ${startRow}`
  );

  return rows.map((_, index) => ({
    success: true,
    rowNumber: startRow + index
  }));
}

/**
 * Write receipt data to Google Sheets
 * @param {Object} receiptData - Structured receipt data
 * @param {string|null} spreadsheetId - Optional spreadsheet ID (falls back to environment variable)
 * @returns {Promise<Object>} Write confirmation
 */
async function writeReceipt(receiptData, spreadsheetId = null) {
  try {
    // Use provided spreadsheetId or fall back to environment variable
    const targetSpreadsheetId = spreadsheetId || SPREADSHEET_ID;
    
    if (!targetSpreadsheetId) {
      throw new Error('Spreadsheet ID is required. Please provide it in the request or set GOOGLE_SHEETS_ID environment variable.');
    }

    const sheetName = getSheetNameFromDate(receiptData.date);
    
    // Ensure sheet exists (pass spreadsheetId to ensureSheetExists)
    await ensureSheetExists(sheetName, targetSpreadsheetId);

    // Reuse batchWriteToSheet with a single receipt for consistency
    const [result] = await batchWriteToSheet(
      sheetName,
      [receiptData],
      targetSpreadsheetId
    );

    const rowNumber = result.rowNumber || 0;

    logger.info(`Receipt data written to sheet ${sheetName}, row ${rowNumber}`);

    return {
      success: true,
      rowNumber: rowNumber,
      sheetName: sheetName
    };
  } catch (error) {
    logger.error('Error writing to Google Sheets:', error);
    throw new Error(`Failed to write to Google Sheets: ${error.message}`);
  }
}

module.exports = {
  writeReceipt,
  batchWriteToSheet,
  getSheetNameFromDate,
  ensureSheetExists
};


