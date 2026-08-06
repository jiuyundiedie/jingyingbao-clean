const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function getShop(req) {
  return db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
}

// ========== 会员套餐 ==========
router.get('/plans', authRequired, (req, res) => {
  const plans = db.prepare('SELECT * FROM membership_plans WHERE status = "active" ORDER BY price ASC').all();
  res.json({ data: plans });
});

// 创建/更新套餐（管理员）
router.post('/plans', authRequired, (req, res) => {
  const data = req.body;
  if (data.id) {
    db.prepare(
      'UPDATE membership_plans SET name=?, duration_months=?, price=?, original_price=?, features=?, description=?, is_recommended=?, status=? WHERE id=?'
    ).run(data.name, data.duration_months, data.price, data.original_price || 0, JSON.stringify(data.features || []), data.description || '', data.is_recommended || 0, data.status || 'active', data.id);
  } else {
    const result = db.prepare(
      'INSERT INTO membership_plans (name, duration_months, price, original_price, features, description, is_recommended) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(data.name, data.duration_months, data.price, data.original_price || 0, JSON.stringify(data.features || []), data.description || '', data.is_recommended || 0);
    return res.json({ success: true, id: result.lastInsertRowid });
  }
  res.json({ success: true });
});

// ========== 用户会员 ==========
router.get('/current', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.json({ data: null });
  
  // 获取当前有效会员
  const membership = db.prepare(`
    SELECT m.*, p.name as plan_name, p.features, p.description
    FROM memberships m
    JOIN membership_plans p ON m.plan_id = p.id
    WHERE m.shop_id = ? AND m.status = 'active' AND m.expires_at > datetime('now')
    ORDER BY m.expires_at DESC LIMIT 1
  `).get(shop.id);

  // 获取过期但未续费的会员
  const expired = db.prepare(`
    SELECT m.*, p.name as plan_name
    FROM memberships m
    JOIN membership_plans p ON m.plan_id = p.id
    WHERE m.shop_id = ? AND m.status = 'active' AND m.expires_at <= datetime('now')
    ORDER BY m.expires_at DESC LIMIT 1
  `).get(shop.id);

  // 更新过期状态
  if (expired) {
    db.prepare('UPDATE memberships SET status = "expired" WHERE id = ?').run(expired.id);
    if (!membership) expired.status = 'expired';
  }

  res.json({
    data: membership || expired || null
  });
});

// 购买/续费会员
router.post('/purchase', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.status(400).json({ error: '店铺不存在' });

  const { planId } = req.body;
  const plan = db.prepare('SELECT * FROM membership_plans WHERE id = ?').get(planId);
  if (!plan) return res.status(400).json({ error: '套餐不存在' });

  // 计算有效期
  const now = new Date();
  const expiresAt = new Date(now.getTime() + plan.duration_months * 30 * 24 * 60 * 60 * 1000);

  // 检查是否有当前会员
  const current = db.prepare(`
    SELECT * FROM memberships WHERE shop_id = ? AND status = 'active' AND expires_at > datetime('now')
    ORDER BY expires_at DESC LIMIT 1
  `).get(shop.id);

  let startDate = now.toISOString();
  if (current) {
    startDate = new Date(current.expires_at).toISOString();
  }

  // 确定等级
  const level = plan.duration_months >= 12 ? 'pro' : plan.duration_months >= 3 ? 'standard' : 'basic';

  const result = db.prepare(
    `INSERT INTO memberships (user_id, shop_id, plan_id, level, status, started_at, expires_at, payment_method, payment_status)
     VALUES (?, ?, ?, ?, 'active', ?, ?, 'alipay', 'paid')`
  ).run(req.user.id, shop.id, planId, level, startDate, expiresAt.toISOString());

  res.json({
    success: true,
    id: result.lastInsertRowid,
    plan: plan.name,
    expires_at: expiresAt.toISOString(),
  });
});

// 获取会员历史
router.get('/history', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.json({ data: [] });
  
  const history = db.prepare(`
    SELECT m.*, p.name as plan_name
    FROM memberships m
    JOIN membership_plans p ON m.plan_id = p.id
    WHERE m.shop_id = ?
    ORDER BY m.created_at DESC
  `).all(shop.id);

  res.json({ data: history });
});

// 初始化默认套餐
const initDefaultPlans = () => {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM membership_plans').get().cnt;
  if (count === 0) {
    const plans = [
      {
        name: '月度版',
        duration_months: 1,
        price: 29.9,
        original_price: 39.9,
        features: ['基础会员功能', '客服支持', '数据统计'],
        description: '适合个体商户短期使用',
        is_recommended: 0,
      },
      {
        name: '季度版',
        duration_months: 3,
        price: 79.9,
        original_price: 119.7,
        features: ['全部基础功能', '高级数据分析', '优先客服支持', '营销工具'],
        description: '最受欢迎，三个月优惠',
        is_recommended: 1,
      },
      {
        name: '年度版',
        duration_months: 12,
        price: 259.9,
        original_price: 478.8,
        features: ['全部高级功能', 'AI 智能助手', '无限优惠券', '专属客户经理', '多设备同步'],
        description: '专业之选，全年无忧',
        is_recommended: 0,
      },
    ];
    const insert = db.prepare(
      'INSERT INTO membership_plans (name, duration_months, price, original_price, features, description, is_recommended) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    plans.forEach(p => {
      insert.run(p.name, p.duration_months, p.price, p.original_price, JSON.stringify(p.features), p.description, p.is_recommended);
    });
    console.log('[Membership] 默认套餐已初始化');
  }
};

initDefaultPlans();

module.exports = router;
