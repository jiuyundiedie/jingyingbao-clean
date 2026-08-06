const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function getShop(req) {
  return db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
}

// ========== 优惠券管理 ==========
router.get('/', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.json({ data: [] });
  
  const coupons = db.prepare('SELECT * FROM coupons WHERE shop_id = ? ORDER BY created_at DESC').all(shop.id);
  res.json({ data: coupons });
});

// 创建优惠券
router.post('/', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.status(400).json({ error: '店铺不存在' });
  
  const data = req.body;
  const result = db.prepare(`
    INSERT INTO coupons (shop_id, user_id, name, type, value, min_amount, max_discount, total_count, remain_count, per_limit, scope, scope_ids, start_date, end_date, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    shop.id, req.user.id,
    data.name, data.type || 'discount',
    data.value || 0, data.min_amount || 0, data.max_discount || 0,
    data.total_count || 0, data.total_count || 0,
    data.per_limit || 1, data.scope || 'all',
    JSON.stringify(data.scope_ids || []),
    data.start_date || '', data.end_date || '',
    data.description || ''
  );
  res.json({ success: true, id: result.lastInsertRowid });
});

// 更新优惠券
router.put('/:id', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.status(400).json({ error: '店铺不存在' });
  
  const coupon = db.prepare('SELECT * FROM coupons WHERE id = ? AND shop_id = ?').get(req.params.id, shop.id);
  if (!coupon) return res.status(404).json({ error: '优惠券不存在' });
  
  const data = req.body;
  const sets = [];
  const vals = [];
  const allowed = ['name', 'type', 'value', 'min_amount', 'max_discount', 'start_date', 'end_date', 'description', 'status'];
  allowed.forEach(key => {
    if (data[key] !== undefined) { sets.push(`${key} = ?`); vals.push(data[key]); }
  });
  if (sets.length === 0) return res.json({ success: true });
  vals.push(req.params.id);
  db.prepare(`UPDATE coupons SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ success: true });
});

// 删除优惠券
router.delete('/:id', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.status(400).json({ error: '店铺不存在' });
  
  db.prepare('DELETE FROM coupons WHERE id = ? AND shop_id = ?').run(req.params.id, shop.id);
  res.json({ success: true });
});

// ========== 用户领券 ==========
router.post('/claim/:id', authRequired, (req, res) => {
  const couponId = req.params.id;
  const { customerId, userId } = req.body; // 领券的客户ID
  
  const coupon = db.prepare('SELECT * FROM coupons WHERE id = ? AND status = "active"').get(couponId);
  if (!coupon) return res.status(404).json({ error: '优惠券不存在或已停用' });

  // 检查剩余数量
  if (coupon.total_count > 0 && coupon.remain_count <= 0) {
    return res.status(400).json({ error: '优惠券已领完' });
  }

  // 检查有效期
  const now = new Date();
  if (coupon.start_date && coupon.start_date > now.toISOString()) {
    return res.status(400).json({ error: '优惠券尚未开始' });
  }
  if (coupon.end_date && coupon.end_date < now.toISOString()) {
    return res.status(400).json({ error: '优惠券已过期' });
  }

  // 检查每人限领
  if (customerId) {
    const claimed = db.prepare(
      'SELECT COUNT(*) as cnt FROM user_coupons WHERE coupon_id = ? AND customer_id = ? AND status IN ("unused", "used")'
    ).get(couponId, customerId);
    if (claimed.cnt >= coupon.per_limit) {
      return res.status(400).json({ error: `每人限领${coupon.per_limit}张` });
    }
  }

  // 生成券码
  const code = `CP${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
  
  // 计算过期时间
  const expiresAt = coupon.end_date || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const result = db.prepare(`
    INSERT INTO user_coupons (coupon_id, shop_id, user_id, customer_id, code, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(couponId, coupon.shop_id, userId || req.user.id, customerId || 0, code, expiresAt);

  // 扣减库存
  if (coupon.total_count > 0) {
    db.prepare('UPDATE coupons SET remain_count = remain_count - 1 WHERE id = ?').run(couponId);
  }

  res.json({
    success: true,
    id: result.lastInsertRowid,
    code,
    expires_at: expiresAt,
  });
});

// ========== 商家发放优惠券给指定客户 ==========
router.post('/send-to-customers/:id', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.status(400).json({ error: '店铺不存在' });
  
  const coupon = db.prepare('SELECT * FROM coupons WHERE id = ? AND shop_id = ?').get(req.params.id, shop.id);
  if (!coupon) return res.status(404).json({ error: '优惠券不存在' });

  const { customerIds, message } = req.body;
  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    return res.status(400).json({ error: '请选择要发放的客户' });
  }

  const results = [];
  for (const customerId of customerIds) {
    // 检查库存
    if (coupon.total_count > 0) {
      const remain = db.prepare('SELECT remain_count FROM coupons WHERE id = ?').get(req.params.id);
      if (remain.remain_count <= 0) break;
    }

    const code = `CP${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
    const expiresAt = coupon.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const result = db.prepare(`
      INSERT INTO user_coupons (coupon_id, shop_id, user_id, customer_id, code, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, shop.id, req.user.id, customerId, code, expiresAt);

    if (coupon.total_count > 0) {
      db.prepare('UPDATE coupons SET remain_count = remain_count - 1 WHERE id = ?').run(req.params.id);
    }

    results.push({ customerId, userCouponId: result.lastInsertRowid, code });
  }

  // 记录操作日志
  db.prepare(
    'INSERT INTO operation_logs (user_id, action, target, detail) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, 'send_coupons', coupon.name, JSON.stringify({ customerIds, count: results.length }));

  res.json({
    success: true,
    sent: results.length,
    results,
    message: message ? '优惠券已通过客服消息发送' : undefined,
  });
});

// ========== 我的优惠券列表（商家端查看已发出的券）==========
router.get('/my/user-coupons', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.json({ data: [] });

  const { status, customerId } = req.query;
  let sql = 'SELECT uc.*, c.name as coupon_name, c.type, c.value, c.min_amount FROM user_coupons uc JOIN coupons c ON uc.coupon_id = c.id WHERE uc.shop_id = ?';
  const params = [shop.id];
  
  if (status) { sql += ' AND uc.status = ?'; params.push(status); }
  if (customerId) { sql += ' AND uc.customer_id = ?'; params.push(customerId); }
  
  sql += ' ORDER BY uc.created_at DESC LIMIT 500';
  
  const coupons = db.prepare(sql).all(...params);
  res.json({ data: coupons });
});

// ========== 核销优惠券 ==========
router.post('/redeem/:id', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.status(400).json({ error: '店铺不存在' });

  const userCouponId = req.params.id;
  const userCoupon = db.prepare('SELECT * FROM user_coupons WHERE id = ? AND shop_id = ?').get(userCouponId, shop.id);
  if (!userCoupon) return res.status(404).json({ error: '券不存在' });

  if (userCoupon.status === 'used') {
    return res.status(400).json({ error: '券已使用' });
  }
  if (userCoupon.status === 'expired') {
    return res.status(400).json({ error: '券已过期' });
  }

  const now = new Date();
  if (new Date(userCoupon.expires_at) < now) {
    db.prepare('UPDATE user_coupons SET status = "expired" WHERE id = ?').run(userCouponId);
    return res.status(400).json({ error: '券已过期' });
  }

  const { orderId, discountAmount } = req.body;
  db.prepare(
    'UPDATE user_coupons SET status = "used", used_at = CURRENT_TIMESTAMP, order_id = ?, discount_amount = ? WHERE id = ?'
  ).run(orderId || 0, discountAmount || 0, userCouponId);

  res.json({ success: true });
});

// ========== 优惠券统计 ==========
router.get('/stats', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.json({ data: {} });

  const totalCoupons = db.prepare('SELECT COUNT(*) as cnt FROM coupons WHERE shop_id = ?').get(shop.id).cnt;
  const activeCoupons = db.prepare('SELECT COUNT(*) as cnt FROM coupons WHERE shop_id = ? AND status = "active"').get(shop.id).cnt;
  const totalClaimed = db.prepare('SELECT COUNT(*) as cnt FROM user_coupons WHERE shop_id = ?').get(shop.id).cnt;
  const totalUsed = db.prepare('SELECT COUNT(*) as cnt FROM user_coupons WHERE shop_id = ? AND status = "used"').get(shop.id).cnt;
  const totalDiscount = db.prepare('SELECT COALESCE(SUM(discount_amount), 0) as total FROM user_coupons WHERE shop_id = ? AND status = "used"').get(shop.id).total;

  res.json({
    data: {
      totalCoupons,
      activeCoupons,
      totalClaimed,
      totalUsed,
      totalDiscount,
    }
  });
});

module.exports = router;
