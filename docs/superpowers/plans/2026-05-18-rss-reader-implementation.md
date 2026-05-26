# RSS 阅读器实现计划

**Goal：** 完成带有 AI 增强功能的 RSS 订阅阅读应用

**Architecture：** 前后端分离，后端 Node.js + Express 提供 API，前端单文件 HTML/CSS/JS，MySQL 持久化数据，RSSHub 标准化 RSS 解析，MiniMax API 生成摘要

**Tech Stack：** Node.js, Express, MySQL, RSSHub, MiniMax API, node-cron

---

## 文件结构

```
RSS/
├── backend/
│   ├── index.js          # Express 服务器入口
│   ├── db.js             # 数据库连接
│   ├── rss.js            # RSS 解析
│   ├── ai.js             # MiniMax AI
│   ├── .env               # 环境变量
│   └── package.json       # 依赖
├── frontend/
│   └── index.html         # 前端单文件
├── Mysql/
│   └── init.sql           # 数据库初始化
└── docs/
    └── specs/
        └── 2026-05-18-rss-reader-design.md
```

---

## 任务 1: 创建数据库初始化脚本

**Files:**
- Create: `Mysql/init.sql`

```sql
CREATE DATABASE IF NOT EXISTS RSS CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE RSS;

CREATE TABLE IF NOT EXISTS rss_sources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(512) NOT NULL UNIQUE,
    description TEXT,
    language VARCHAR(50) DEFAULT 'zh',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_id INT NOT NULL,
    title VARCHAR(512),
    url VARCHAR(512),
    summary TEXT,
    content TEXT,
    cover_path VARCHAR(512),
    published_at DATETIME,
    ai_read TINYINT(1) DEFAULT 0,
    web_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES rss_sources(id) ON DELETE CASCADE,
    INDEX idx_source_id (source_id),
    INDEX idx_published_at (published_at),
    INDEX idx_ai_read (ai_read),
    INDEX idx_web_read (web_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 任务 2: 创建后端项目结构

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env`
- Create: `backend/db.js`
- Create: `backend/rss.js`
- Create: `backend/ai.js`
- Create: `backend/index.js`

**Step 1:** 创建 `backend/package.json`

```json
{
  "name": "rss-reader-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.5",
    "node-cron": "^3.0.3",
    "rss-parser": "^3.13.0",
    "axios": "^1.6.2",
    "dotenv": "^16.3.1",
    "cheerio": "^1.0.0-rc.12"
  }
}
```

**Step 2:** 创建 `backend/.env`

```env
PORT=55300
DB_HOST=43.143.143.187
DB_PORT=3306
DB_USER=root
DB_PASSWORD=nugtar-keZzi8-ryqcym
DB_NAME=RSS
RSSHUB_URL=http://43.143.143.187:51200
MINIMAX_API_KEY=your_api_key_here
```

**Step 3:** 创建 `backend/db.js`

```javascript
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export default pool;
```

**Step 4:** 创建 `backend/rss.js`

```javascript
import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';

const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['media:thumbnail', 'mediaThumbnail'],
            ['enclosure', 'enclosure']
        ]
    }
});

export async function parseRSS(feedUrl) {
    const feed = await parser.parseURL(feedUrl);
    return feed.items.map(item => ({
        title: item.title || '无标题',
        url: item.link || item.guid || '',
        published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
        cover_path: extractCover(item),
        content: item.content || item['content:encoded'] || item.summary || ''
    }));
}

function extractCover(item) {
    if (item.mediaContent && item.mediaContent.$) {
        return item.mediaContent.$.url || null;
    }
    if (item.mediaThumbnail && item.mediaThumbnail.$) {
        return item.mediaThumbnail.$.url || null;
    }
    if (item.enclosure && item.enclosure.url &&
        item.enclosure.type && item.enclosure.type.startsWith('image')) {
        return item.enclosure.url;
    }
    return null;
}
```

**Step 5:** 创建 `backend/ai.js`

```javascript
import axios from 'axios';

const MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_pro';

export async function generateSummary(text, apiKey) {
    if (!apiKey) {
        return text.substring(0, 200);
    }
    try {
        const response = await axios.post(MINIMAX_API_URL, {
            model: 'MiniMax-Text-01',
            messages: [{
                role: 'user',
                content: `请为以下文章生成100字以内的中文摘要：\n\n${text.substring(0, 2000)}`
            }],
            max_tokens: 200
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('MiniMax API error:', error.message);
        return text.substring(0, 200);
    }
}
```

**Step 6:** 创建 `backend/index.js`

完整实现 Express 服务器，包含所有 API 端点和定时任务（详见设计文档）。

**Step 7:** 安装依赖

```bash
cd backend && npm init -y && npm install
```

---

## 任务 3: 创建前端页面

**Files:**
- Create: `frontend/index.html`

实现完整的单文件前端，包含：
- 天空日落配色（天蓝 #a1c4fd → 粉紫 #fbc2eb）
- 抽屉式侧边栏（默认展开，可隐藏）
- 文章卡片网格（每页 12 条）
- 悬浮预览窗口（可拖拽、可调整大小）
- 主题切换（自动跟随系统 + 手动切换）
- 搜索功能（400ms 防抖）
- 分页功能

---

## 任务 4: 测试验证

**Step 1:** 验证数据库连接

```bash
cd backend && node -e "import('./db.js').then(m => m.default.getConnection().then(c => { console.log('DB connected'); c.release(); }))"
```

**Step 2:** 启动后端服务

```bash
cd backend && npm start
```

**Step 3:** 验证 API 端点

测试各端点是否正常返回数据。

**Step 4:** 在浏览器中测试前端页面

访问 http://localhost:55300

---

**计划完成**