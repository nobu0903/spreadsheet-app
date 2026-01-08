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
    const files = Array.from(e.target.files || []);
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'single';
    
    if (files.length === 0) {
      if (preview) {
        preview.style.display = 'none';
      }
      return;
    }
    
    // 単一モードの場合は最初の1枚のみプレビュー
    if (mode === 'single' && files[0] && preview) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(files[0]);
    } else if (mode === 'batch' && preview) {
      // バッチモードの場合はプレビューを非表示
      preview.style.display = 'none';
    }
    
    // Clear any previous error messages
    clearError();
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

    const files = Array.from(fileInput?.files || []);
    if (files.length === 0) {
      showError('画像ファイルを選択してください');
      return;
    }

    // Validate file types
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      showError('画像ファイル（JPEG/PNG）のみ選択してください');
      return;
    }

    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'single';

    // 単一モードの場合
    if (mode === 'single') {
      await handleSingleUpload(files[0]);
    } else {
      // バッチモードの場合
      await handleBatchUpload(files);
    }
  }

  async function handleSingleUpload(file) {
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

  async function handleBatchUpload(files) {
    setLoading(true);
    
    // 進行状況表示を表示
    const batchProgress = document.getElementById('batchProgress');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    const processingList = document.getElementById('processingList');
    
    if (batchProgress) {
      batchProgress.style.display = 'block';
    }

    const results = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const currentIndex = i + 1;
        const total = files.length;
        
        // 進行状況を更新
        if (progressText) {
          progressText.textContent = `${currentIndex}/${total}`;
        }
        if (progressBar) {
          progressBar.style.width = `${(currentIndex / total) * 100}%`;
        }
        if (processingList) {
          processingList.innerHTML = `<div>処理中: ${file.name}</div>`;
        }

        try {
          // Step 1: OCR処理
          const ocrResult = await performOCR(file);
          
          if (!ocrResult.text || ocrResult.text.trim().length === 0) {
            throw new Error('OCRでテキストを抽出できませんでした');
          }

          // Step 2: AI構造化
          const structuredData = await structureOCRText(ocrResult.text);

          results.push({
            fileName: file.name,
            success: true,
            data: structuredData
          });

          if (processingList) {
            processingList.innerHTML = `<div style="color: green;">✓ ${file.name} - 完了</div>`;
          }
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          results.push({
            fileName: file.name,
            success: false,
            error: error.message || '処理に失敗しました'
          });

          if (processingList) {
            processingList.innerHTML += `<div style="color: red;">✗ ${file.name} - エラー: ${error.message || '処理失敗'}</div>`;
          }
        }
      }

      // 全処理完了
      if (progressBar) {
        progressBar.style.width = '100%';
      }

      // 成功したレシートのみを確認画面に渡す
      const successfulResults = results.filter(r => r.success);
      
      if (successfulResults.length === 0) {
        showError('すべてのレシートの処理に失敗しました');
        setLoading(false);
        if (batchProgress) {
          batchProgress.style.display = 'none';
        }
        return;
      }

      // 一覧確認画面に遷移
      localStorage.setItem('batchReceiptData', JSON.stringify(successfulResults));
      window.location.href = 'batch-review.html';

    } catch (error) {
      console.error('Batch upload error:', error);
      showError(error.message || '一括処理中にエラーが発生しました');
      setLoading(false);
      if (batchProgress) {
        batchProgress.style.display = 'none';
      }
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


