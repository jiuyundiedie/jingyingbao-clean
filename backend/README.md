# 经营宝后端服务

## 快速开始

### 1. 安装依赖
```bash
cd backend
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 填入真实密钥
# ADMIN_PASSWORD 为管理后台密码（默认 admin123）
```

### 3. 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 4. 访问管理后台
启动后在浏览器访问：
```
http://localhost:3000/admin
```
- 默认密码：`admin123`
- 请在 `.env` 中修改 `ADMIN_PASSWORD` 为强密码

## 管理后台功能

### 📊 数据概览
- 日活跃用户数（DAU）
- 功能使用次数统计
- 功能种类统计
- 新增用户数
- 最近反馈列表

### 💬 反馈管理
- 查看所有用户反馈、投诉、Bug 报告
- 按状态筛选（待处理/处理中/已解决）
- 按类型筛选（建议/Bug/投诉/崩溃）
- 回复用户反馈

### ⚙️ 远程配置
- 功能开关（如 `feature_membership_enabled`）
- 维护模式控制
- 强制更新版本设置
- 无需发版即可更新配置

### 📦 版本管理
- 发布新版本
- 支持强制更新
- 版本 CRUD 操作
- 下载链接管理

## 接口文档

### 认证相关
- `POST /api/auth/sms/send` - 发送验证码
- `POST /api/auth/login` - 手机验证码登录
- `POST /api/auth/wechat` - 微信登录
- `GET  /api/auth/me` - 获取当前用户
- `PUT  /api/auth/me` - 更新用户信息

### AI 服务
- `POST /api/ai/chat` - AI 对话
- `POST /api/ai/image` - AI 图片生成

### 数据管理
- `GET  /api/data/orders` - 获取订单列表
- `POST /api/data/orders` - 创建订单
- `GET  /api/data/inventory` - 获取库存
- `POST /api/data/inventory` - 创建库存
- `GET  /api/data/customers` - 获取客户
- `GET  /api/data/sync` - 全量数据同步
- `POST /api/data/sync` - 批量数据同步

### 会员管理
- `GET  /api/membership/plans` - 获取套餐列表
- `GET  /api/membership/current` - 查询当前会员
- `POST /api/membership/purchase` - 购买/续费
- `GET  /api/membership/history` - 会员历史

### 优惠券
- `GET/POST/PUT/DELETE /api/coupons` - 优惠券 CRUD
- `POST /api/coupons/claim/:id` - 用户领券
- `POST /api/coupons/send-to-customers/:id` - 批量发放
- `POST /api/coupons/redeem/:id` - 核销优惠券
- `GET  /api/coupons/stats` - 优惠券统计

### 分析与反馈
- `POST /api/analytics/track` - 上报行为事件
- `POST /api/analytics/track/batch` - 批量上报
- `GET  /api/analytics/stats/overview` - 数据统计（管理员）
- `POST /api/analytics/crash` - 崩溃上报
- `POST /api/feedback` - 提交反馈
- `GET  /api/feedback/my` - 我的反馈
- `GET  /api/feedback/admin/list` - 反馈列表（管理员）
- `PUT  /api/feedback/admin/reply/:id` - 回复反馈（管理员）
- `GET  /api/feedback/admin/stats` - 反馈统计（管理员）

### 版本与配置
- `POST /api/config/check` - 版本检查
- `GET/POST/PUT/DELETE /api/config/versions` - 版本管理（管理员）
- `GET  /api/config` - 获取远程配置
- `POST /api/config` - 更新配置（管理员）

### 管理员接口
- `POST /api/admin/login` - 管理员登录
- `POST /api/admin/logout` - 管理员登出

## 数据库

使用 SQLite，数据文件位于 `./data/jingyingbao.db`。

### 主要数据表
- `users` - 用户表
- `shops` - 店铺表
- `orders` - 订单表
- `customers` - 客户表
- `membership_plans` - 会员套餐表
- `memberships` - 用户会员记录表
- `coupons` - 优惠券模板表
- `user_coupons` - 用户优惠券表
- `user_behavior_logs` - 用户行为日志表
- `user_feedbacks` - 用户反馈表
- `app_versions` - 版本信息表
- `remote_configs` - 远程配置表

## 目录结构
```
backend/
├── server.js          # 入口
├── db.js              # 数据库模块
├── package.json
├── .env.example       # 环境变量模板
├── public/
│   └── admin.html     # 管理后台页面
├── middleware/
│   ├── auth.js        # JWT 鉴权
│   └── adminAuth.js   # 管理员鉴权
├── routes/
│   ├── auth.js        # 认证接口
│   ├── ai.js          # AI 代理
│   ├── data.js        # 数据管理
│   ├── membership.js  # 会员管理
│   ├── coupons.js    # 优惠券管理
│   ├── analytics.js   # 数据分析
│   ├── feedback.js    # 反馈管理
│   └── config.js      # 版本与配置
├── utils/
│   └── sms.js         # 短信服务
├── ecosystem.config.js # PM2 配置
├── nginx.conf          # Nginx 配置
└── docker-compose.yml  # Docker 配置
```
