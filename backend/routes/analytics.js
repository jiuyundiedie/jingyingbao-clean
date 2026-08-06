const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');

const router = express.Router();

// ========== 行为日志上报 ==========
router.post('/track', authRequired, (req, res) => {
  const { action, page, detail, durationMs } = req.body;
  if (!action) return res.status(400).json({ error: '缺少 action 参数' });

  const shop = db.prepare('SELECT id FROM shops WHERE owner_id = ?').get(req.user.id);
  db.prepare(
    'INSERT INTO user_behavior_logs (user_id, shop_id, action, page, detail, duration_ms) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, shop?.id || 0, action, page || '', JSON.stringify(detail || {}), durationMs || 0);

  res.json({ success: true });
});

// 批量上报（减少网络请求次数）
router.post('/track/batch', authRequired, (req, res) => {
  const events = req.body.events || [];
  const shop = db.prepare('SELECT id FROM shops WHERE owner_id = ?').get(req.user.id);
  const insert = db.prepare(
    'INSERT INTO user_behavior_logs (user_id, shop_id, action, page, detail, duration_ms) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(req.user.id, shop?.id || 0, item.action, item.page || '', JSON.stringify(item.detail || {}), item.durationMs || 0);
    }
  });
  insertMany(events);
  res.json({ success: true, count: events.length });
});

// ========== 统计数据查询（管理端）==========
router.get('/stats/overview', adminAuth, (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startDate || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const end = endDate || new Date().toISOString();

  // 日活跃用户数
  const dau = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as users
    FROM user_behavior_logs
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `).all(start, end);

  // 功能使用排行
  const actionStats = db.prepare(`
    SELECT action, COUNT(*) as count, COUNT(DISTINCT user_id) as users
    FROM user_behavior_logs
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY action
    ORDER BY count DESC
    LIMIT 30
  `).all(start, end);

  // 页面访问排行
  const pageStats = db.prepare(`
    SELECT page, COUNT(*) as views, COUNT(DISTINCT user_id) as users
    FROM user_behavior_logs
    WHERE page != '' AND created_at >= ? AND created_at <= ?
    GROUP BY page
    ORDER BY views DESC
    LIMIT 20
  `).all(start, end);

  // 新增用户数
  const newUsers = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM users
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all(start, end);

  res.json({
    data: {
      dau,
      actionStats,
      pageStats,
      newUsers,
    }
  });
});

// 崩溃日志
router.post('/crash', authRequired, (req, res) => {
  const { error, stack, version, device } = req.body;
  db.prepare(
    'INSERT INTO user_feedbacks (user_id, shop_id, type, title, content, device_info, app_version, status) VALUES (?, ?, "crash", ?, ?, ?, ?, "pending")'
  ).run(req.user.id, 0, error?.substring(0, 200) || 'Unknown Error', stack || '{}', JSON.stringify(device || {}), version || '');
  res.json({ success: true });
});

module.exports = router;
