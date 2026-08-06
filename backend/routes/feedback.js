const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// ========== 用户反馈 ==========
router.post('/', authRequired, (req, res) => {
  const { type, title, content, rating, device, version } = req.body;
  const shop = db.prepare('SELECT id FROM shops WHERE owner_id = ?').get(req.user.id);
  
  if (!content || content.length < 5) {
    return res.status(400).json({ error: '反馈内容至少5个字' });
  }

  const result = db.prepare(
    `INSERT INTO user_feedbacks (user_id, shop_id, type, title, content, rating, device_info, app_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.user.id,
    shop?.id || 0,
    type || 'feedback',
    title || '',
    content,
    rating || 0,
    JSON.stringify(device || {}),
    version || ''
  );

  res.json({
    success: true,
    id: result.lastInsertRowid,
    message: '感谢您的反馈，我们会尽快处理！',
  });
});

// 我的反馈列表
router.get('/my', authRequired, (req, res) => {
  const feedbacks = db.prepare(`
    SELECT * FROM user_feedbacks
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json({ data: feedbacks });
});

// 获取单个反馈详情
router.get('/:id', authRequired, (req, res) => {
  const feedback = db.prepare(`
    SELECT f.*, u.name as user_name, u.phone as user_phone
    FROM user_feedbacks f
    JOIN users u ON f.user_id = u.id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!feedback) return res.status(404).json({ error: '反馈不存在' });
  res.json({ data: feedback });
});

// 管理端：反馈列表（可筛选状态/类型）
router.get('/admin/list', authRequired, (req, res) => {
  const { status, type, limit } = req.query;
  let sql = `SELECT f.*, u.name as user_name, u.phone as user_phone
             FROM user_feedbacks f
             JOIN users u ON f.user_id = u.id
             WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND f.status = ?'; params.push(status); }
  if (type) { sql += ' AND f.type = ?'; params.push(type); }
  sql += ' ORDER BY f.created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 100);
  
  const feedbacks = db.prepare(sql).all(...params);
  res.json({ data: feedbacks });
});

// 管理端：回复反馈
router.put('/admin/reply/:id', authRequired, (req, res) => {
  const { reply } = req.body;
  if (!reply) return res.status(400).json({ error: '请输入回复内容' });
  
  db.prepare(
    'UPDATE user_feedbacks SET reply = ?, status = "resolved", updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(reply, req.params.id);
  res.json({ success: true });
});

// 管理端：反馈统计
router.get('/admin/stats', authRequired, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM user_feedbacks').get().cnt;
  const pending = db.prepare('SELECT COUNT(*) as cnt FROM user_feedbacks WHERE status = "pending"').get().cnt;
  const byType = db.prepare(`
    SELECT type, COUNT(*) as cnt FROM user_feedbacks GROUP BY type
  `).all();
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as cnt FROM user_feedbacks GROUP BY status
  `).all();
  
  res.json({
    data: {
      total,
      pending,
      byType,
      byStatus,
    }
  });
});

module.exports = router;
