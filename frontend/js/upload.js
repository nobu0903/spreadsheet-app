/**
 * upload.js
 * Handles receipt image upload functionality
 * Connects to: backend/routes/ocrRoutes.js
 */

const API_BASE_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
  const uploadForm = document.getElementById('uploadForm');
  const fileInput = document.getElementById('receiptFile');
  const preview = document.getElementById('imagePreview');
  const uploadBtn = document.getElementById('uploadBtn');
  const previewContainer = document.getElementById('previewContainer');

  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', handleUpload);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && preview) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
      
      // Clear any previous error messages
      clearError();
    }
  }

  function showError(message) {
    clearError();
    const errorDiv = document.createElement('div');
    errorDiv.id = 'errorMessage';
    errorDiv.style.cssText = 'background-color: #fee; color: #c33; padding: 10px; border-radius: 4px; margin: 10px 0;';
    errorDiv.textContent = message;
    
    if (previewContainer) {
      previewContainer.appendChild(errorDiv);
    } else if (uploadForm) {
      uploadForm.insertBefore(errorDiv, uploadForm.firstChild);
    }
  }

  function clearError() {
    const errorMsg = document.getElementById('errorMessage');
    if (errorMsg) {
      errorMsg.remove();
    }
  }

  function setLoading(isLoading) {
    if (uploadBtn) {
      uploadBtn.disabled = isLoading;
      uploadBtn.textContent = isLoading ? '処理中...' : 'アップロードしてOCR実行';
    }
    if (fileInput) {
      fileInput.disabled = isLoading;
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    clearError();

    const file = fileInput?.files[0];
    if (!file) {
      showError('画像ファイルを選択してください');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('画像ファイル（JPEG/PNG）を選択してください');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Upload image and perform OCR
      const ocrResult = await performOCR(file);
      
      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        throw new Error('OCRでテキストを抽出できませんでした。画像が鮮明か確認してください。');
      }

      // Step 2: Structure OCR text using AI
      const structuredData = await structureOCRText(ocrResult.text);

      // Step 3: Save to localStorage and navigate to preview page
      localStorage.setItem('receiptData', JSON.stringify(structuredData));
      window.location.href = 'preview.html';

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.message || '処理中にエラーが発生しました';
      showError(errorMessage);
      setLoading(false);
    }
  }

  /**
   * Perform OCR on uploaded image
   * @param {File} file - Image file
   * @returns {Promise<{text: string, confidence: number}>}
   */
  async function performOCR(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE_URL}/ocr/process`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OCR処理に失敗しました (${response.status})`);
    }

    return await response.json();
  }

  /**
   * Structure OCR text using AI
   * @param {string} ocrText - OCR extracted text
   * @returns {Promise<Object>} Structured receipt data
   */
  async function structureOCRText(ocrText) {
    const response = await fetch(`${API_BASE_URL}/ai/structure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ocrText })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `AI構造化に失敗しました (${response.status})`);
    }

    return await response.json();
  }
});


