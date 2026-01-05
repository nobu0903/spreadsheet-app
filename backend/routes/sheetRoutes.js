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

// GET /api/sheets/history - Get receipt history
router.get('/history', sheetController.getHistory);

module.exports = router;


