# RSS Reader 修复方案实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复测试报告中发现的 5 个问题，提升代码质量和可维护性

**Architecture:** 分三个阶段修复：高优先级（API_KEY 配置问题）、中优先级（前端模块拆分）、低优先级（代码清理）

**Tech Stack:** Node.js, Express, Vanilla JS, MySQL

---

## 文件结构

```
backend/
├── index.js                    # 主服务文件（需优化：抽取重复查询）
├── middleware/
│   └── auth.js                 # 认证中间件（需修复：分离认证和参数验证）
├── services/
│   └── fetchService.js         # 文章抓取服务
├── tests/
│   └── api.test.js            # API 单元测试（需修复测试）
frontend/js/
├── app.js                      # 主应用（需拆分：763行→多模块）
├── api.js                      # API 调用层
├── state.js                    # 状态管理
├── utils.js                    # 工具函数
├── components/                 # 新建：UI 组件目录
│   ├── render.js              # 渲染函数
│   ├── modal.js              # 模态框
│   ├── preview.js             # 预览窗口
│   └── toast.js               # 提示组件
Mysql/
└── init.sql                    # 数据库初始化（需清理：移除未使用字段）
```

---

## 问题清单

| 优先级 | 问题编号 | 问题描述 | 工作量 |
|-------|---------|---------|-------|
| 高 | P1 | API_KEY 未配置导致返回 503 而非 400 | 小 |
| 高 | P2 | 前端控制台 503 错误 | 小 |
| 中 | P3 | app.js 过大(763行)，需拆分 | 大 |
| 低 | P4 | deleteSource 函数重复定义 | 小 |
| 低 | P5 | rss_sources.description 字段未使用 | 小 |
| 低 | P6 | 后端 index.js 重复查询逻辑 | 中 |

---

## Task 1: 修复 API_KEY 配置问题 (P1, P2)

**Files:**
- Modify: `backend/middleware/auth.js:6-13`
- Modify: `backend/index.js:38-41`
- Modify: `backend/tests/api.test.js`

- [ ] **Step 1: 修改 auth.js 分离认证和参数验证逻辑**

修改 `backend/middleware/auth.js`，使得参数验证先于认证检查：

```javascript
// 修改后的 requireAuth 函数
export function requireAuth(req, res, next) {
    // API_KEY 未配置时，跳过认证（开发模式）
    if (!API_KEY || API_KEY === 'your_api_key_here') {
        console.warn('[auth] API_KEY not configured — allowing mutating request (dev mode)');
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.slice(7);
    if (token !== API_KEY) {
        return res.status(403).json({ error: 'Invalid API key' });
    }
    next();
}
```

- [ ] **Step 2: 验证修复 - 运行测试**

Run: `cd backend && npm test`
Expected: 所有测试通过，包括 `POST /api/sources without body returns 400`

- [ ] **Step 3: 测试 PATCH 端点**

Run: `curl -X PATCH http://localhost:55300/api/articles/1/read -H "Content-Type: application/json" -d '{"ai_read": true}'`
Expected: `{"message": "Article updated"}` 而非 503

- [ ] **Step 4: 提交**

```bash
git add backend/middleware/auth.js backend/tests/api.test.js
git commit -m "fix: separate auth from validation for dev mode"
```

---

## Task 2: 清理重复的 deleteSource 函数 (P4)

**Files:**
- Modify: `frontend/js/app.js`

- [ ] **Step 1: 定位重复函数**

检查 `app.js` 中的两个 `deleteSource` 函数定义（第 416 行和第 535 行），保留第 535 行的实现（因为它更新了 UI），删除第 416 行的 dead code。

- [ ] **Step 2: 运行测试验证**

Run: `python test_rss_comprehensive.py 2>&1 | grep -E "(PASSED|FAILED|✓|✗)"`
Expected: 所有测试通过

- [ ] **Step 3: 提交**

```bash
git add frontend/js/app.js
git commit -m "fix: remove duplicate deleteSource function"
```

---

## Task 3: 清理未使用的 description 字段 (P5)

**Files:**
- Modify: `Mysql/init.sql`

- [ ] **Step 1: 检查 description 字段是否被使用**

Run: `grep -r "description" backend/ frontend/ --include="*.js" --include="*.html"`
Expected: 仅在 init.sql 中出现

- [ ] **Step 2: 修改 init.sql 移除 description 字段**

```sql
CREATE TABLE IF NOT EXISTS rss_sources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(512) NOT NULL UNIQUE,
    -- description TEXT,  -- 移除：字段未使用
    language VARCHAR(50) DEFAULT 'zh',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 3: 添加数据库迁移脚本**

Create: `Mysql/migrations/001_remove_unused_description.sql`

```sql
ALTER TABLE rss_sources DROP COLUMN IF EXISTS description;
```

- [ ] **Step 4: 提交**

```bash
git add Mysql/init.sql Mysql/migrations/001_remove_unused_description.sql
git commit -m "fix: remove unused description field from rss_sources"
```

---

## Task 4: 抽取后端重复查询逻辑 (P6)

**Files:**
- Modify: `backend/index.js`
- Create: `backend/services/articleService.js`

- [ ] **Step 1: 创建 articleService.js**

Create: `backend/services/articleService.js`

```javascript
import pool from '../db.js';

export async function getArticleById(id) {
    const [articles] = await pool.query(
        `SELECT a.*, s.name as source_name FROM articles a
         LEFT JOIN rss_sources s ON a.source_id = s.id WHERE a.id = ?`,
        [id]
    );
    return articles.length > 0 ? articles[0] : null;
}
```

- [ ] **Step 2: 修改 index.js 使用新服务**

替换以下位置的重复代码：
- 第 256-264 行 (GET /api/articles/:id)
- 第 273-281 行 (GET /api/articles/:id/content)
- 第 294-303 行 (GET /api/articles/:id/original)

```javascript
import { getArticleById } from './services/articleService.js';

// 在各端点中使用
app.get('/api/articles/:id', async (req, res) => {
    try {
        const article = await getArticleById(req.params.id);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: sanitizeError(error) });
    }
});
```

- [ ] **Step 3: 运行测试验证**

Run: `cd backend && npm test`
Expected: 所有测试通过

- [ ] **Step 4: 提交**

```bash
git add backend/index.js backend/services/articleService.js
git commit -m "refactor: extract duplicate article query logic to service"
```

---

## Task 5: 拆分前端 app.js (P3) - 可选高工作量任务

**Files:**
- Create: `frontend/js/components/render.js`
- Create: `frontend/js/components/modal.js`
- Create: `frontend/js/components/preview.js`
- Create: `frontend/js/components/toast.js`
- Modify: `frontend/js/app.js`
- Modify: `frontend/index.html`

> **Note:** 此任务工作量较大，建议单独创建详细计划

---

## Task 6: 验证整体修复

**Files:**
- Run: `python test_rss_comprehensive.py`
- Run: `cd backend && npm test`

- [ ] **Step 1: 运行完整测试套件**

Run:
```bash
cd backend && npm test
python test_rss_comprehensive.py
```

- [ ] **Step 2: 验证所有问题已修复**

| 问题 | 验证方法 |
|------|---------|
| P1: API_KEY 返回 503 | `curl -X POST http://localhost:55300/api/sources -H "Content-Type: application/json" -d '{}'` 返回 400 |
| P2: 前端无 console 错误 | 运行 `test_rss_comprehensive.py` 无 console 错误 |
| P4: deleteSource 重复 | `grep -c "function deleteSource" frontend/js/app.js` 返回 1 |
| P5: description 字段 | `grep "description" Mysql/init.sql` 无结果 |
| P6: 重复查询逻辑 | `grep -c "SELECT a.\*, s.name as source_name" backend/index.js` 返回 1 |

- [ ] **Step 3: 更新测试报告**

将 TEST_REPORT.md 中问题状态更新为"已修复"

---

## 验收标准

修复完成后，以下测试应全部通过：

1. `cd backend && npm test` - 所有后端单元测试通过
2. `python test_rss_comprehensive.py` - 所有 17 个前端测试通过
3. PATCH /api/articles/1/read 返回 200 而非 503
4. DELETE /api/sources/:id 返回正确状态码
5. 前端无 console 503 错误

---

## 计划完成

修复方案已保存至 `docs/superpowers/plans/2026-05-24-rss-reader-fixes.md`

**两个执行选项:**

**1. Subagent-Driven (推荐)** - 每个 Task 由独立 subagent 执行，任务间有检查点
- 使用 superpowers:subagent-driven-development

**2. Inline Execution** - 在当前 session 中顺序执行
- 使用 superpowers:executing-plans

**选择哪个方式？**