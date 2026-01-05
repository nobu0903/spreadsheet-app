/**
 * Vertex AI 利用可能モデル確認スクリプト
 * 実行方法: node backend/services/test-vertex-models.js
 */

require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID || process.env.VERTEX_AI_PROJECT_ID;
// 複数のリージョンを試す
const LOCATIONS = ['us-central1', 'asia-northeast1', 'us-east1', 'europe-west1'];
const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || path.join(__dirname, '../config/credentials.json');

async function listAvailableModels() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const authClient = await auth.getClient();
    
    // 各リージョンで試す
    for (const LOCATION of LOCATIONS) {
      console.log(`\n=== Testing region: ${LOCATION} ===`);
      
      // Vertex AI Model Gardenのエンドポイントで利用可能なモデルをリスト
      const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models`;
      
      console.log(`Checking available models at: ${endpoint}`);
    
    try {
      const response = await authClient.request({
        url: endpoint,
        method: 'GET'
      });
      
      console.log('Available models:', JSON.stringify(response.data, null, 2));
    } catch (listError) {
      console.error('Error listing models:', listError.response?.data || listError.message);
      
      // リスト取得ができない場合、直接generateContentを試してみる
      console.log('\nTrying direct model access tests...');
      
      const testModels = [
        'gemini-1.5-flash',
        'gemini-1.5-flash-001',
        'gemini-1.5-flash-002',
        'gemini-1.5-flash-003',
        'gemini-1.5-pro',
        'gemini-1.5-pro-001',
        'gemini-1.5-pro-002',
        'gemini-pro',
        'gemini-pro-001',
        'gemini-1.0-pro',
        'gemini-1.0-pro-001'
      ];
      
      for (const testModel of testModels) {
        const testEndpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${testModel}:generateContent`;
        
        try {
          const testResponse = await authClient.request({
            url: testEndpoint,
            method: 'POST',
            data: {
              contents: [{
                role: 'user',
                parts: [{ text: 'test' }]
              }]
            },
            validateStatus: (status) => status < 500 // 404でもエラーにしない
          });
          
          if (testResponse.status === 200) {
            console.log(`✅ ${testModel} - WORKS!`);
          } else if (testResponse.status === 404) {
            console.log(`❌ ${testModel} - Not found (404)`);
          } else {
            console.log(`⚠️  ${testModel} - Status: ${testResponse.status}`);
          }
        } catch (testError) {
          if (testError.response?.status === 404) {
            console.log(`❌ ${testModel} - Not found (404)`);
          } else {
            console.log(`⚠️  ${testModel} - Error: ${testError.response?.status || testError.message}`);
          }
        }
      }
    }
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

listAvailableModels();

