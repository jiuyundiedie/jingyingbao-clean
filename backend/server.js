// ============================================
// 经营宝后端服务器
// ============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const dataRoutes = require('./routes/data');
const membershipRoutes = require('./routes/membership');
const couponsRoutes = require('./routes/coupons');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== 中间件 ==========
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件目录（图片上传等）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// ========== 启动 ==========
app.listen(PORT, () => {
  console.log('========================================');
  console.log('  经营宝后端服务已启动');
  console.log('  地址: http://localhost:' + PORT);
  console.log('  环境: ' + (process.env.NODE_ENV || 'development'));
  console.log('========================================');
});
