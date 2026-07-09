# 资源推荐 → 笔记风格改造 设计文档

**日期**: 2026-07-09
**状态**: 设计中

---

## 1. 目标

将"个性化资源推送中心"页面从浅色后台管理列表风格，改造为深色"面试笔记"风格的三栏文档站布局。核心思路是：

- 知识点 → 文章主题
- 推荐资源 → 文章内的学习材料块
- 资源类型筛选 → 文章小节
- 折叠行列表 → 左侧目录 + 中间正文

---

## 2. 当前状态

| 项目 | 现状 |
|------|------|
| 页面文件 | `frontend/src/pages/RecommendationsCenterPage.tsx`（750行，单文件，内联样式） |
| 路由 | `/recommendations` |
| 数据 API | `GET /api/v1/recommendations/personalized`（返回扁平资源列表） |
| 资源模型 | `KnowledgeResource`（knowledge_points: JSONB，resource_type: string） |
| 视觉风格 | 浅色背景 `#fff`，白色卡片，胶囊标签筛选条 |

---

## 3. 后端设计

### 3.1 新增端点

**`GET /api/v1/recommendations/notebook`**

返回按 `栏目 → 知识点 → 资源类型` 三层组织的结构化数据。

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `subject_id` | string | 否 | 按学科筛选 |

#### 响应结构

```json
{
  "categories": [
    {
      "id": "basic_structures",
      "title": "基础结构",
      "sort_order": 1,
      "topics": [
        {
          "id": "linked_list_anchor",
          "title": "链表",
          "resource_count": 5,
          "mastery_score": 45.0,
          "sections": [
            {
              "type": "image_text",
              "type_label": "图文讲解",
              "resources": [
                {
                  "id": "uuid",
                  "title": "链表操作详解",
                  "resource_type": "image_text",
                  "resource_type_label": "图文讲解",
                  "knowledge_points": ["链表", "指针"],
                  "difficulty_level": 2,
                  "source": "auto",
                  "source_label": "自动生成",
                  "tags": ["基础", "数据结构"],
                  "created_at": "2026-07-01T00:00:00",
                  "mastery_score": 45.0,
                  "description": "资源摘要1-2行",
                  "duration": "15分钟"
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "total_resources": 30,
  "total_topics": 10
}
```

#### 分类推导策略（三级降级）

1. **精确匹配**：资源 `knowledge_points` 中的名称 → 查 `KnowledgePoint` 表 → 取 `domain_id` → 取 `KnowledgeDomain.name` 作为栏目名
2. **关键词降级**：知识点不在 `KnowledgePoint` 表中时，按关键词规则映射：

   | 关键词 | 栏目 |
   |--------|------|
   | 链表、栈、队列、数组、哈希表、串、字符串 | 基础结构 |
   | 二叉树、BST、AVL、红黑树、堆、哈夫曼、树 | 树结构 |
   | 图、BFS、DFS、Dijkstra、邻接矩阵、邻接表、拓扑排序、最短路径、最小生成树 | 堆与图 |
   | 排序、查找、二分、冒泡、快排、归并、插入、选择、希尔 | 排序与查找 |

3. **兜底**：无法匹配的归入"其他知识点"

#### 实现位置

- 在 `app/api/endpoints/recommendations.py` 中新增路由函数
- 复用 `_resource_to_out()` 和资源查询逻辑
- 新增 `_derive_category()` 辅助函数和关键词映射字典
- 新增 `_group_into_notebook()` 聚合函数

### 3.2 现有端点保持不变

`GET /recommendations/personalized` 不改动，供其他页面（如 `HomePage`、`RecommendationPanel`）继续使用。

---

## 4. 前端设计

### 4.1 组件树

```
ResourceNotebookPage          ← 页面容器：数据获取、选中状态、刷新/删除/生成操作
├── TopCategoryNav            ← 顶部横向栏目导航
├── NotebookLayout            ← 三栏 CSS Grid 布局容器
│   ├── KnowledgeSidebar      ← 左侧目录：栏目分组 + 知识点列表
│   ├── ResourceArticle       ← 中间文章区
│   │   └── ResourceTypeSection ← 文章内小节（如"图文讲解"）
│   │       └── ResourceCard  ← 单个资源卡片
│   └── ArticleToc            ← 右侧本页目录
└── ToolbarActions            ← 右上角工具栏入口（刷新、生成资源）
```

### 4.2 各组件职责

| 组件 | 职责 |
|------|------|
| `ResourceNotebookPage` | 调用 `/recommendations/notebook`；管理 selectedCategory / selectedTopic / expandedGroups 状态；处理 refresh / delete / 生成弹窗；作为数据源向下传递 |
| `TopCategoryNav` | 渲染横向栏目标签；高亮当前栏目；点击切换栏目并选中第一个 topic |
| `NotebookLayout` | 纯布局组件；CSS Grid 三栏；响应式断点 |
| `KnowledgeSidebar` | 渲染栏目分组；展开/收起分组；知识点列表；当前选中高亮（`#8b8cff`） |
| `ResourceArticle` | 渲染文章：标题、导语（含资源数统计）、分割线、各资源类型小节 |
| `ResourceTypeSection` | 渲染一个资源类型小节（标题 + 资源卡片列表） |
| `ResourceCard` | 单个资源卡片：标题、类型标签、难度、摘要、操作按钮（查看详情/删除） |
| `ArticleToc` | 当前文章的资源类型锚点列表；点击滚动到对应小节；IntersectionObserver 滚动高亮 |
| `ToolbarActions` | 刷新按钮 + "生成资源"下拉菜单（思维导图/代码案例/图文讲解/文档/视频） |

### 4.3 数据流

```
ResourceNotebookPage
  │
  ├─ useEffect → GET /recommendations/notebook → setNotebookData
  │
  ├─ selectedCategory (state)  → TopCategoryNav, KnowledgeSidebar
  ├─ selectedTopic (state)     → KnowledgeSidebar, ResourceArticle, ArticleToc
  │
  ├─ handleRefresh()  → API 重新获取 → setNotebookData
  ├─ handleDelete(id) → DELETE /resources/{id} → 乐观移除 → API 重新获取
  │
  └─ 生成弹窗状态 (state) → ToolbarActions → 各 Modal 组件
```

### 4.4 视觉规格

#### 配色

| 用途 | 色值 |
|------|------|
| 页面背景 | `#18191f` |
| 左侧栏背景 | `#14151a` |
| 卡片/内容区背景 | `#1e1f26` |
| 正文文字 | `#e8e6df` |
| 次级文字 | `#9ca0aa` |
| 高亮/选中色 | `#8b8cff` |
| 选中背景 | `rgba(139, 140, 255, 0.10)` |
| 分割线 | `rgba(255, 255, 255, 0.08)` |
| 危险操作 | `#f87171`（低饱和度红） |

#### 布局

```
┌──────────────────────────────────────────────────────────────┐
│ TopCategoryNav: 首页 | 基础结构 | 树结构 | 堆与图 | ...       │ h=48px
├──────────────┬────────────────────────────────┬──────────────┤
│ Sidebar      │ Article                        │ Toc          │
│ w=240px      │ flex=1, max-w=780px            │ w=200px      │
│ sticky top   │ overflow-y: auto               │ sticky top   │
│              │                                │              │
│ 本栏必读 >    │ # 二叉树遍历                    │ 本页目录      │
│ 基础结构 >    │ 基于你的学习画像...导语          │ 推荐概览      │
│ 树结构 v     │ ---                            │ 图文讲解      │
│  二叉树遍历   │ ## 推荐概览                     │ 代码案例      │
│  AVL         │ ## 图文讲解                     │ 题库          │
│ 堆与图 >     │   [资源卡片]                    │ 视频          │
│              │   [资源卡片]                    │              │
└──────────────┴────────────────────────────────┴──────────────┘
```

#### 字体层级

| 层级 | 规格 | 颜色 |
|------|------|------|
| 页面标题 | `24px / 700` | `#e8e6df` |
| 文章标题 | `22px / 700` | `#e8e6df` |
| 小节标题 | `16px / 600` | `#e8e6df` |
| 正文 | `14px / 1.7` | `#e8e6df` |
| 导语/说明 | `14px / 1.6` | `#9ca0aa` |
| 导航/目录 | `13px / 1.5` | `#9ca0aa` |
| 资源卡片标题 | `14px / 600` | `#e8e6df` |
| 资源卡片标签 | `11px / 500` | 类型色 |

#### 资源卡片样式

- 深色背景卡片（`#1e1f26`），`border: 1px solid rgba(255,255,255,0.06)`
- `border-radius: 8px`，`padding: 14px 16px`
- 标题 + 类型标签（小号胶囊）在同一行
- 摘要最多 2 行，`#9ca0aa`
- 底部：难度星级 + 预计耗时 + 操作按钮（查看详情 / 删除）
- 删除按钮改为低调文字按钮，非红色大按钮

#### 响应式

| 断点 | 行为 |
|------|------|
| `>= 1280px` | 三栏全显 |
| `1024 - 1279px` | 右侧目录隐藏 |
| `768 - 1023px` | 左侧目录变窄（200px） |
| `< 768px` | 左侧目录变抽屉（汉堡菜单触发）；中间文章全宽 |

### 4.5 交互规格

1. **初始状态**：加载完成后，默认选中第一个 category 的第一个 topic
2. **顶部栏目点击**：左侧目录展开对应 category 分组，选中该 category 第一个 topic
3. **左侧目录点击知识点**：中间文章切换到该知识点内容，右侧目录更新
4. **右侧目录点击**：文章平滑滚动到对应小节（`scrollIntoView({ behavior: 'smooth' })`）
5. **滚动高亮**：右侧目录通过 `IntersectionObserver` 监听各小节，当前可见小节高亮
6. **分组展开/收起**：左侧目录默认展开第一个 category，其余收起
7. **刷新**：重新请求 `/recommendations/notebook`，保持当前选中状态
8. **删除资源**：乐观移除 + API 调用，失败时回滚
9. **生成资源**：复用现有 Modal 组件（VideoGenModal 等），完成生成后刷新数据并跳转
10. **空状态**：深色文档风格空状态，标题"暂无推荐资源" + 引导文案

### 4.6 文件清单

#### 新建文件

| 文件 | 说明 |
|------|------|
| `frontend/src/pages/ResourceNotebookPage.tsx` | 页面容器（替代旧 `RecommendationsCenterPage.tsx`） |
| `frontend/src/components/notebook/TopCategoryNav.tsx` | 顶部栏目导航 |
| `frontend/src/components/notebook/NotebookLayout.tsx` | 三栏布局容器 |
| `frontend/src/components/notebook/KnowledgeSidebar.tsx` | 左侧知识点目录 |
| `frontend/src/components/notebook/ResourceArticle.tsx` | 中间文章阅读区 |
| `frontend/src/components/notebook/ResourceTypeSection.tsx` | 文章内资源类型小节 |
| `frontend/src/components/notebook/ResourceCard.tsx` | 单个资源卡片 |
| `frontend/src/components/notebook/ArticleToc.tsx` | 右侧本页目录 |
| `frontend/src/components/notebook/ToolbarActions.tsx` | 右上角工具栏 |
| `frontend/src/components/notebook/index.ts` | 统一导出 |

#### 修改文件

| 文件 | 改动 |
|------|------|
| `app/api/endpoints/recommendations.py` | 新增 `GET /notebook` 端点 + 分类推导逻辑 |
| `frontend/src/api/recommendationsCenter.ts` | 新增 `NotebookResponse` 类型 + `getNotebook()` 方法 |
| `frontend/src/App.tsx` | 将 `/recommendations` 路由指向 `ResourceNotebookPage` |

#### 删除文件

| 文件 | 说明 |
|------|------|
| `frontend/src/pages/RecommendationsCenterPage.tsx` | 被 `ResourceNotebookPage.tsx` 替代 |

---

## 5. 保留与删除

### 必须保留

- [x] 资源推荐数据来源（`KnowledgeResource` 表）
- [x] 推荐数量统计
- [x] 刷新推荐功能
- [x] 删除/移除资源能力
- [x] 按资源类型区分资源
- [x] 按知识点组织资源
- [x] 资源生成功能（思维导图/代码案例/图文讲解/文档/视频）
- [x] 导航到资源详情页

### 需要弱化

- [x] 浅色后台管理风格 → 深色文档站风格
- [x] 大面积胶囊筛选条 → 顶部栏目导航
- [x] 单行卡片列表 → 文章内资源块
- [x] 高频红色"删除全部"按钮 → 低调文字操作

### 不做

- [x] 不新增无功能的装饰按钮
- [x] 不破坏现有接口和数据流
- [x] 不照搬"数据结构面试笔记"文字内容

---

## 6. 验收标准

- [ ] 页面第一眼是深色笔记/文档站风格（非后台管理列表）
- [ ] 顶部横向栏目导航可点击切换
- [ ] 左侧知识点目录可展开/收起，按栏目分组
- [ ] 中间文章区有标题、导语、小节、资源内容块
- [ ] 右侧本页目录可点击定位文章小节，滚动高亮
- [ ] 资源推荐、刷新、删除、资源类型区分功能正常
- [ ] 资源数据按"栏目 → 知识点 → 资源类型 → 资源"组织
- [ ] 窄屏（< 768px）布局不挤压/溢出
- [ ] 旧 `RecommendationsCenterPage.tsx` 不再被引用
- [ ] 生成资源功能在右上角工具栏可正常触发

---

## 7. 开放问题

- 无
