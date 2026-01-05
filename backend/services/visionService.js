/**
 * visionService.js
 * Google Vision API integration for OCR text extraction
 * Connects to: controllers/ocrController.js
 */

const vision = require('@google-cloud/vision');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Initialize Vision API client
let visionClient = null;

function getVisionClient() {
  if (!visionClient) {
    // Support for Render: Use GOOGLE_CREDENTIALS (JSON string) or GOOGLE_CREDENTIALS_PATH (file path)
    let clientOptions = {};
    
    if (process.env.GOOGLE_CREDENTIALS) {
      // Render deployment: credentials as JSON string in environment variable
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        clientOptions = { credentials };
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
      clientOptions = { keyFilename: credentialsPath };
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
      clientOptions = { keyFilename: credentialsPath };
      logger.info(`Using credentials from default file: ${credentialsPath}`);
    }
    
    visionClient = new vision.ImageAnnotatorClient(clientOptions);
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


