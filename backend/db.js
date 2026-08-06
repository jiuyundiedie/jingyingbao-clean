// ============================================
// 经营宝后端数据库模块 (SQLite)
// ============================================
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/jingyingbao.db';
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ========== 数据表结构 ==========
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT '商家',
  name TEXT DEFAULT '',
  shop_name TEXT DEFAULT '',
  industry TEXT DEFAULT '餐饮类',
  avatar TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  shop_name TEXT NOT NULL,
  industry TEXT DEFAULT '餐饮类',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  platform TEXT DEFAULT '美团',
  order_no TEXT DEFAULT '',
  amount REAL DEFAULT 0,
  coupon_price REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  items TEXT DEFAULT '[]',
  remark TEXT DEFAULT '',
  time TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  stock INTEGER DEFAULT 0,
  platform TEXT DEFAULT '通用',
  barcode TEXT DEFAULT '',
  price REAL DEFAULT 0,
  category TEXT DEFAULT '',
  photo_uri TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  total_orders INTEGER DEFAULT 0,
  total_amount REAL DEFAULT 0,
  tags TEXT DEFAULT '[]',
  last_visit TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  from_role TEXT DEFAULT 'user',
  content TEXT DEFAULT '',
  platform TEXT DEFAULT '美团',
  time TEXT DEFAULT '',
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  messages TEXT DEFAULT '[]',
  industry TEXT DEFAULT '餐饮类',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target TEXT DEFAULT '',
  detail TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sms_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT DEFAULT 'login',
  expires_at DATETIME NOT NULL,
  used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform);
CREATE INDEX IF NOT EXISTS idx_inventory_shop_id ON inventory(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_messages_shop_id ON messages(shop_id);

-- ========== 会员系统 ==========
CREATE TABLE IF NOT EXISTS membership_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, -- 套餐名称: 基础版/标准版/专业版
  duration_months INTEGER NOT NULL, -- 时长: 1/3/12/24
  price REAL NOT NULL, -- 价格
  original_price REAL DEFAULT 0, -- 原价
  features TEXT DEFAULT '[]', -- 权益列表 JSON
  description TEXT DEFAULT '', -- 描述
  is_recommended INTEGER DEFAULT 0, -- 是否推荐
  status TEXT DEFAULT 'active', -- active/inactive
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  level TEXT DEFAULT 'basic', -- basic/standard/pro
  status TEXT DEFAULT 'active', -- active/expired/frozen
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  auto_renew INTEGER DEFAULT 0,
  payment_method TEXT DEFAULT 'alipay',
  payment_status TEXT DEFAULT 'paid',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
);

-- ========== 优惠券系统 ==========
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL, -- 优惠券名称
  type TEXT DEFAULT 'discount', -- discount(折扣)/cash(现金)/exchange(兑换)
  value REAL DEFAULT 0, -- 折扣值或金额
  min_amount REAL DEFAULT 0, -- 最低消费门槛
  max_discount REAL DEFAULT 0, -- 最大优惠金额(折扣券用)
  total_count INTEGER DEFAULT 0, -- 总数量 (0=不限)
  remain_count INTEGER DEFAULT 0, -- 剩余数量
  per_limit INTEGER DEFAULT 1, -- 每人限领数量
  scope TEXT DEFAULT 'all', -- all/category/item
  scope_ids TEXT DEFAULT '[]', -- 适用范围ID列表
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'active', -- active/inactive
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL, -- 领券用户ID(客户表)
  customer_id INTEGER DEFAULT 0, -- 关联客户档案
  code TEXT DEFAULT '', -- 券码
  status TEXT DEFAULT 'unused', -- unused/used/expired
  used_at DATETIME DEFAULT NULL,
  order_id INTEGER DEFAULT 0, -- 使用的订单ID
  discount_amount REAL DEFAULT 0, -- 实际优惠金额
  claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_shop_id ON memberships(shop_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
CREATE INDEX IF NOT EXISTS idx_coupons_shop_id ON coupons(shop_id);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);
CREATE INDEX IF NOT EXISTS idx_user_coupons_user_id ON user_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_status ON user_coupons(status);
`);

module.exports = db;
