/**
 * authController.js
 * Handles user registration and login
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/register - Register new user
 */
async function register(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: { message: 'ユーザー名とパスワードは必須です。' }
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

    const user = await User.create({
      username: username.trim(),
      password,
      role: 'user'
    });

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({
      error: { message: '登録に失敗しました。' }
    });
  }
}

/**
 * POST /api/auth/login - Login user
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: { message: 'ユーザー名とパスワードを入力してください。' }
      });
    }

    const user = await User.findOne({ username: username.trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        error: { message: 'ユーザー名またはパスワードが正しくありません。' }
      });
    }
    if (user.disabled) {
      return res.status(403).json({
        error: { message: 'このアカウントは無効化されています。' }
      });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({
        error: { message: 'ユーザー名またはパスワードが正しくありません。' }
      });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({
      error: { message: 'ログインに失敗しました。' }
    });
  }
}

module.exports = { register, login };
