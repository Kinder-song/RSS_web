# RSS 阅读器

一个带有 AI 摘要功能的 RSS 阅读器 Web 应用，支持多源订阅、自动抓取和文章管理。

## 功能特性

- **多源订阅管理** - 添加、删除、验证 RSS 源
- **文章搜索** - 按标题、内容、摘要关键词搜索
- **AI 摘要生成** - 调用 MiniMax API 生成文章摘要
- **定时自动抓取** - 每 6 小时自动更新文章 (0, 6, 12, 18 点)
- **阅读状态追踪** - 标记已读/未读文章
- **原文获取** - 查看原始网页内容
- **主题切换** - 支持浅色/深色模式
- **键盘快捷键** - 高效键盘操作
- **响应式布局** - 适配桌面和移动设备

## 技术栈

### 后端
- Node.js + Express
- MySQL 数据库
- RSS Parser
- node-cron 定时任务
- express-rate-limit 请求限流

### 前端
- 原生 JavaScript (ES Modules)
- CSS 变量主题系统
- Newsreader + Inter 字体

## 项目结构

```
RSS_test/
├── backend/
│   ├── index.js          # Express 服务入口
│   ├── db.js             # MySQL 连接池
│   ├── rss.js            # RSS 解析模块
│   ├── ai.js             # AI 摘要生成
│   ├── middleware/      # 中间件 (auth, cache, logger)
│   └── services/         # 业务服务 (fetch, article)
├── frontend/
│   ├── index.html        # 主页面
│   ├── css/style.css     # 样式文件
│   └── js/
│       ├── app.js        # 应用入口
│       ├── api.js        # API 请求封装
│       ├── state.js      # 状态管理
│       ├── utils.js      # 工具函数
│       └── components/   # UI 组件
├── Mysql/
│   └── init.sql          # 数据库初始化脚本
└── .gitignore
```

## 快速开始

### 1. 配置环境变量

在 `backend/` 目录创建 `.env` 文件：

```env
PORT=55300
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=RSS
CORS_ORIGIN=http://localhost:55300
MINIMAX_API_KEY=your_minimax_api_key
```

### 2. 初始化数据库

```bash
mysql -u root -p < Mysql/init.sql
```

### 3. 安装依赖并启动

```bash
cd backend
npm install
npm start
```

访问 http://localhost:55300

## 数据库迁移

首次部署后需执行迁移脚本以启用新功能：

```bash
mysql -u root -p < Mysql/migrations/002_add_source_metadata.sql
```

迁移为订阅源表新增：
- `last_fetched`: 最后抓取时间
- `article_count`: 文章总数

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sources | 获取所有订阅源 |
| POST | /api/sources | 添加订阅源 |
| DELETE | /api/sources/:id | 删除订阅源 |
| POST | /api/sources/:id/fetch | 手动抓取指定源 |
| POST | /api/sources/fetch-all | 抓取所有源 |
| GET | /api/articles | 获取文章列表 |
| GET | /api/articles/:id | 获取文章详情 |
| GET | /api/articles/:id/content | 获取带 AI 摘要的文章 |
| GET | /api/articles/:id/original | 获取原始网页 |
| PATCH | /api/articles/:id/read | 更新阅读状态 |
| PATCH | /api/articles/read-all | 全部标为已读 |

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `N` | 添加新订阅源 |
| `R` | 刷新当前源 |
| `/` | 聚焦搜索框 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+T` | 切换主题 |
| `Ctrl+←/→` | 翻页 |
| `Esc` | 关闭弹窗/预览 |

## License

ISC