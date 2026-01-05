/**
 * ocrController.js
 * Handles OCR-related HTTP requests
 * Connects to: services/visionService.js, routes/ocrRoutes.js
 */

const visionService = require('../services/visionService');
const errorHandler = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Process receipt image through OCR
 * POST /api/ocr/process
 */
async function processReceipt(req, res) {
  try {
    logger.info('OCR processing request received');

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'No image file provided',
          statusCode: 400
        }
      });
    }

    // Validate file type
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        error: {
          message: 'Invalid file type. Only image files are allowed',
          statusCode: 400
        }
      });
    }

    // Extract text using Vision API
    const imageBuffer = req.file.buffer;
    const result = await visionService.extractText(imageBuffer);

    logger.info(`OCR processing completed. Text length: ${result.text.length}, Confidence: ${result.confidence.toFixed(2)}`);

    res.status(200).json({
      text: result.text,
      confidence: result.confidence
    });
  } catch (error) {
    logger.error('Error in OCR processing:', error);
    errorHandler.handleError(error, req, res);
  }
}

module.exports = {
  processReceipt
};


