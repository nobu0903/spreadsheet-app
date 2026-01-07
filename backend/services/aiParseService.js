/**
 * aiParseService.js
 * AI service for structuring OCR text into receipt fields
 * Uses Google Vertex AI (via REST API) or OpenAI GPT models
 * Connects to: controllers/aiController.js
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

let authClient = null;
let credentialsData = null; // Store parsed credentials to extract project_id

// Vertex AI StudioのGet codeでは "global" リージョンが使用されている
// globalリージョンの場合、エンドポイントURLの形式が異なる
const LOCATION = process.env.VERTEX_AI_LOCATION || 'global';
// Vertex AIのGeminiモデル名
// デフォルト: gemini-2.5-flash-exp (高速で高精度な構造化データ抽出に最適)
// その他のオプション: gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash-exp, gemini-3-pro-preview
// 注意: バージョン番号（-001など）は付けない。エイリアスが最新バージョンに自動解決される
const MODEL = process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash-exp';

/**
 * Get project ID from environment variables or credentials
 */
function getProjectId() {
  // First, try environment variables
  let projectId = process.env.GOOGLE_PROJECT_ID || process.env.VERTEX_AI_PROJECT_ID;
  
  // Validate that it's not a file path (common mistake)
  if (projectId && (projectId.includes('/') || projectId.includes('\\') || projectId.endsWith('.json'))) {
    logger.warn(`Invalid PROJECT_ID detected (looks like a file path): ${projectId}. Will try to extract from credentials.`);
    projectId = null;
  }
  
  // If not set, try to extract from credentials
  if (!projectId && credentialsData) {
    projectId = credentialsData.project_id;
    if (projectId) {
      logger.info(`Using project_id from credentials: ${projectId}`);
    }
  }
  
  if (!projectId) {
    throw new Error('GOOGLE_PROJECT_ID or VERTEX_AI_PROJECT_ID environment variable is required, or project_id must be present in credentials JSON.');
  }
  
  return projectId;
}

async function getAuthClient() {
  if (!authClient) {
    // Support for Render: Use GOOGLE_CREDENTIALS (JSON string) or GOOGLE_CREDENTIALS_PATH (file path)
    let authOptions = {
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    };
    
    if (process.env.GOOGLE_CREDENTIALS) {
      // Render deployment: credentials as JSON string in environment variable
      try {
        credentialsData = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        authOptions.credentials = credentialsData;
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
      
      // Try to read and parse credentials to extract project_id
      try {
        const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
        credentialsData = JSON.parse(credentialsContent);
      } catch (error) {
        logger.warn('Could not parse credentials file to extract project_id:', error);
      }
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
      
      // Try to read and parse credentials to extract project_id
      try {
        const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
        credentialsData = JSON.parse(credentialsContent);
      } catch (error) {
        logger.warn('Could not parse credentials file to extract project_id:', error);
      }
    }
    
    const auth = new google.auth.GoogleAuth(authOptions);
    authClient = await auth.getClient();
    logger.info('Vertex AI auth client initialized');
  }
  return authClient;
}

/**
 * Parse OCR text and structure into receipt fields
 * @param {string} ocrText - Raw OCR text from Vision API
 * @returns {Promise<Object>} Structured receipt data
 * 
 * Expected structure:
 * {
 *   date: string,
 *   storeName: string,
 *   payer: string,
 *   amountExclTax: number,
 *   amountInclTax: number,
 *   tax: number,
 *   paymentMethod: string,
 *   expenseCategory: string,
 *   projectName: string,
 *   notes: string
 * }
 */
async function parseReceiptText(ocrText) {
  try {
    if (!ocrText || ocrText.trim().length === 0) {
      throw new Error('OCR text is empty');
    }

    // Initialize auth client first (this will populate credentialsData if using GOOGLE_CREDENTIALS)
    const auth = await getAuthClient();
    
    // Get project ID (will throw error if not available)
    // This must be called after getAuthClient() so credentialsData is populated
    const PROJECT_ID = getProjectId();
    
    if (!PROJECT_ID) {
      throw new Error('GOOGLE_PROJECT_ID or VERTEX_AI_PROJECT_ID environment variable is required, or project_id must be present in credentials JSON.');
    }
    
    logger.info('Starting AI parsing of OCR text');

    // Optimized prompt for faster processing
    const prompt = `レシートのOCRテキストを、次のJSON形式に「厳密に」変換してください。
出力は必ず有効なJSONだけとし、日本語の説明文やコメント、コードブロック（\`\`\`）は一切含めないでください。
文字列は必ずダブルクォーテーションで囲み、改行は必要な場合のみ "\\n" としてエスケープしてください。
数値フィールドには数値型のみを使用し、文字列は入れないでください。

OCRテキスト:
${ocrText}

出力フォーマット（サンプルの構造のみ。実際の値に置き換えてください）:
{
  "date": "YYYY-MM-DD",
  "storeName": "店舗名",
  "payer": "支払者",
  "amountExclTax": 1234.56,
  "amountInclTax": 1234.56,
  "tax": 123.45,
  "paymentMethod": "cash",  
}`;

    // Call Vertex AI REST API for Gemini models
    // 公式ドキュメント: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
    // エンドポイント形式:
    // - リージョン指定の場合: POST https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL}:generateContent
    // - globalリージョンの場合: POST https://aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{MODEL}:generateContent
    // 注意: {MODEL}はエイリアス名のみ（例: gemini-3-pro-preview）。-001などのバージョン番号は付けない
    const modelName = MODEL;
    
    // globalリージョンの場合、エンドポイントURLの形式が異なる
    let endpoint;
    if (LOCATION === 'global') {
      endpoint = `https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelName}:generateContent`;
    } else {
      endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelName}:generateContent`;
    }
    
    logger.info(`Vertex AI API call:`);
    logger.info(`  Model: ${modelName} (alias)`);
    logger.info(`  Project: ${PROJECT_ID}`);
    logger.info(`  Location: ${LOCATION}`);
    logger.info(`  Endpoint: ${endpoint}`);
    
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.0,  // Lower temperature for faster, more deterministic responses
        topP: 0.8,          // Slightly lower for faster sampling
        topK: 20,           // Limit candidate tokens for faster processing
        // Gemini 2.5 Flash uses additional tokens for "thoughts".
        // 1024 was too low (finishReason: MAX_TOKENS, JSON cut in the middle).
        // 4096 gives enough room for thoughts + JSON while keeping latency reasonable.
        maxOutputTokens: 4096
      }
    };

    let response;
    try {
      response = await auth.request({
        url: endpoint,
        method: 'POST',
        data: requestBody
      });
    } catch (apiError) {
      // More detailed error handling for Vertex AI API errors
      logger.error('Vertex AI API request failed:', {
        endpoint: apiError.config?.url || endpoint,
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        data: apiError.response?.data
      });
      
      if (apiError.response?.status === 404) {
        const errorDetail = apiError.response?.data?.error?.message || '';
        throw new Error(`モデル '${modelName}' が見つかりません（404エラー）。\n\n現在使用しているエンドポイント:\n${apiError.config?.url || endpoint}\n\n考えられる原因:\n1. モデル名が間違っている（エイリアス名を使用してください: gemini-3-pro-preview, gemini-1.5-flash, gemini-1.5-pro など）\n2. リージョン（${LOCATION}）が間違っている（Vertex AI Studioでは "global" が使用される場合があります）\n3. Vertex AI APIが正しく有効化されていない\n4. サービスアカウントに「Vertex AI User」（roles/aiplatform.user）ロールが付与されていない\n\nエラー詳細: ${errorDetail}`);
      } else if (apiError.response?.status === 403) {
        throw new Error(`Vertex AIへのアクセス権限がありません。サービスアカウントに「Vertex AI User」（roles/aiplatform.user）ロールが付与されているか確認してください。`);
      }
      throw apiError;
    }

    // Extract response text from Vertex AI response
    // デバッグ用: レスポンス構造をログに出力
    logger.info('Vertex AI response structure:', JSON.stringify(response.data, null, 2));
    
    if (!response.data.candidates || response.data.candidates.length === 0) {
      logger.error('Vertex AI response has no candidates:', response.data);
      throw new Error('AIからの応答がありませんでした');
    }
    
    // レスポンス構造のチェックを強化
    const candidate = response.data.candidates[0];
    if (!candidate) {
      logger.error('Vertex AI response has no candidate:', response.data);
      throw new Error('AIからの応答に候補がありませんでした');
    }
    
    if (!candidate.content) {
      logger.error('Vertex AI response candidate has no content:', candidate);
      throw new Error('AIからの応答にcontentがありませんでした');
    }
    
    // finishReasonをチェック
    if (candidate.finishReason === 'MAX_TOKENS') {
      logger.warn('Vertex AI response hit max tokens limit. Consider increasing maxOutputTokens.');
      // MAX_TOKENSの場合でもpartsが存在する可能性があるので、チェックを続ける
    }
    
    if (!candidate.content.parts || candidate.content.parts.length === 0) {
      logger.error('Vertex AI response content has no parts:', candidate.content);
      logger.error('Finish reason:', candidate.finishReason);
      if (candidate.finishReason === 'MAX_TOKENS') {
        throw new Error(`AIの応答が最大トークン数に達しました。maxOutputTokensを増やすか、プロンプトを短くしてください。\n使用トークン数: ${response.data.usageMetadata?.totalTokenCount || 'unknown'}`);
      }
      throw new Error('AIからの応答にpartsがありませんでした');
    }
    
    const part = candidate.content.parts[0];
    if (!part) {
      logger.error('Vertex AI response parts is empty:', candidate.content.parts);
      throw new Error('AIからの応答のpartsが空です');
    }
    
    // text フィールドのチェック
    if (!part.text && !part.functionCall) {
      logger.error('Vertex AI response part has no text or functionCall:', part);
      throw new Error('AIからの応答にtextまたはfunctionCallがありませんでした');
    }
    
    const responseText = part.text || '';
    logger.info('Raw AI response text (first 500 chars):');
    logger.info(responseText.slice(0, 500));

    // Extract JSON from response (handle cases where response might have markdown code blocks)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Try to isolate the JSON object by taking the substring between the first '{' and the last '}'
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1).trim();
    }

    logger.info('AI JSON candidate text (first 500 chars):');
    logger.info(jsonText.slice(0, 500));

    // Parse JSON
    let structuredData;
    try {
      structuredData = JSON.parse(jsonText);
    } catch (parseError) {
      logger.error('Failed to parse AI response as JSON:', jsonText);
      throw new Error(`AI response is not valid JSON: ${parseError.message}`);
    }

    // Validate required fields
    const requiredFields = ['date', 'storeName', 'payer', 'amountInclTax'];
    const missingFields = requiredFields.filter(field => !structuredData[field]);
    
    if (missingFields.length > 0) {
      logger.warn(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Normalize data types
    if (structuredData.amountExclTax !== null && structuredData.amountExclTax !== undefined) {
      structuredData.amountExclTax = parseFloat(structuredData.amountExclTax) || null;
    }
    if (structuredData.amountInclTax !== null && structuredData.amountInclTax !== undefined) {
      structuredData.amountInclTax = parseFloat(structuredData.amountInclTax) || null;
    }
    if (structuredData.tax !== null && structuredData.tax !== undefined) {
      structuredData.tax = parseFloat(structuredData.tax) || null;
    }

    // Ensure paymentMethod is one of the allowed values
    if (structuredData.paymentMethod && !['cash', 'card', 'other'].includes(structuredData.paymentMethod)) {
      structuredData.paymentMethod = 'other';
    }

    logger.info('AI parsing completed successfully');
    
    return structuredData;
  } catch (error) {
    logger.error('Error in AI parsing:', error);
    throw new Error(`AI parsing failed: ${error.message}`);
  }
}

module.exports = {
  parseReceiptText
};


