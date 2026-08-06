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
```

### 3. 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 4. Docker 部署
```bash
cd backend
docker compose up -d
```

### 5. PM2 部署
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 开机自启
```

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

## 数据库

使用 SQLite，数据文件位于 `./data/jingyingbao.db`。

## 目录结构
```
backend/
├── server.js          # 入口
├── db.js              # 数据库模块
├── package.json
├── .env.example       # 环境变量模板
├── middleware/
│   └── auth.js        # JWT 鉴权
├── routes/
│   ├── auth.js        # 认证接口
│   ├── ai.js          # AI 代理
│   └── data.js        # 数据管理
├── utils/
│   └── sms.js         # 短信服务
├── ecosystem.config.js # PM2 配置
├── nginx.conf          # Nginx 配置
└── docker-compose.yml  # Docker 配置
```
