# RSS 阅读器 — 设计与重构规范

**日期**: 2026-05-20
**状态**: 已批准

---

## 1. 设计方向

**选定方案**: 晴空蓝梦 — 玫瑰粉与天蓝交织

### 配色系统

```
主色调:
- Rose (强调): #e11d48 (亮色) / #f472b6 (暗色)
- Sky Blue (辅助): #3b82f6 (亮色) / #60a5fa (暗色)
- Purple Accent: #8b5cf6

渐变色系 (晴空蓝梦):
- 粉: #fce7f3 → #f5d0fe
- 蓝: #bae6fd → #93c5fd
- 紫: #c4b5fd → #a5c4f5

Light Theme:
- surface-0: #f8faff
- surface-1: #ffffff
- surface-2: #f0f5ff
- surface-3: #e8f0ff
- text-primary: #1a1f35
- text-secondary: #4a5568
- text-muted: #718096

Dark Theme:
- surface-0: #0f1225
- surface-1: #161a2e
- surface-2: #1e2438
- surface-3: #262d42
- text-primary: #f0f4ff
- text-secondary: #b0bac8
- text-muted: #8896aa
```

### 动画系统

| 元素 | 动画效果 | 时长 |
|------|----------|------|
| 文章卡片 | 交错渐入 + 悬浮光晕 + 缩放反馈 | 500ms / 300ms |
| 预览窗口 | 缩放+位移渐入 + 背景模糊过渡 | 450ms |
| 侧边栏 | transform: translateX 弹性动画 | 350ms |
| Toast | 从右侧滑入 + 渐隐 | 350ms |
| 骨架屏 | Shimmer 闪光动画 | 1800ms 循环 |
| 按钮 | scale 0.95 按压反馈 | 150ms |

---

## 2. 功能性修复

### Critical (必须修复)

| 问题 | 解决方案 |
|------|----------|
| auth.js: 无 API_KEY 时放行所有请求 | 环境未配置时拒绝所有 mutating 请求 |
| fetchService.js: Mutex 无超时，死锁风险 | 添加 30s 超时，自动释放并记录错误 |
| SSRF 防护缺失 IPv6 | 使用 `net.isIP()` 检测 + 阻止内网 IPv6 范围 |

### High (高优先级)

| 问题 | 解决方案 |
|------|----------|
| ai.js truncateText 内存效率 | 使用 `text.slice().substring()` 替代 spread |
| previewJump.onclick 内存泄漏 | 使用 `removeEventListener` 或一次性函数 |
| loadArticles 竞态条件 | 添加请求取消机制 + 防抖 |
| app.js 使用 var | 全部替换为 let/const |
| escapeHtml 每次创建 DOM | 改为正则缓存替换 |

### Medium (中优先级)

| 问题 | 解决方案 |
|------|----------|
| CSS 动画延迟硬编码 | 改用 CSS 变量 `--animation-delay` |
| 暗色主题对比度不足 | 调整 text-muted/secondary 在 surface-2/3 上的值 |
| 侧边栏收起无动画 | 改用 translateX 替代 width:0 |

---

## 3. 前端改进

### UI/UX 增强

1. **骨架屏加载** — 文章网格显示骨架卡片而非 spinner
2. **卡片悬浮光晕** — hover 时添加 box-shadow 脉动
3. **预览窗口模糊渐入** — backdrop-filter 过渡
4. **按钮按压反馈** — 所有可点击元素添加 scale(0.95) 效果
5. **Focus 可见性** — 添加 focus-visible 轮廓环
6. **暗色主题优化** — 所有文本满足 WCAG AA (4.5:1)

### 组件重构

- `app.js` 模块化: 拆分 API、状态管理、渲染逻辑
- `style.css` 变量化: 所有颜色/间距/动画归入 CSS 变量
- 添加 CSS custom property 支持动态 animation-delay

---

## 4. 后端改进

### 架构优化

1. **fetchService.js** — 添加 mutex 超时和错误恢复
2. **index.js** — 增强 SSRF 防护 (IPv4/IPv6)
3. **cache.js** — 添加 maxSize 限制防止内存溢出
4. **ai.js** — 优化 truncateText 内存使用

### 安全加固

- auth.js 默认为拒绝模式
- SSRF 防护覆盖 IPv4 内网段 + IPv6 私有段
- 添加请求超时保护

---

## 5. 技术栈

- **前端**: Vanilla JS (ES6+), CSS3 (变量/动画/网格)
- **后端**: Node.js, Express, MySQL
- **AI**: MiniMax Text API
- **字体**: Newsreader (标题), Inter (正文)

---

## 6. 实施顺序

1. 修复 Critical 后端安全问题 (auth, SSRF, mutex)
2. 重构前端 app.js (var → let/const, 模块化)
3. 更新 CSS 设计系统 (配色 + 动画)
4. UI/UX 增强 (骨架屏, 光晕, 模糊过渡)
5. 测试验证所有功能正常