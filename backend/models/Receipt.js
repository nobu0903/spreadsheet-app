/**
 * Receipt.js
 * MongoDB model for saved receipt records
 */

const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  storeName: {
    type: String,
    required: true
  },
  amountInclTax: {
    type: Number,
    required: true
  },
  sheetName: {
    type: String
  },
  rowNumber: {
    type: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Receipt', receiptSchema);
