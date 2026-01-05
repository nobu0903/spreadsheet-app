/**
 * aiParseService.js
 * AI service for structuring OCR text into receipt fields
 * Uses Google Vertex AI (via REST API) or OpenAI GPT models
 * Connects to: controllers/aiController.js
 */

const { google } = require('googleapis');
const path = require('path');
const logger = require('../utils/logger');

let authClient = null;
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID || process.env.VERTEX_AI_PROJECT_ID;
// Vertex AI StudioのGet codeでは "global" リージョンが使用されている
// globalリージョンの場合、エンドポイントURLの形式が異なる
const LOCATION = process.env.VERTEX_AI_LOCATION || 'global';
// Vertex AIのGeminiモデル名
// Vertex AI StudioのGet codeでは "gemini-3-pro-preview" が使用されている
// エイリアス（推奨）: gemini-1.5-flash, gemini-1.5-pro, gemini-3-pro-preview
// 注意: バージョン番号（-001など）は付けない。エイリアスが最新バージョンに自動解決される
// Vertex AI Studioと同じモデル名を使用することで、同じ動作が期待できる
const MODEL = process.env.VERTEX_AI_MODEL || 'gemini-3-pro-preview';

async function getAuthClient() {
  if (!authClient) {
    // Support for Render: Use GOOGLE_CREDENTIALS (JSON string) or GOOGLE_CREDENTIALS_PATH (file path)
    let authOptions = {
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    };
    
    if (process.env.GOOGLE_CREDENTIALS) {
      // Render deployment: credentials as JSON string in environment variable
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        authOptions.credentials = credentials;
      } catch (error) {
        logger.error('Failed to parse GOOGLE_CREDENTIALS:', error);
        throw new Error('Invalid GOOGLE_CREDENTIALS format. Must be valid JSON string.');
      }
    } else {
      // Local development: credentials from file path
      const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || path.join(__dirname, '../config/credentials.json');
      authOptions.keyFile = credentialsPath;
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

    if (!PROJECT_ID) {
      throw new Error('GOOGLE_PROJECT_ID or VERTEX_AI_PROJECT_ID environment variable is required');
    }

    const auth = await getAuthClient();
    
    logger.info('Starting AI parsing of OCR text');

    const prompt = `以下のレシートのOCRテキストを解析して、構造化されたJSONデータに変換してください。

OCRテキスト:
${ocrText}

以下のJSON形式で返答してください。不明な項目は空文字列またはnullにしてください。数値は数値型で返してください。

{
  "date": "YYYY-MM-DD形式の日付",
  "storeName": "店舗名",
  "payer": "支払者（従業員名）",
  "amountExclTax": 税抜き金額（数値）,
  "amountInclTax": 税込み金額（数値）,
  "tax": 消費税額（数値）,
  "paymentMethod": "支払方法（cash, card, otherのいずれか）",
  "expenseCategory": "経費カテゴリ",
  "projectName": "プロジェクト/クライアント名",
  "notes": "備考"
}

JSONのみを返答し、説明文は含めないでください。`;

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
        temperature: 0.1,
        topP: 0.95,
        // gemini-3-pro-previewは思考過程（thoughts）を使用するため、より多くのトークンが必要
        // Vertex AI StudioのGet codeでは maxOutputTokens: 65535 が使用されている
        // ログで思考プロセスに2045トークン使用されているのを確認したため、十分な余裕を持たせる
        maxOutputTokens: 16384
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

    // Extract JSON from response (handle cases where response might have markdown code blocks)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

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


