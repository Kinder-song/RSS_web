# RSS 阅读器设计文档

**日期：** 2026/05/18
**版本：** 1.0

---

## 一、视觉风格

**配色方案：** 天空日落
- 主渐变：天蓝 #a1c4fd → 粉紫 #fbc2eb
- 背景色：#f8f9ff（浅色）/ #1a1a2e（暗色）
- 强调色：#7c9cff（蓝紫）
- 文字色：#2d3748（浅色）/ #f0f0f5（暗色）

**设计规范：**
- 圆角：12px（卡片）、8px（按钮）
- 阴影：柔和阴影效果
- 动效：cubic-bezier(0.4, 0, 0.2, 1)

---

## 二、布局结构

```
+------------------+------------------------+
|    Header        |      Header            |
+------------------+------------------------+
|                  |                        |
|   侧边栏          |    文章网格区域          |
|  (默认展开)       |    (卡片式布局)          |
|  可隐藏           |                        |
|                  |                        |
+------------------+------------------------+
```

**侧边栏（Drawer）：**
- 宽度：280px
- 显示订阅源列表
- 顶部：Logo + 标题
- 底部：添加订阅源按钮
- 隐藏按钮：左侧边缘箭头，点击滑出

**主内容区：**
- 工具栏：搜索框、主题切换按钮
- 网格布局：每行 3-4 张卡片（响应式）
- 每页 12 条，支持分页

---

## 三、数据模型

### rss_sources 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT | 主键 |
| name | VARCHAR(255) | 订阅源名称 |
| url | VARCHAR(512) UNIQUE | 订阅源地址 |
| description | TEXT | AI 生成的订阅源简述 |
| language | VARCHAR(50) DEFAULT 'zh' | 文章语言 |
| created_at | DATETIME | 录入时间 |

### articles 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT | 主键 |
| source_id | INT NOT NULL | 外键 → rss_sources.id |
| title | VARCHAR(512) | 文章标题 |
| url | VARCHAR(512) | 文章地址 |
| summary | TEXT | AI 生成的内容简述 |
| content | TEXT | 文章正文（可选） |
| cover_path | VARCHAR(512) | 封面图片 URL |
| published_at | DATETIME | 文章发布时间 |
| ai_read | TINYINT(1) DEFAULT 0 | AI 已读 |
| web_read | TINYINT(1) DEFAULT 0 | 网页已读 |
| created_at | DATETIME | 记录创建时间 |
| updated_at | DATETIME | 更新时间（自动） |

---

## 四、功能模块

### 4.1 订阅源管理
- 添加订阅源（名称 + URL，支持 RSSHub）
- 删除订阅源（级联删除文章）
- 验证订阅源可用性（添加时按钮）
- 手动触发抓取（单源或全部）

### 4.2 文章浏览
- 卡片式网格列表（每页 12 条）
- 关键字搜索（400ms 防抖）
- 按订阅源筛选
- 发布时间倒序
- 未读/已读标签

### 4.3 悬浮预览窗口
- 毛玻璃背景 backdrop-filter: blur(10px)
- 可拖拽移动
- 可调整大小
- 位置记忆（localStorage）
- ESC 或关闭按钮关闭
- 自动标记 ai_read = 1
- 跳转原文按钮

### 4.4 主题切换
- 自动跟随系统 prefers-color-scheme
- 实时响应系统变化
- 手动切换按钮 ☀️/🌙
- localStorage 持久化

### 4.5 AI 简述生成
- 文章摘要：MiniMax API 生成 100 字内
- 订阅源描述：基于最新 5 篇文章生成 50 字内
- 降级处理：原文前 200 字符

### 4.6 封面图提取（优先级）
1. media:content
2. media:thumbnail
3. enclosure (image)
4. HTML img 标签
5. og:image meta

### 4.7 定时任务
- **Cron 表达式：** `0 0,6,12,18 * * *`
- 服务重启时执行一次
- 用户点击订阅源时执行该源

---

## 五、API 端点

### 订阅源
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sources | 获取所有订阅源 |
| POST | /api/sources | 添加订阅源 |
| DELETE | /api/sources/:id | 删除订阅源 |
| POST | /api/sources/:id/fetch | 抓取单源 |
| POST | /api/sources/fetch-all | 抓取所有 |
| GET | /api/sources/:id/validate | 验证订阅源 |

### 文章
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/articles | 获取文章列表（分页、搜索） |
| GET | /api/articles/:id | 获取单篇文章 |
| GET | /api/articles/:id/content | 获取文章正文 |
| PATCH | /api/articles/:id/read | 更新阅读状态 |

---

## 六、技术栈

- **后端：** Node.js + Express
- **前端：** 原生 HTML/CSS/JavaScript（单文件）
- **数据库：** MySQL
- **RSS 服务：** RSSHub
- **AI 服务：** MiniMax M2.7
- **定时任务：** node-cron

---

## 七、环境变量

```env
PORT=55300
DB_HOST=43.143.143.187
DB_PORT=3306
DB_USER=root
DB_PASSWORD=nugtar-keZzi8-ryqcym
DB_NAME=RSS
RSSHUB_URL=http://43.143.143.187:51200
MINIMAX_API_KEY=（待填写）
```

---

## 八、项目结构

```
RSS/
├── backend/
│   ├── index.js
│   ├── .env
│   └── package.json
├── frontend/
│   └── index.html
├── Mysql/
│   └── init.sql
└── docs/
    └── specs/
```