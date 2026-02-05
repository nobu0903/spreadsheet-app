/**
 * sheetRoutes.js
 * Google Sheets API routes
 * Connects to: controllers/sheetController.js, app.js
 */

const express = require('express');
const router = express.Router();
const sheetController = require('../controllers/sheetController');

// POST /api/sheets/write - Write receipt data to Google Sheets
router.post('/write', sheetController.writeToSheet);

// POST /api/sheets/batch-write - Batch write receipt data to Google Sheets
router.post('/batch-write', sheetController.batchWrite);

module.exports = router;


