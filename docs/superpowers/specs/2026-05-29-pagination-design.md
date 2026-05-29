# RSS Reader Pagination Refactor Design

## Overview

重构文章卡片分页功能，从基于固定数值（12/24/48篇/页）改为基于屏幕自适应的行数+密度选择模式，提供更符合直觉的阅读体验。

## Layout Logic

1. **用户选择行数**：6行、7行、或8行（每页固定行数）
2. **用户选择卡片大小**：大、中、小
3. **列数由屏幕宽度自动计算**，不受用户控制

每页文章数量 = 行数 × 列数（列数取决于屏幕宽度和卡片最小宽度）

## Density Options

| 密度 | 卡片最小宽度 | 大约列数 | 每页篇数（6-8行） |
|------|-------------|---------|------------------|
| 大 | 360px | 2-3列 | 12-24篇 |
| 中 | 280px | 3-4列 | 18-32篇 |
| 小 | 220px | 4-6列 | 24-48篇 |

## UI Layout

### 上方 Toolbar 区域（密度选择）

```
┌─────────────────────────────────────────────────────────────┐
│  [≡]  [搜索框........................]  [密度: 大 中 小] [↻] [🌙] │
└─────────────────────────────────────────────────────────────┘
```

密度选择器是一个紧凑的按钮组：
- 显示当前选中的密度（大/中/小）
- 点击展开行数选项（6/7/8）
- 用户选择后实时生效

### 下方分页区域（保持原样）

```
┌─────────────────────────────────────────────────────────────┐
│  [<] [1] [2] [3] ... [10] [>]     第3页/共28页    跳转:[__] │
└─────────────────────────────────────────────────────────────┘
```

## Component Specifications

### Density Selector

**位置**：Toolbar 右侧，主题切换按钮左侧

**结构**：
- 当前显示：当前选中的密度（大/中/小）+ 行数（6/7/8）
- 点击展开下拉菜单，包含3×3=9种组合

**展开菜单内容**：
```
┌────────────────┐
│ 大卡片 ▾       │
├────────────────┤
│ ● 6行         │ ← 当前选中
│   7行         │
│   8行         │
├────────────────┤
│   中卡片       │
│   大卡片       │
└────────────────┘
```

每个选项显示：密度名称 + 行数 + 预计篇数（如"大卡片 · 6行 · ~18篇"）

**状态**：
- 默认：紧凑显示当前选择
- 展开：显示9个选项
- Hover：背景高亮

### 分页控件

保持原有设计，移至页面底部中央：
- 上一页/下一页按钮
- 页码数字（最多显示7个，两端省略）
- 总页数显示
- 跳转输入框

## State Management

```javascript
state.density = {
    size: 'medium',  // 'large' | 'medium' | 'small'
    rows: 7          // 6 | 7 | 8
}
state.pageSize = calculated_from_density_and_screen
```

**自动重算时机**：
1. 窗口大小变化时
2. 用户更改密度选择时
3. 用户切换订阅源时（可能需要重新计算列数）

## Implementation Notes

### CSS Grid Auto-Fit

使用 `grid-template-columns: repeat(auto-fill, minmax(CARD_MIN_WIDTH, 1fr))` 实现自适应列数：

- 大卡片：`minmax(360px, 1fr)`
- 中卡片：`minmax(280px, 1fr)`
- 小卡片：`minmax(220px, 1fr)`

### Page Size Calculation

```javascript
function calculatePageSize(density, containerWidth) {
    const cardMinWidth = { large: 360, medium: 280, small: 220 };
    const minWidth = cardMinWidth[density.size];
    const columns = Math.max(1, Math.floor(containerWidth / minWidth));
    return columns * density.rows;
}
```

### 行数按钮UI

行数按钮可作为密度选择下拉菜单内的子选项，也可以单独放在toolbar上：

**方案A（推荐）**：密度下拉菜单内直接包含9种组合选项

**方案B**：Toolbar上两个独立控件
```
[密度: 大 中 小]  [行数: 6 7 8]
```

考虑到空间，建议采用方案A，在一个紧凑的下拉菜单内完成选择。

## Files to Modify

1. `frontend/js/state.js` - 添加 density 配置
2. `frontend/js/utils.js` - 更新 calculateAutoPageSize 函数
3. `frontend/js/app.js` - 添加密度选择器事件处理
4. `frontend/js/components/render.js` - 移除旧的 pageSizeSelect，更新分页逻辑
5. `frontend/css/style.css` - 样式调整
6. `frontend/index.html` - 添加密度选择器UI元素

## Migration

- 保留用户之前的分页偏好（如果保存了）
- 如果没有偏好，默认使用：中卡片、7行
- 删除旧的 pageSizeSelect 相关代码和CSS