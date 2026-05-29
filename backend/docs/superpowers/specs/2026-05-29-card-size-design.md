---
name: card-size-design
description: RSS reader card size optimization with 3:4 aspect ratio
metadata:
  type: spec
---

# 卡片大小优化设计方案

## 需求

- 卡片保持固定宽高比（3:4）
- 大/中/小三档密度可选
- 侧边栏收进去时卡片列数自动增加（保持数量）
- 切换大小时有弹性动画效果

## 设计决策

1. **宽高比**：使用 CSS `aspect-ratio: 3/4`
2. **布局**：CSS Grid `repeat(auto-fill, minmax())` 自动计算列数
3. **响应式**：侧边栏收起时 Grid 自动重新布局，无需 JS 介入
4. **动画**：`cubic-bezier(0.34, 1.56, 0.64, 1)` 弹性曲线，350ms 过渡

## 实现

### CSS

```css
.articles-grid {
  display: grid;
  gap: 20px;
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.articles-grid.density-large {
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.articles-grid.density-medium {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

.articles-grid.density-small {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.article-card {
  aspect-ratio: 3/4;
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.article-card .cover {
  height: 45%;
}

.article-card .content {
  height: 55%;
}
```

### 密度规格

| 密度 | 最小宽度 | 封面高度 | 内容区高度 |
|------|----------|----------|------------|
| 大卡片 | 320px | 45% | 55% |
| 中卡片 | 240px | 45% | 55% |
| 小卡片 | 180px | 45% | 55% |

### 行为

- 侧边栏收起：Grid 自动增加列数，卡片数量不变
- 密度切换：平滑动画过渡宽度和高度
- 窗口缩放：CSS Grid 自动响应，无需 JS 处理
