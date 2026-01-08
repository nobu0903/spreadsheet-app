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

if (!SPREADSHEET_ID) {
  logger.warn('GOOGLE_SHEETS_ID environment variable is not set');
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
  
  try {
    // Get spreadsheet metadata
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: targetSpreadsheetId
    });

    const existingSheets = spreadsheet.data.sheets || [];
    const sheetExists = existingSheets.some(sheet => sheet.properties.title === sheetName);

    if (!sheetExists) {
      logger.info(`Creating new sheet: ${sheetName}`);
      
      // Create new sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: targetSpreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      });

      // Add header row
      const headers = [
        'Date',
        'Store name',
        'Payer',
        'Amount (tax excluded)',
        'Amount (tax included)',
        'Tax',
        'Payment method',
        'Expense category',
        'Project / client name',
        'Notes',
        'Receipt image URL'
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: targetSpreadsheetId,
        range: `${sheetName}!A1:K1`,
        valueInputOption: 'RAW',
        resource: {
          values: [headers]
        }
      });

      logger.info(`Sheet ${sheetName} created with headers`);
    }
  } catch (error) {
    logger.error(`Error ensuring sheet exists: ${error.message}`);
    throw error;
  }
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

    const sheets = await getSheetsClient();
    const sheetName = getSheetNameFromDate(receiptData.date);
    
    // Ensure sheet exists (pass spreadsheetId to ensureSheetExists)
    await ensureSheetExists(sheetName, targetSpreadsheetId);

    // Prepare row data in the correct order
    const rowData = [
      receiptData.date || '',
      receiptData.storeName || '',
      receiptData.payer || '',
      receiptData.amountExclTax !== null && receiptData.amountExclTax !== undefined ? receiptData.amountExclTax : '',
      receiptData.amountInclTax !== null && receiptData.amountInclTax !== undefined ? receiptData.amountInclTax : '',
      receiptData.tax !== null && receiptData.tax !== undefined ? receiptData.tax : '',
      receiptData.paymentMethod || '',
      receiptData.expenseCategory || '',
      receiptData.projectName || '',
      receiptData.notes || '',
      receiptData.receiptImageUrl || ''
    ];

    // Append row to sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: targetSpreadsheetId,
      range: `${sheetName}!A:K`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData]
      }
    });

    const updatedRange = response.data.updates?.updatedRange;
    const rowNumber = updatedRange ? parseInt(updatedRange.match(/A(\d+)/)?.[1] || '0') : 0;

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

/**
 * Get receipt history from Google Sheets
 * @param {Object} options - Query options (month, limit, etc.)
 * @returns {Promise<Array>} List of receipt records
 */
async function getHistory(options = {}) {
  try {
    if (!SPREADSHEET_ID) {
      throw new Error('GOOGLE_SHEETS_ID environment variable is not set');
    }

    const sheets = await getSheetsClient();
    const limit = options.limit || 50;
    
    let sheetName;
    if (options.month) {
      // Format: "2025-01" -> "2025_01"
      sheetName = options.month.replace('-', '_');
    } else {
      // Use current month
      sheetName = getSheetNameFromDate();
    }

    try {
      // Read data from sheet (skip header row)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A2:K1000` // Read up to 1000 rows
      });

      const rows = response.data.values || [];
      
      // Convert rows to receipt objects
      const receipts = rows
        .slice(0, limit)
        .map((row, index) => {
          return {
            date: row[0] || '',
            storeName: row[1] || '',
            payer: row[2] || '',
            amountExclTax: row[3] ? parseFloat(row[3]) : null,
            amountInclTax: row[4] ? parseFloat(row[4]) : null,
            tax: row[5] ? parseFloat(row[5]) : null,
            paymentMethod: row[6] || '',
            expenseCategory: row[7] || '',
            projectName: row[8] || '',
            notes: row[9] || '',
            receiptImageUrl: row[10] || ''
          };
        })
        .filter(receipt => receipt.date); // Filter out empty rows

      logger.info(`Retrieved ${receipts.length} receipts from sheet ${sheetName}`);

      return receipts;
    } catch (error) {
      if (error.message && error.message.includes('Unable to parse range')) {
        // Sheet doesn't exist or is empty
        logger.info(`Sheet ${sheetName} not found or empty`);
        return [];
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error retrieving history from Google Sheets:', error);
    throw new Error(`Failed to retrieve history: ${error.message}`);
  }
}

module.exports = {
  writeReceipt,
  getHistory
};


