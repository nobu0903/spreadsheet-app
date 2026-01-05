/**
 * aiController.js
 * Handles AI structuring of OCR text into structured data
 * Connects to: services/aiParseService.js, routes/aiRoutes.js
 */

const aiParseService = require('../services/aiParseService');
const errorHandler = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Structure OCR text into receipt fields using AI
 * POST /api/ai/structure
 */
async function structureReceiptData(req, res) {
  try {
    logger.info('AI structuring request received');

    // Validate request body
    if (!req.body || !req.body.ocrText) {
      return res.status(400).json({
        error: {
          message: 'OCR text is required in request body',
          statusCode: 400
        }
      });
    }

    const { ocrText } = req.body;

    if (typeof ocrText !== 'string' || ocrText.trim().length === 0) {
      return res.status(400).json({
        error: {
          message: 'OCR text must be a non-empty string',
          statusCode: 400
        }
      });
    }

    // Call AI parsing service
    const structuredData = await aiParseService.parseReceiptText(ocrText);

    logger.info('AI structuring completed successfully');

    res.status(200).json(structuredData);
  } catch (error) {
    logger.error('Error in AI structuring:', error);
    errorHandler.handleError(error, req, res);
  }
}

module.exports = {
  structureReceiptData
};


