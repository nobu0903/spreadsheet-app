/**
 * adminController.js
 * Admin-only: user list, update role/disabled, delete user
 */

const User = require('../models/User');
const Receipt = require('../models/Receipt');
const logger = require('../utils/logger');

/**
 * POST /api/admin/users - Create user (admin only). Login info is stored in MongoDB.
 */
async function createUser(req, res) {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: { message: 'ユーザー名とパスワードは必須です。' }
      });
    }

    if (username.trim().length < 2) {
      return res.status(400).json({
        error: { message: 'ユーザー名は2文字以上で入力してください。' }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: { message: 'パスワードは6文字以上で入力してください。' }
      });
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(409).json({
        error: { message: 'このユーザー名は既に使用されています。' }
      });
    }

    const safeRole = role === 'admin' ? 'admin' : 'user';
    const user = await User.create({
      username: username.trim(),
      password,
      role: safeRole
    });

    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json({ user: userObj });
  } catch (err) {
    logger.error('Admin createUser error:', err);
    res.status(500).json({ error: { message: 'ユーザーの作成に失敗しました。' } });
  }
}

/**
 * GET /api/admin/users - List all users (admin only)
 */
async function listUsers(req, res) {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ users });
  } catch (err) {
    logger.error('Admin listUsers error:', err);
    res.status(500).json({ error: { message: 'ユーザー一覧の取得に失敗しました。' } });
  }
}

/**
 * PATCH /api/admin/users/:id - Update user role or disabled (admin only)
 */
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { role, disabled } = req.body;

    if (id === req.user.userId) {
      return res.status(400).json({
        error: { message: '自分自身のロールは変更できません。' }
      });
    }

    const update = {};
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: { message: 'ロールは user または admin を指定してください。' } });
      }
      update.role = role;
    }
    if (disabled !== undefined) {
      update.disabled = !!disabled;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: { message: 'ユーザーが見つかりません。' } });
    }

    res.json({ user });
  } catch (err) {
    logger.error('Admin updateUser error:', err);
    res.status(500).json({ error: { message: '更新に失敗しました。' } });
  }
}

/**
 * DELETE /api/admin/users/:id - Delete user (admin only)
 */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    if (id === req.user.userId) {
      return res.status(400).json({
        error: { message: '自分自身のアカウントは削除できません。' }
      });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: { message: 'ユーザーが見つかりません。' } });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Admin deleteUser error:', err);
    res.status(500).json({ error: { message: '削除に失敗しました。' } });
  }
}

/**
 * GET /api/admin/receipts - List all receipt records (admin only)
 */
async function listReceipts(req, res) {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const skip = (page - 1) * limit;

    const [receipts, total] = await Promise.all([
      Receipt.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Receipt.countDocuments({})
    ]);

    res.json({ receipts, total, page, limit });
  } catch (err) {
    logger.error('Admin listReceipts error:', err);
    res.status(500).json({ error: { message: '履歴の取得に失敗しました。' } });
  }
}

module.exports = { createUser, listUsers, updateUser, deleteUser, listReceipts };
