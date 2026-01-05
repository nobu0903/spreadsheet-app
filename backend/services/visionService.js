/**
 * visionService.js
 * Google Vision API integration for OCR text extraction
 * Connects to: controllers/ocrController.js
 */

const vision = require('@google-cloud/vision');
const path = require('path');
const logger = require('../utils/logger');

// Initialize Vision API client
let visionClient = null;

function getVisionClient() {
  if (!visionClient) {
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || path.join(__dirname, '../config/credentials.json');
    visionClient = new vision.ImageAnnotatorClient({
      keyFilename: credentialsPath
    });
    logger.info('Vision API client initialized');
  }
  return visionClient;
}

/**
 * Extract text from receipt image using Google Vision API
 * @param {Buffer} imageData - Image buffer
 * @returns {Promise<{text: string, confidence: number}>} Extracted OCR text and confidence
 */
async function extractText(imageData) {
  try {
    const client = getVisionClient();
    
    logger.info('Starting OCR text extraction');
    
    // Perform text detection
    const [result] = await client.textDetection({
      image: { content: imageData }
    });
    
    const detections = result.textAnnotations;
    
    if (!detections || detections.length === 0) {
      logger.warn('No text detected in image');
      return {
        text: '',
        confidence: 0
      };
    }
    
    // First detection contains all text
    const fullText = detections[0].description || '';
    
    // Calculate average confidence from all detections
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    detections.forEach((detection, index) => {
      if (index > 0 && detection.boundingPoly) {
        // Individual word detections have confidence scores
        if (detection.confidence !== undefined) {
          totalConfidence += detection.confidence;
          confidenceCount++;
        }
      }
    });
    
    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.9;
    
    logger.info(`OCR extraction completed. Text length: ${fullText.length}, Confidence: ${avgConfidence.toFixed(2)}`);
    
    return {
      text: fullText,
      confidence: avgConfidence
    };
  } catch (error) {
    logger.error('Error in Vision API text extraction:', error);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}

module.exports = {
  extractText
};


