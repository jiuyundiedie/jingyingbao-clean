const db = require('../db');

function sendCode(phone, code, purpose) {
  // 生产环境: 调用阿里云/腾讯云 SMS SDK
  // 开发环境: 仅保存到数据库, 日志输出验证码
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const stmt = db.prepare(
    'INSERT INTO sms_codes (phone, code, purpose, expires_at) VALUES (?, ?, ?, ?)'
  );
  stmt.run(phone, code, purpose || 'login', expiresAt);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SMS Mock] 发送验证码到 ${phone}: ${code} (用途: ${purpose})`);
  }
  return true;
}

function verifyCode(phone, code, purpose) {
  const purposeStr = purpose || 'login';
  const row = db.prepare(
    'SELECT * FROM sms_codes WHERE phone = ? AND code = ? AND purpose = ? AND used = 0 ORDER BY id DESC LIMIT 1'
  ).get(phone, code, purposeStr);

  if (!row) return false;

  const now = new Date().toISOString();
  if (row.expires_at < now) return false;

  db.prepare('UPDATE sms_codes SET used = 1 WHERE id = ?').run(row.id);
  return true;
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = { sendCode, verifyCode, generateCode };
