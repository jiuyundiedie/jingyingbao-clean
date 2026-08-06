# 经营宝架构演进路线图

## 当前阶段（v5.58 · 用户 < 1000）

### 技术栈
```
前端: React Native (Expo)
后端: Node.js + Express + SQLite
管理后台: 内置 admin.html (纯HTML)
部署: 单机部署（PM2 / Docker）
```

### 架构图
```
┌─────────────┐     ┌──────────────┐     ┌─────────┐
│  商家 App    │────▶│  后端 API    │────▶│ SQLite  │
│  (React Native)   │  (Express)   │     │         │
└─────────────┘     └──────┬───────┘     └─────────┘
                           │
                    ┌──────┴───────┐
                    │  管理后台     │
                    │  (admin.html) │
                    └──────────────┘
```

### 特点
- ✅ 简单、快速部署
- ✅ SQLite 零配置
- ✅ admin.html 内置管理功能

### 限制
- ❌ SQLite 单文件，高并发写入锁表
- ❌ 单机部署，无法水平扩展
- ❌ 管理后台功能有限

---

## 第二阶段（用户 1000-10000）

### 升级点
```
SQLite → PostgreSQL/MySQL
单机 → Nginx + PM2 多进程
管理后台 → admin.jingyingbao.cn 子域名
```

### 架构图
```
┌─────────────┐
│  商家 App    │────┐
└─────────────┘    │     ┌──────────────┐     ┌────────────┐
                    ├────▶│  Nginx 反向   │────▶│ PostgreSQL │
┌─────────────┐    │     │  代理负载均衡 │     │            │
│  管理后台    │────┘     └──────┬───────┘     └────────────┘
│  admin.xxx   │                 │
└─────────────┘          ┌──────┴───────┐
                         │ PM2 多进程    │
                         │ (cluster 模式) │
                         └───────────────┘
```

### 改造点
1. **数据库迁移**：将 `better-sqlite3` 替换为 `pg` 或 `mysql2`
2. **SQL 适配**：
   - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL`
   - `DATE(created_at)` → `DATE(created_at::date)` 或 `CAST(created_at AS DATE)`
   - 其他 SQLite 特有语法审计
3. **管理后台独立**：将 `admin.html` 部署到独立域名
4. **增加 Redis 缓存**：热点数据（如配置、统计）走缓存

---

## 第三阶段（用户 > 10000）

### 升级点
```
管理后台 → 独立 React 项目
API 网关 → 独立部署
微服务拆分（可选）
```

### 架构图
```
┌─────────────┐     ┌──────────────┐
│  商家 App    │────▶│  API 网关     │
└─────────────┘     │  (Kong/Nginx) │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────┴──────┐ ┌────┴────┐ ┌──────┴──────┐
     │ 用户服务     │ │ 订单服务 │ │ 分析服务     │
     │ (Express)   │ │(Express)│ │ (Express)   │
     └──────┬──────┘ └────┬────┘ └──────┬──────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
                    ┌──────┴───────┐
                    │  PostgreSQL   │
                    │  (主从复制)   │
                    └──────────────┘
                           ▲
                    ┌──────┴───────┐
                    │  管理后台     │
                    │  (React +     │
                    │   Ant Design) │
                    └──────────────┘
```

### 改造点
1. **管理后台独立项目**：React + Ant Design Pro，代码放在 `admin-web/` 目录
2. **微服务拆分**：按业务领域拆分服务（用户、订单、分析）
3. **数据库主从**：读写分离
4. **消息队列**：Kafka/RabbitMQ 处理异步任务（日志、通知）
5. **容器化部署**：Docker + Kubernetes

---

## 现在需要做的准备

### 1. SQL 标准化（立即）

当前代码中的 SQLite 特有语法：

| 当前写法 | PostgreSQL 替代 |
|---------|---------------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL` 或 `INTEGER GENERATED ALWAYS AS IDENTITY` |
| `DATE(created_at)` | `DATE(created_at::date)` 或 `CAST(created_at AS DATE)` |
| `JSON.parse()` + `JSON.stringify()` | 保持不变（应用层处理） |
| `ON CONFLICT(config_key) DO UPDATE` | 保持不变（PostgreSQL 原生支持） |

### 2. 数据库层抽象（可选）

在 `db.js` 中预留多数据库驱动：

```javascript
// 当前：单一 SQLite
const db = new Database(dbPath);

// 未来：根据 DB_TYPE 切换
if (process.env.DB_TYPE === 'postgres') {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // 适配 pg 接口到当前 db.prepare().get()/.all()/.run() 模式
}
```

### 3. 代码规范

- ✅ 所有 SQL 使用参数化查询（`?` 占位符）
- ✅ 避免 SQLite 特有函数
- ✅ 事务使用 `db.transaction()`（PostgreSQL 用 `BEGIN/COMMIT`）
- ✅ 日期处理在应用层完成，SQL 只存储原始字符串

---

## 决策指南

| 用户量 | 管理后台 | 数据库 | 部署 |
|-------|---------|--------|------|
| < 1000 | admin.html 内置 | SQLite | 单机 PM2 |
| 1000-10000 | admin.html 独立子域 | PostgreSQL + Redis | Nginx + 多进程 |
| > 10000 | 独立 React 项目 | PostgreSQL 主从 + Redis 集群 | Kubernetes |

---

## 总结

**当前阶段**：继续使用内置的 admin.html，够用且方便。
**准备工作**：审计 SQL 语句，确保无 SQLite 特有语法。
**触发器**：当用户量过千时，再升级到 PostgreSQL。

**不需要现在就做过度工程化**，把精力放在业务功能上。
