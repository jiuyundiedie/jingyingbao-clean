// ============================================
// 管理路由认证中间件
// 支持用户 token 和管理员 token
// ============================================
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jingyingbao-secret-key-2024';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 管理员 token 存储（模块级单例）
const ADMIN_TOKENS = new Map();

// 管理员认证中间件（支持 admin token 和 user jwt）
function adminAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  
  if (!token) {
    return res.status(401).json({ error: '认证失败' });
  }
  
  // 检查管理员 token
  const session = ADMIN_TOKENS.get(token);
  if (session) {
    if (session.expiresAt < Date.now()) {
      ADMIN_TOKENS.delete(token);
      return res.status(401).json({ error: '管理员认证已过期' });
    }
    req.isAdmin = true;
    return next();
  }
  
  // 检查用户 JWT token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.isAdmin = false;
    return next();
  } catch (e) {
    return res.status(401).json({ error: '认证失败' });
  }
}

// 注册管理员 token
function registerAdminToken(token) {
  ADMIN_TOKENS.set(token, { expiresAt: Date.now() + 24 * 3600 * 1000 });
}

// 验证管理员密码
function verifyAdminPassword(password) {
  return password === ADMIN_PASSWORD;
}

// 清理过期 token
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, session] of ADMIN_TOKENS) {
    if (session.expiresAt < now) ADMIN_TOKENS.delete(token);
  }
}

// 获取管理员 token 数量
function getAdminTokenCount() {
  return ADMIN_TOKENS.size;
}

module.exports = { 
  adminAuth, 
  registerAdminToken, 
  verifyAdminPassword,
  cleanupExpiredTokens,
  getAdminTokenCount,
  ADMIN_TOKENS 
};
