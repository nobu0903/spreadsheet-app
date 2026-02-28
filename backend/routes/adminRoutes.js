/**
 * adminRoutes.js
 * Admin API routes (require admin role)
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/receipts', adminController.listReceipts);

module.exports = router;
