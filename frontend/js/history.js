/**
 * history.js
 * Displays list of previously processed receipts
 * Connects to: backend/routes/sheetRoutes.js
 */

document.addEventListener('DOMContentLoaded', () => {
  const historyContainer = document.getElementById('historyContainer');

  async function loadHistory() {
    // TODO: Fetch history from backend
    console.log('History loading functionality to be implemented');
  }

  // Load history on page load
  loadHistory();
});


