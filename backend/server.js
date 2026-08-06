// ============================================
// 经营宝后端服务器
// ============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const { registerAdminToken, verifyAdminPassword, adminAuth, cleanupExpiredTokens } = require('./middleware/adminAuth');

const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const dataRoutes = require('./routes/data');
const membershipRoutes = require('./routes/membership');
const couponsRoutes = require('./routes/coupons');
const analyticsRoutes = require('./routes/analytics');
const feedbackRoutes = require('./routes/feedback');
const configRoutes = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_IP_WHITELIST = (process.env.ADMIN_IP_WHITELIST || '').split(',').filter(Boolean);

// ========== IP 白名单检查（管理后台）==========
function ipWhitelistCheck(req, res, next) {
  // 只对管理后台相关路径生效
  if (req.path.startsWith('/admin') || req.path.startsWith('/api/admin') || 
      req.path.startsWith('/api/feedback/admin') || req.path.startsWith('/api/config/versions') ||
      req.path.startsWith('/api/analytics/stats')) {
    
    // 未配置白名单时跳过
    if (ADMIN_IP_WHITELIST.length === 0) {
      return next();
    }
    
    const clientIp = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
    const isAllowed = ADMIN_IP_WHITELIST.some(allowed => {
      // 支持 CIDR 和精确匹配
      if (allowed.includes('/')) {
        // 简化处理：只检查前缀
        return clientIp.startsWith(allowed.split('/')[0].substring(0, allowed.split('/')[0].lastIndexOf('.')));
      }
      return clientIp === allowed || clientIp.endsWith('.' + allowed.split('.').pop());
    });
    
    if (!isAllowed) {
      console.warn(`[Admin] IP ${clientIp} 访问管理后台被拒绝`);
      return res.status(403).json({ error: '禁止访问' });
    }
  }
  next();
}

// ========== 中间件 ==========
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// IP 白名单检查（管理后台安全）
app.use(ipWhitelistCheck);

// 静态文件目录（图片上传等）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== 管理员登录 ==========
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ error: '密码错误' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  registerAdminToken(token);
  res.json({ token, expiresAt: Date.now() + 24 * 3600 * 1000 });
});

// 管理员登出
app.post('/api/admin/logout', adminAuth, (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  // token 会在过期时自动清理
  res.json({ success: true });
});

// ========== 路由 ==========
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'jingyingbao-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/config', configRoutes);

// ========== 管理后台静态页面 ==========
app.use('/admin', express.static(path.join(__dirname, 'public')));

// 根路径重定向到管理后台
app.get('/', (req, res) => {
  res.redirect('/admin/admin.html');
});

// ========== 全局错误处理 ==========
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
  });
});

// ========== 404 ==========
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在: ' + req.method + ' ' + req.path });
});

// ========== 定时清理过期 token ==========
setInterval(() => {
  cleanupExpiredTokens();
}, 3600 * 1000);

// ========== 启动 ==========
app.listen(PORT, () => {
  console.log('========================================');
  console.log('  经营宝后端服务已启动');
  console.log('  地址: http://localhost:' + PORT);
  console.log('  管理后台: http://localhost:' + PORT + '/admin');
  console.log('  管理员密码: ' + ADMIN_PASSWORD);
  console.log('  环境: ' + (process.env.NODE_ENV || 'development'));
  console.log('========================================');
});
