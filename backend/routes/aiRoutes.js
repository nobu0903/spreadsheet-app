/**
 * aiRoutes.js
 * AI structuring API routes
 * Connects to: controllers/aiController.js, app.js
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// POST /api/ai/structure - Structure OCR text into receipt fields
router.post('/structure', aiController.structureReceiptData);

module.exports = router;


