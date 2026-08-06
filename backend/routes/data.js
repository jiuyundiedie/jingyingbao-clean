const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function getShop(req) {
  return db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
}

// ========== 订单 CRUD ==========
router.get('/orders', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.json({ data: [] });
  const orders = db.prepare('SELECT * FROM orders WHERE shop_id = ? ORDER BY created_at DESC').all(shop.id);
  res.json({ data: orders });
});

router.post('/orders', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.status(400).json({ error: '店铺不存在' });
  const data = req.body;
  const stmt = db.prepare(
    `INSERT INTO orders (shop_id, user_id, customer_name, customer_phone, platform, order_no, amount, coupon_price, status, items, remark, time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    shop.id, req.user.id,
    data.customer_name || '', data.customer_phone || '',
    data.platform || '美团', data.order_no || '',
    data.amount || 0, data.coupon_price || 0,
    data.status || 'pending',
    JSON.stringify(data.items || []),
    data.remark || '',
    data.time || new Date().toISOString()
  );
  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/orders/:id', authRequired, (req, res) => {
  const data = req.body;
  const sets = [];
  const vals = [];
  Object.keys(data).forEach(key => {
    if (key !== 'id') { sets.push(`${key} = ?`); vals.push(typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]); }
  });
  if (sets.length === 0) return res.json({ success: true });
  vals.push(req.params.id);
  db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ success: true });
});

router.delete('/orders/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== 库存 CRUD ==========
router.get('/inventory', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.json({ data: [] });
  const items = db.prepare('SELECT * FROM inventory WHERE shop_id = ? ORDER BY created_at DESC').all(shop.id);
  res.json({ data: items });
});

router.post('/inventory', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.status(400).json({ error: '店铺不存在' });
  const data = req.body;
  const stmt = db.prepare(
    `INSERT INTO inventory (shop_id, user_id, name, stock, platform, barcode, price, category, photo_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    shop.id, req.user.id,
    data.name, data.stock || 0,
    data.platform || '通用', data.barcode || '',
    data.price || 0, data.category || '',
    data.photo_uri || ''
  );
  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/inventory/:id', authRequired, (req, res) => {
  const data = req.body;
  const sets = [];
  const vals = [];
  Object.keys(data).forEach(key => {
    if (key !== 'id') { sets.push(`${key} = ?`); vals.push(data[key]); }
  });
  if (sets.length === 0) return res.json({ success: true });
  vals.push(req.params.id);
  db.prepare(`UPDATE inventory SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ success: true });
});

router.delete('/inventory/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== 客户 CRUD ==========
router.get('/customers', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.json({ data: [] });
  const customers = db.prepare('SELECT * FROM customers WHERE shop_id = ? ORDER BY total_amount DESC').all(shop.id);
  res.json({ data: customers });
});

router.post('/customers', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.status(400).json({ error: '店铺不存在' });
  const data = req.body;
  const stmt = db.prepare(
    `INSERT INTO customers (shop_id, user_id, name, phone, total_orders, total_amount, tags, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    shop.id, req.user.id,
    data.name || '', data.phone || '',
    data.total_orders || 0, data.total_amount || 0,
    JSON.stringify(data.tags || []),
    data.note || ''
  );
  res.json({ success: true, id: result.lastInsertRowid });
});

// ========== 数据同步 (全量) ==========
router.get('/sync', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.json({ data: {} });

  const orders = db.prepare('SELECT * FROM orders WHERE shop_id = ?').all(shop.id);
  const inventory = db.prepare('SELECT * FROM inventory WHERE shop_id = ?').all(shop.id);
  const customers = db.prepare('SELECT * FROM customers WHERE shop_id = ?').all(shop.id);
  const messages = db.prepare('SELECT * FROM messages WHERE shop_id = ? ORDER BY created_at DESC LIMIT 500').all(shop.id);

  res.json({
    data: {
      orders,
      inventory,
      customers,
      messages,
    }
  });
});

// ========== 数据批量同步 (客户端上传) ==========
router.post('/sync', authRequired, (req, res) => {
  const shop = getShop(req);
  if (!shop) return res.status(400).json({ error: '店铺不存在' });
  const { orders, inventory, customers } = req.body;

  // 简单 upsert 逻辑: 按 id 存在则更新, 不存在则插入
  if (Array.isArray(orders)) {
    orders.forEach(item => {
      const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(item.id);
      if (existing) {
        db.prepare('UPDATE orders SET status = ?, coupon_price = ? WHERE id = ?')
          .run(item.status || item.status, item.coupon_price || item.coupon_price, item.id);
      } else {
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO orders (id, shop_id, user_id, customer_name, platform, amount, coupon_price, status, time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run(item.id, shop.id, req.user.id, item.customer_name || '', item.platform || '美团',
          item.amount || 0, item.coupon_price || 0, item.status || 'pending', item.time || '');
      }
    });
  }

  res.json({ success: true });
});

module.exports = router;
