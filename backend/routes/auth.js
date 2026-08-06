const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, verify, authRequired } = require('../middleware/auth');
const { sendCode, verifyCode, generateCode } = require('../utils/sms');

const router = express.Router();

// ========== 发送验证码 ==========
router.post('/sms/send', (req, res) => {
  const { phone, purpose } = req.body;
  if (!phone || !/^\d{11}$/.test(phone)) {
    return res.status(400).json({ error: '请输入11位手机号' });
  }
  const code = generateCode();
  sendCode(phone, code, purpose);
  res.json({ success: true, message: '验证码已发送（开发模式: ' + code + '）' });
});

// ========== 手机验证码登录 ==========
router.post('/login', (req, res) => {
  const { phone, code, role, shopName, employeeName } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: '缺少手机号或验证码' });
  }
  if (!verifyCode(phone, code, 'login')) {
    return res.status(400).json({ error: '验证码错误或已过期' });
  }

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

  if (!user) {
    // 新用户注册
    const stmt = db.prepare(
      'INSERT INTO users (phone, role, name, shop_name, industry) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(phone, role || '商家', employeeName || '老板', shopName || '', '餐饮类');
    user = { id: result.lastInsertRowid, phone, role, name: employeeName || '老板', shop_name: shopName || '' };
    // 创建店铺
    db.prepare('INSERT INTO shops (owner_id, shop_name, industry, phone) VALUES (?, ?, ?, ?)')
      .run(user.id, shopName || (user.shop_name || '默认店铺'), '餐饮类', phone);
  }

  const token = sign({ id: user.id, phone: user.phone, role: user.role });
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      shopName: user.shop_name,
      industry: user.industry,
      avatar: user.avatar,
    }
  });
});

// ========== 微信登录（占位） ==========
router.post('/wechat', (req, res) => {
  const { code } = req.body;
  // 真实环境: 用code换取微信openid和用户信息
  // 开发环境: mock
  res.json({
    success: true,
    mock: true,
    message: '微信登录需要配置真实的WECHAT_APPID',
    openid: 'mock_openid_' + Date.now(),
    token: 'mock_token_' + Date.now(),
  });
});

// ========== 获取当前用户信息 ==========
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
  res.json({
    user: {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      shopName: user.shop_name,
      industry: user.industry,
      avatar: user.avatar,
    },
    shop: shop || null
  });
});

// ========== 更新用户信息 ==========
router.put('/me', authRequired, (req, res) => {
  const { name, shopName, industry, avatar } = req.body;
  db.prepare(
    'UPDATE users SET name = COALESCE(?, name), shop_name = COALESCE(?, shop_name), industry = COALESCE(?, industry), avatar = COALESCE(?, avatar), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(name, shopName, industry, avatar, req.user.id);
  res.json({ success: true });
});

module.exports = router;
