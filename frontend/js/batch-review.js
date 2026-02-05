/**
 * batch-review.js
 * Handles batch review and saving of multiple receipts
 */

const API_BASE_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
  const receiptsList = document.getElementById('receiptsList');
  const saveAllBtn = document.getElementById('saveAllBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  let receiptsData = [];

  // Load batch receipt data from localStorage
  function loadBatchData() {
    const batchDataStr = localStorage.getItem('batchReceiptData');
    
    if (!batchDataStr) {
      alert('一括処理データが見つかりません。再度アップロードしてください。');
      window.location.href = 'upload.html';
      return;
    }

    try {
      receiptsData = JSON.parse(batchDataStr);
      renderReceiptsList();
    } catch (error) {
      console.error('Error parsing batch data:', error);
      alert('データの読み込み中にエラーが発生しました');
      window.location.href = 'upload.html';
    }
  }

  // Render receipts list
  function renderReceiptsList() {
    if (!receiptsList) return;

    receiptsList.innerHTML = '';

    if (receiptsData.length === 0) {
      receiptsList.innerHTML = '<p>処理済みレシートがありません</p>';
      return;
    }

    receiptsData.forEach((receipt, index) => {
      const receiptCard = document.createElement('div');
      receiptCard.className = 'card';
      receiptCard.style.marginBottom = '15px';
      receiptCard.dataset.index = index;

      const receiptData = receipt.data;
      receiptCard.innerHTML = `
        <h3 style="margin-bottom: 15px;">レシート ${index + 1}: ${receipt.fileName}</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
          <div>
            <label>日付</label>
            <input type="date" class="receipt-date" value="${receiptData.date || ''}" data-index="${index}">
          </div>
          <div>
            <label>店舗名</label>
            <input type="text" class="receipt-storeName" value="${receiptData.storeName || ''}" data-index="${index}">
          </div>
          <div>
            <label>金額（税込）</label>
            <input type="number" class="receipt-amountInclTax" value="${receiptData.amountInclTax ?? ''}" step="0.01" data-index="${index}">
          </div>
        </div>
        <div style="margin-top: 10px;">
          <button type="button" class="btn btn-secondary remove-receipt" data-index="${index}" style="font-size: 12px; padding: 5px 10px;">
            このレシートを削除
          </button>
        </div>
      `;

      receiptsList.appendChild(receiptCard);
    });

    // Remove receipt button handlers
    document.querySelectorAll('.remove-receipt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (confirm(`レシート ${index + 1} をリストから削除しますか？`)) {
          receiptsData.splice(index, 1);
          renderReceiptsList();
        }
      });
    });
  }

  // Update receipt data when input changes（日付・店舗名・金額税込のみ）
  receiptsList?.addEventListener('input', (e) => {
    if (e.target.classList.contains('receipt-date') ||
        e.target.classList.contains('receipt-storeName') ||
        e.target.classList.contains('receipt-amountInclTax')) {
      const index = parseInt(e.target.dataset.index);
      const fieldName = e.target.className.replace('receipt-', '');
      if (fieldName === 'amountInclTax') {
        receiptsData[index].data[fieldName] = e.target.value ? parseFloat(e.target.value) : null;
      } else {
        receiptsData[index].data[fieldName] = e.target.value || null;
      }
    }
  });

  // Save all receipts
  if (saveAllBtn) {
    saveAllBtn.addEventListener('click', handleSaveAll);
  }

  async function handleSaveAll() {
    if (receiptsData.length === 0) {
      alert('保存するレシートがありません');
      return;
    }

    const spreadsheetId = document.getElementById('spreadsheetId')?.value?.trim() || null;

    if (saveAllBtn) {
      saveAllBtn.disabled = true;
      saveAllBtn.textContent = '保存中...';
    }

    try {
      const response = await fetch(`${API_BASE_URL}/sheets/batch-write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          receipts: receiptsData.map(r => ({
            date: r.data.date,
            storeName: r.data.storeName,
            amountInclTax: r.data.amountInclTax ?? null
          })),
          spreadsheetId: spreadsheetId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `保存に失敗しました (${response.status})`);
      }

      const result = await response.json();
      
      // Clear localStorage
      localStorage.removeItem('batchReceiptData');
      
      // Show success message and redirect
      alert(`${result.successCount}件のレシートをGoogle Sheetsに正常に保存しました！`);
      window.location.href = 'upload.html';
      
    } catch (error) {
      console.error('Save all error:', error);
      alert(error.message || '保存中にエラーが発生しました');
      
      if (saveAllBtn) {
        saveAllBtn.disabled = false;
        saveAllBtn.textContent = 'すべて保存';
      }
    }
  }

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (confirm('編集中のデータは失われます。よろしいですか？')) {
        localStorage.removeItem('batchReceiptData');
        window.location.href = 'upload.html';
      }
    });
  }

  // Load data on page load
  loadBatchData();
});

