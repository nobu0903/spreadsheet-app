/**
 * preview.js
 * Handles data preview and editing before submission to Google Sheets
 * Connects to: backend/routes/aiRoutes.js, backend/routes/sheetRoutes.js
 */

const API_BASE_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
  // Load and populate form data from localStorage
  loadReceiptData();

  const editForm = document.getElementById('editForm');
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  if (editForm) {
    editForm.addEventListener('submit', handleSubmit);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancel);
  }

  /**
   * Load receipt data from localStorage and populate form
   */
  function loadReceiptData() {
    const receiptDataStr = localStorage.getItem('receiptData');
    
    if (!receiptDataStr) {
      console.error('Receipt data not found in localStorage');
      alert('レシートデータが見つかりません。再度アップロードしてください。');
      window.location.href = 'upload.html';
      return;
    }

    try {
      const receiptData = JSON.parse(receiptDataStr);
      
      // Populate form fields
      if (receiptData.date) {
        // Convert date format if needed (YYYY-MM-DD format for input[type="date"])
        const dateInput = document.getElementById('date');
        if (dateInput) {
          // Handle "20XX-03-22" format or convert from other formats
          let dateValue = receiptData.date;
          // If date contains "XX", try to replace with current year or remove
          if (dateValue.includes('XX')) {
            const currentYear = new Date().getFullYear();
            dateValue = dateValue.replace('XX', currentYear.toString().slice(2));
          }
          // Ensure YYYY-MM-DD format
          if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateInput.value = dateValue;
          } else if (dateValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            // Convert MM/DD/YYYY to YYYY-MM-DD
            const parts = dateValue.split('/');
            dateInput.value = `${parts[2]}-${parts[0]}-${parts[1]}`;
          } else {
            console.warn('Date format not recognized:', dateValue);
          }
        }
      }

      if (receiptData.storeName) {
        const storeNameInput = document.getElementById('storeName');
        if (storeNameInput) storeNameInput.value = receiptData.storeName;
      }

      if (receiptData.payer) {
        const payerInput = document.getElementById('payer');
        if (payerInput) payerInput.value = receiptData.payer;
      }

      if (receiptData.amountExclTax !== null && receiptData.amountExclTax !== undefined) {
        const amountExclTaxInput = document.getElementById('amountExclTax');
        if (amountExclTaxInput) amountExclTaxInput.value = receiptData.amountExclTax;
      }

      if (receiptData.amountInclTax !== null && receiptData.amountInclTax !== undefined) {
        const amountInclTaxInput = document.getElementById('amountInclTax');
        if (amountInclTaxInput) amountInclTaxInput.value = receiptData.amountInclTax;
      }

      if (receiptData.tax !== null && receiptData.tax !== undefined) {
        const taxInput = document.getElementById('tax');
        if (taxInput) taxInput.value = receiptData.tax;
      }

      if (receiptData.paymentMethod) {
        const paymentMethodSelect = document.getElementById('paymentMethod');
        if (paymentMethodSelect) paymentMethodSelect.value = receiptData.paymentMethod;
      }

      if (receiptData.expenseCategory) {
        const expenseCategoryInput = document.getElementById('expenseCategory');
        if (expenseCategoryInput) expenseCategoryInput.value = receiptData.expenseCategory;
      }

      if (receiptData.projectName) {
        const projectNameInput = document.getElementById('projectName');
        if (projectNameInput) projectNameInput.value = receiptData.projectName;
      }

      if (receiptData.notes) {
        const notesTextarea = document.getElementById('notes');
        if (notesTextarea) notesTextarea.value = receiptData.notes;
      }

      if (receiptData.receiptImageUrl) {
        const receiptImageUrlInput = document.getElementById('receiptImageUrl');
        if (receiptImageUrlInput) receiptImageUrlInput.value = receiptData.receiptImageUrl;
      }

    } catch (error) {
      console.error('Error parsing receipt data:', error);
      alert('データの読み込み中にエラーが発生しました。再度アップロードしてください。');
      window.location.href = 'upload.html';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    // Disable submit button to prevent double submission
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '保存中...';
    }

    try {
      // Collect form data
      const spreadsheetId = document.getElementById('spreadsheetId')?.value?.trim();
      const formData = {
        date: document.getElementById('date')?.value,
        storeName: document.getElementById('storeName')?.value,
        payer: document.getElementById('payer')?.value,
        amountExclTax: document.getElementById('amountExclTax')?.value ? parseFloat(document.getElementById('amountExclTax').value) : null,
        amountInclTax: document.getElementById('amountInclTax')?.value ? parseFloat(document.getElementById('amountInclTax').value) : null,
        tax: document.getElementById('tax')?.value ? parseFloat(document.getElementById('tax').value) : null,
        paymentMethod: document.getElementById('paymentMethod')?.value,
        expenseCategory: document.getElementById('expenseCategory')?.value || null,
        projectName: document.getElementById('projectName')?.value || null,
        notes: document.getElementById('notes')?.value || null,
        receiptImageUrl: document.getElementById('receiptImageUrl')?.value || null
      };

      // Add spreadsheetId if provided (empty string will be ignored by backend)
      if (spreadsheetId) {
        formData.spreadsheetId = spreadsheetId;
      }

      // Submit to Google Sheets
      const response = await fetch(`${API_BASE_URL}/sheets/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `保存に失敗しました (${response.status})`);
      }

      const result = await response.json();
      
      // Clear localStorage
      localStorage.removeItem('receiptData');
      
      // Show success message and redirect
      alert('Google Sheetsに正常に保存されました！');
      window.location.href = 'history.html';
      
    } catch (error) {
      console.error('Submit error:', error);
      alert(error.message || '保存中にエラーが発生しました');
      
      // Re-enable submit button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Google Sheetsに保存';
      }
    }
  }

  function handleCancel() {
    // Clear localStorage and navigate back to upload screen
    if (confirm('編集中のデータは失われます。よろしいですか？')) {
      localStorage.removeItem('receiptData');
      window.location.href = 'upload.html';
    }
  }
});


