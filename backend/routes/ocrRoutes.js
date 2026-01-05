/**
 * ocrRoutes.js
 * OCR-related API routes
 * Connects to: controllers/ocrController.js, app.js
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const ocrController = require('../controllers/ocrController');

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// POST /api/ocr/process - Process receipt image through OCR
router.post('/process', upload.single('image'), ocrController.processReceipt);

module.exports = router;


