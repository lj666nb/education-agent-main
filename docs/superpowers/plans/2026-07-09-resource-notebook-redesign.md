# 资源推荐笔记改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将资源推荐页从浅色管理列表改造为深色三栏笔记风格文档站

**Architecture:** 后端新增 `/recommendations/notebook` 端点返回按栏目→知识点→资源类型三层组织的数据；前端拆分为 10 个独立组件，通过 `ResourceNotebookPage` 容器统一管理状态和数据流

**Tech Stack:** FastAPI + SQLAlchemy (后端), React + TypeScript + CSS (前端), 沿用现有项目框架

## Global Constraints

- 分类推导：KnowledgePoint 精确匹配 → 关键词降级 → "其他知识点"兜底
- 视觉：`#18191f` 页面背景 / `#14151a` 侧栏背景 / `#e8e6df` 正文 / `#8b8cff` 高亮
- 布局：左侧 240px / 中间 flex:1 max-w:780px / 右侧 200px
- 保留所有现有功能：刷新、删除、资源生成、类型区分、知识点分组
- 旧 RecommendationsCenterPage.tsx 不再使用
- 旧 API 端点保持不变（供其他页面继续使用）
- 所有用户提示为中文

---

## 文件结构

```
新建 (10):
  frontend/src/pages/ResourceNotebookPage.tsx          ← 页面容器
  frontend/src/components/notebook/NotebookLayout.tsx   ← 三栏布局
  frontend/src/components/notebook/TopCategoryNav.tsx   ← 顶部栏目导航
  frontend/src/components/notebook/KnowledgeSidebar.tsx ← 左侧知识点目录
  frontend/src/components/notebook/ResourceArticle.tsx  ← 中间文章区
  frontend/src/components/notebook/ResourceTypeSection.tsx ← 资源类型小节
  frontend/src/components/notebook/ResourceCard.tsx     ← 单个资源卡片
  frontend/src/components/notebook/ArticleToc.tsx       ← 右侧本页目录
  frontend/src/components/notebook/ToolbarActions.tsx   ← 右上角工具栏
  frontend/src/components/notebook/notebook.css         ← 深色主题样式
  frontend/src/components/notebook/index.ts             ← 统一导出

修改 (3):
  app/api/endpoints/recommendations.py                  ← 新增 /notebook 端点
  frontend/src/api/recommendationsCenter.ts             ← 新增 NotebookResponse 类型
  frontend/src/App.tsx                                  ← 路由指向新页面

删除 (1):
  frontend/src/pages/RecommendationsCenterPage.tsx
```

---

### Task 1: 后端 — 新增 GET /recommendations/notebook 端点

**Files:**
- Modify: `app/api/endpoints/recommendations.py`

**Interfaces:**
- Consumes: `KnowledgeResource`, `KnowledgePoint`, `KnowledgeDomain`, `KnowledgePointRecord` 模型；`get_db`, `get_current_user` 依赖
- Produces: `NotebookResponse` (Pydantic model), `GET /api/v1/recommendations/notebook` 端点

- [ ] **Step 1: 添加 Notebook 相关 Pydantic schemas**

在 `recommendations.py` 中，紧接现有 `FeedbackResponse` 类之后添加：

```python
# ── Notebook schemas ──

class NotebookResourceOut(BaseModel):
    id: str
    title: str
    resource_type: str
    resource_type_label: str
    knowledge_points: List[str]
    difficulty_level: Optional[int] = None
    source: Optional[str] = None
    source_label: Optional[str] = None
    tags: List[str] = []
    created_at: str
    mastery_score: Optional[float] = None

    class Config:
        from_attributes = True


class NotebookSection(BaseModel):
    type: str
    type_label: str
    resources: List[NotebookResourceOut]


class NotebookTopic(BaseModel):
    id: str  # anchor slug (知识点的简化标识)
    title: str
    resource_count: int
    mastery_score: Optional[float] = None
    sections: List[NotebookSection]


class NotebookCategory(BaseModel):
    id: str
    title: str
    sort_order: int
    topics: List[NotebookTopic]


class NotebookResponse(BaseModel):
    categories: List[NotebookCategory]
    total_resources: int
    total_topics: int
```

- [ ] **Step 2: 添加分类推导辅助函数**

在 `RESOURCE_TYPE_LABELS` 和 `SOURCE_LABELS` 之后添加：

```python
# ── Category derivation ──

# Keyword-based category mapping (fallback when KnowledgePoint lookup fails)
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "基础结构": ["链表", "栈", "队列", "数组", "哈希表", "串", "字符串", "线性表", "顺序表"],
    "树结构": ["二叉树", "BST", "AVL", "红黑树", "哈夫曼", "树", "B树", "B+树", "字典树", "并查集"],
    "堆与图": ["图", "BFS", "DFS", "Dijkstra", "邻接矩阵", "邻接表", "拓扑排序", "最短路径", "最小生成树", "Floyd", "Prim", "Kruskal", "关键路径"],
    "排序与查找": ["排序", "查找", "二分", "冒泡", "快排", "归并", "插入", "选择", "希尔", "堆排序", "计数排序", "基数排序"],
}

CATEGORY_ORDER: dict[str, int] = {
    "基础结构": 1,
    "树结构": 2,
    "堆与图": 3,
    "排序与查找": 4,
    "其他知识点": 99,
}


def _derive_category(
    kp_name: str,
    kp_name_to_domain: dict[str, str],  # KnowledgePoint.name → KnowledgeDomain.name
) -> str:
    """Derive the category for a knowledge point name.
    
    1. Exact match: lookup KnowledgePoint → get domain name → use as category
    2. Keyword fallback: check if kp_name contains any keyword
    3. Default: "其他知识点"
    """
    # 1. Exact match via KnowledgePoint → KnowledgeDomain
    if kp_name in kp_name_to_domain:
        return kp_name_to_domain[kp_name]
    
    # 2. Keyword fallback
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in kp_name:
                return category
    
    # 3. Default
    return "其他知识点"


def _make_anchor_id(text: str) -> str:
    """Create a URL-safe anchor ID from Chinese/English text."""
    import re
    # Keep alphanumeric and Chinese chars, replace spaces/special with underscore
    slug = re.sub(r'[^\w一-鿿]', '_', text)
    return slug.strip('_') or text
```

- [ ] **Step 3: 添加 notebook 端点路由函数**

在 `submit_feedback` 端点之后、`router` 定义之前添加：

```python
@router.get("/notebook", response_model=NotebookResponse)
async def get_notebook(
    subject_id: Optional[str] = Query(None, description="按学科筛选"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取按栏目→知识点→资源类型组织的推荐资源（笔记视图用）"""
    user_id = str(current_user.student_id)

    # 1. Build mastery maps (same logic as /personalized)
    from app.models.question_bank import KnowledgeDomain, KnowledgePoint, KnowledgePointRecord

    kp_records = (
        db.query(KnowledgePointRecord)
        .filter(KnowledgePointRecord.user_id == user_id)
        .all()
    )
    mastery_by_id: dict[str, float] = {}
    for rec in kp_records:
        mastery_by_id[str(rec.point_id)] = rec.mastery_score

    # All knowledge points
    all_kps = db.query(KnowledgePoint).all()
    kp_id_to_name: dict[str, str] = {str(k.id): k.name for k in all_kps}

    # mastery_by_name: name → score
    mastery_by_name: dict[str, float] = {}
    for k in all_kps:
        sid = str(k.id)
        if sid in mastery_by_id:
            mastery_by_name[k.name] = mastery_by_id[sid]

    # Build kp_name → domain name mapping for category derivation
    # Get all domains
    all_domains = db.query(KnowledgeDomain).all()
    domain_map: dict[str, str] = {str(d.id): d.name for d in all_domains}
    kp_name_to_domain: dict[str, str] = {}
    for k in all_kps:
        if k.domain_id:
            domain_name = domain_map.get(str(k.domain_id))
            if domain_name:
                kp_name_to_domain[k.name] = domain_name

    # 2. Query resources (same logic as /personalized)
    query = db.query(KnowledgeResource).filter(
        (KnowledgeResource.user_id == user_id) |
        (KnowledgeResource.is_public == True)
    )

    if subject_id:
        domains = (
            db.query(KnowledgeDomain)
            .filter(KnowledgeDomain.subject_id == subject_id)
            .all()
        )
        domain_ids = [str(d.id) for d in domains]
        if domain_ids:
            subject_kps = (
                db.query(KnowledgePoint)
                .filter(KnowledgePoint.domain_id.in_(domain_ids))
                .all()
            )
            subject_kp_names = {k.name for k in subject_kps}
            if subject_kp_names:
                from sqlalchemy import or_
                conditions = [KnowledgeResource.knowledge_points.op('?')(name) for name in subject_kp_names]
                query = query.filter(or_(*conditions))

    all_resources = query.order_by(desc(KnowledgeResource.updated_at)).all()

    # 3. Build notebook structure: category → topic → section → resources
    # First pass: group resources by (category, topic_name, resource_type)
    from collections import defaultdict

    # (category, topic_name) → { resource_type → [resources] }
    notebook_map: dict[tuple[str, str], dict[str, list[KnowledgeResource]]] = defaultdict(lambda: defaultdict(list))

    for r in all_resources:
        kps = list(r.knowledge_points or [])
        if not kps:
            continue
        # Use first knowledge point as primary topic
        primary_kp = kps[0]
        category = _derive_category(primary_kp, kp_name_to_domain)
        notebook_map[(category, primary_kp)][r.resource_type].append(r)

    # Second pass: build response structure
    # Group topics by category
    cat_topics: dict[str, list[tuple[str, list[NotebookSection]]]] = defaultdict(list)

    for (category, topic_name), type_map in notebook_map.items():
        sections: list[NotebookSection] = []
        # Sort resource types in a fixed order
        type_order = ["image_text", "document", "mind_map", "code_case", "exercise", "video", "video_script"]
        for rtype in type_order:
            if rtype in type_map:
                resources = type_map[rtype]
                section = NotebookSection(
                    type=rtype,
                    type_label=RESOURCE_TYPE_LABELS.get(rtype, rtype),
                    resources=[
                        NotebookResourceOut(
                            id=str(res.id),
                            title=res.title,
                            resource_type=res.resource_type,
                            resource_type_label=RESOURCE_TYPE_LABELS.get(res.resource_type, res.resource_type),
                            knowledge_points=list(res.knowledge_points or []),
                            difficulty_level=res.difficulty_level,
                            source=res.source,
                            source_label=SOURCE_LABELS.get(res.source or "", res.source or ""),
                            tags=list(res.tags or []),
                            created_at=res.created_at.isoformat() if res.created_at else "",
                            mastery_score=mastery_by_name.get(topic_name),
                        )
                        for res in resources
                    ],
                )
                sections.append(section)
        # Also include any types not in the fixed order
        for rtype, resources in type_map.items():
            if rtype not in type_order:
                section = NotebookSection(
                    type=rtype,
                    type_label=RESOURCE_TYPE_LABELS.get(rtype, rtype),
                    resources=[
                        NotebookResourceOut(
                            id=str(res.id),
                            title=res.title,
                            resource_type=res.resource_type,
                            resource_type_label=RESOURCE_TYPE_LABELS.get(res.resource_type, res.resource_type),
                            knowledge_points=list(res.knowledge_points or []),
                            difficulty_level=res.difficulty_level,
                            source=res.source,
                            source_label=SOURCE_LABELS.get(res.source or "", res.source or ""),
                            tags=list(res.tags or []),
                            created_at=res.created_at.isoformat() if res.created_at else "",
                            mastery_score=mastery_by_name.get(topic_name),
                        )
                        for res in resources
                    ],
                )
                sections.append(section)

        resource_count = sum(len(s.resources) for s in sections)
        topic = NotebookTopic(
            id=_make_anchor_id(topic_name),
            title=topic_name,
            resource_count=resource_count,
            mastery_score=mastery_by_name.get(topic_name),
            sections=sections,
        )
        cat_topics[category].append((topic_name, sections, resource_count, mastery_by_name.get(topic_name)))

    # Build categories
    categories: list[NotebookCategory] = []
    total_topics = 0
    for category_title in sorted(cat_topics.keys(), key=lambda c: CATEGORY_ORDER.get(c, 99)):
        topics_data = cat_topics[category_title]
        topics = [
            NotebookTopic(
                id=_make_anchor_id(tn),
                title=tn,
                resource_count=rc,
                mastery_score=ms,
                sections=secs,
            )
            for tn, secs, rc, ms in topics_data
        ]
        categories.append(NotebookCategory(
            id=_make_anchor_id(category_title),
            title=category_title,
            sort_order=CATEGORY_ORDER.get(category_title, 99),
            topics=topics,
        ))
        total_topics += len(topics)

    total_resources = sum(
        sum(len(s.resources) for s in t.sections)
        for c in categories
        for t in c.topics
    )

    return NotebookResponse(
        categories=categories,
        total_resources=total_resources,
        total_topics=total_topics,
    )
```

- [ ] **Step 4: 重启后端并验证端点**

```bash
docker-compose restart backend
sleep 5
curl -s http://localhost:8000/api/v1/recommendations/notebook -H "Authorization: Bearer <token>" | head -c 500
```

期望：返回 `{"categories": [...], "total_resources": ..., "total_topics": ...}`

- [ ] **Step 5: Commit**

```bash
git add app/api/endpoints/recommendations.py
git commit -m "feat: add GET /recommendations/notebook endpoint with category derivation"
```

---

### Task 2: 前端 API 层 — 新增 Notebook 类型和方法

**Files:**
- Modify: `frontend/src/api/recommendationsCenter.ts`

**Interfaces:**
- Consumes: 现有 `api` 实例
- Produces: `NotebookResource`, `NotebookSection`, `NotebookTopic`, `NotebookCategory`, `NotebookResponse` 类型；`getNotebook()` 方法

- [ ] **Step 1: 添加 Notebook 类型定义和 API 方法**

在 `recommendationsCenter.ts` 末尾添加：

```typescript
// ── Notebook types ──

export interface NotebookResource {
  id: string
  title: string
  resource_type: string
  resource_type_label: string
  knowledge_points: string[]
  difficulty_level: number | null
  source: string | null
  source_label: string | null
  tags: string[]
  created_at: string
  mastery_score: number | null
}

export interface NotebookSection {
  type: string
  type_label: string
  resources: NotebookResource[]
}

export interface NotebookTopic {
  id: string
  title: string
  resource_count: number
  mastery_score: number | null
  sections: NotebookSection[]
}

export interface NotebookCategory {
  id: string
  title: string
  sort_order: number
  topics: NotebookTopic[]
}

export interface NotebookResponse {
  categories: NotebookCategory[]
  total_resources: number
  total_topics: number
}
```

在 `recommendationsCenterApi` 对象中添加方法（在 `deleteResource` 之后）：

```typescript
export const recommendationsCenterApi = {
  getPersonalized: (params?: {
    resource_type?: string
    subject_id?: string
    page?: number
    page_size?: number
  }) =>
    api.get<PersonalizedResponse>('/recommendations/personalized', { params }),

  submitFeedback: (resourceId: string, useful: boolean) =>
    api.post<FeedbackResponse>(`/recommendations/${resourceId}/feedback`, { useful }),

  deleteResource: (resourceId: string) =>
    api.delete(`/resources/${resourceId}`),

  // 新增：获取笔记视图结构化数据
  getNotebook: (params?: { subject_id?: string }) =>
    api.get<NotebookResponse>('/recommendations/notebook', { params }),
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/recommendationsCenter.ts
git commit -m "feat: add notebook types and getNotebook API method"
```

---

### Task 3: 前端 — 深色主题样式文件

**Files:**
- Create: `frontend/src/components/notebook/notebook.css`

**Interfaces:**
- Produces: CSS class names for all notebook components

- [ ] **Step 1: 创建 notebook.css**

```css
/* ── Notebook Dark Theme ── */

:root {
  --nb-bg-page: #18191f;
  --nb-bg-sidebar: #14151a;
  --nb-bg-card: #1e1f26;
  --nb-bg-card-hover: #25262e;
  --nb-bg-input: #2a2b32;
  --nb-text-primary: #e8e6df;
  --nb-text-secondary: #9ca0aa;
  --nb-text-muted: #6b6e78;
  --nb-accent: #8b8cff;
  --nb-accent-bg: rgba(139, 140, 255, 0.10);
  --nb-accent-bg-hover: rgba(139, 140, 255, 0.16);
  --nb-border: rgba(255, 255, 255, 0.08);
  --nb-border-light: rgba(255, 255, 255, 0.05);
  --nb-danger: #f87171;
  --nb-danger-bg: rgba(248, 113, 113, 0.10);
  --nb-danger-hover: rgba(248, 113, 113, 0.18);
  --nb-success: #4ade80;
  --nb-warning: #fbbf24;
  --nb-info: #38bdf8;
  --nb-radius-sm: 6px;
  --nb-radius-md: 8px;
  --nb-radius-lg: 12px;
  --nb-shadow-card: 0 1px 3px rgba(0, 0, 0, 0.3);
  --nb-transition: 0.15s ease;
}

/* ── Layout ── */

.nb-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--nb-bg-page);
  color: var(--nb-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}

.nb-layout {
  display: grid;
  grid-template-columns: 240px 1fr 200px;
  flex: 1;
  overflow: hidden;
}

@media (max-width: 1279px) {
  .nb-layout {
    grid-template-columns: 200px 1fr;
  }
}

@media (max-width: 767px) {
  .nb-layout {
    grid-template-columns: 1fr;
  }
}

/* ── Top Navigation ── */

.nb-topnav {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 48px;
  padding: 0 16px;
  background: var(--nb-bg-sidebar);
  border-bottom: 1px solid var(--nb-border);
  flex-shrink: 0;
  overflow-x: auto;
}

.nb-topnav::-webkit-scrollbar {
  height: 0;
}

.nb-topnav-item {
  padding: 6px 16px;
  border: none;
  border-radius: var(--nb-radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--nb-text-secondary);
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--nb-transition);
}

.nb-topnav-item:hover {
  color: var(--nb-text-primary);
  background: var(--nb-accent-bg);
}

.nb-topnav-item--active {
  color: var(--nb-accent);
  background: var(--nb-accent-bg);
}

.nb-topnav-spacer {
  flex: 1;
}

.nb-topnav-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

/* ── Left Sidebar ── */

.nb-sidebar {
  background: var(--nb-bg-sidebar);
  border-right: 1px solid var(--nb-border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.nb-sidebar::-webkit-scrollbar {
  width: 4px;
}

.nb-sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.nb-sidebar-header {
  padding: 16px 16px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--nb-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nb-sidebar-group {
  border-bottom: 1px solid var(--nb-border-light);
}

.nb-sidebar-group:last-child {
  border-bottom: none;
}

.nb-sidebar-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--nb-text-muted);
  cursor: pointer;
  user-select: none;
  transition: color var(--nb-transition);
}

.nb-sidebar-group-header:hover {
  color: var(--nb-text-secondary);
}

.nb-sidebar-group-chevron {
  font-size: 8px;
  transition: transform var(--nb-transition);
  flex-shrink: 0;
}

.nb-sidebar-group-chevron--open {
  transform: rotate(90deg);
}

.nb-sidebar-topic {
  display: block;
  width: 100%;
  padding: 7px 16px 7px 32px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--nb-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: all var(--nb-transition);
  border-left: 2px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nb-sidebar-topic:hover {
  color: var(--nb-text-primary);
  background: var(--nb-accent-bg);
}

.nb-sidebar-topic--active {
  color: var(--nb-accent);
  background: var(--nb-accent-bg);
  border-left-color: var(--nb-accent);
}

.nb-sidebar-topic-count {
  font-size: 11px;
  color: var(--nb-text-muted);
  margin-left: 6px;
}

/* ── Article Area ── */

.nb-article {
  flex: 1;
  overflow-y: auto;
  padding: 32px 40px;
  max-width: 780px;
  margin: 0 auto;
  width: 100%;
}

.nb-article::-webkit-scrollbar {
  width: 4px;
}

.nb-article::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.nb-article-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--nb-text-primary);
  margin: 0 0 8px;
  line-height: 1.3;
}

.nb-article-subtitle {
  font-size: 14px;
  color: var(--nb-text-secondary);
  line-height: 1.7;
  margin: 0 0 24px;
}

.nb-article-divider {
  border: none;
  border-top: 1px solid var(--nb-border);
  margin: 24px 0;
}

.nb-article-section {
  margin-bottom: 32px;
}

.nb-article-section:last-child {
  margin-bottom: 0;
}

.nb-article-section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--nb-text-primary);
  margin: 0 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--nb-border-light);
}

/* ── Overview block ── */

.nb-overview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 24px;
}

.nb-overview-item {
  padding: 12px 14px;
  background: var(--nb-bg-card);
  border: 1px solid var(--nb-border);
  border-radius: var(--nb-radius-md);
}

.nb-overview-item-label {
  font-size: 11px;
  color: var(--nb-text-muted);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.nb-overview-item-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--nb-text-primary);
}

/* ── Resource Card ── */

.nb-resource-card {
  padding: 14px 16px;
  background: var(--nb-bg-card);
  border: 1px solid var(--nb-border);
  border-radius: var(--nb-radius-md);
  margin-bottom: 8px;
  transition: border-color var(--nb-transition), background var(--nb-transition);
}

.nb-resource-card:last-child {
  margin-bottom: 0;
}

.nb-resource-card:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: var(--nb-bg-card-hover);
}

.nb-resource-card-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}

.nb-resource-card-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--nb-text-primary);
  cursor: pointer;
  transition: color var(--nb-transition);
  line-height: 1.4;
}

.nb-resource-card-title:hover {
  color: var(--nb-accent);
}

.nb-resource-card-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.nb-resource-card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--nb-text-muted);
  margin-bottom: 4px;
}

.nb-resource-card-desc {
  font-size: 13px;
  color: var(--nb-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.nb-resource-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--nb-border-light);
}

.nb-resource-card-action-btn {
  padding: 4px 10px;
  border: none;
  border-radius: var(--nb-radius-sm);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--nb-transition);
  background: transparent;
  color: var(--nb-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.nb-resource-card-action-btn:hover {
  background: var(--nb-accent-bg);
  color: var(--nb-text-primary);
}

.nb-resource-card-action-btn--danger:hover {
  background: var(--nb-danger-bg);
  color: var(--nb-danger);
}

/* ── Right TOC ── */

.nb-toc {
  background: var(--nb-bg-sidebar);
  border-left: 1px solid var(--nb-border);
  overflow-y: auto;
  padding: 16px;
  position: sticky;
  top: 0;
  height: 100%;
}

@media (max-width: 1279px) {
  .nb-toc {
    display: none;
  }
}

.nb-toc::-webkit-scrollbar {
  width: 4px;
}

.nb-toc::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.nb-toc-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--nb-text-muted);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nb-toc-item {
  display: block;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--nb-text-secondary);
  text-align: left;
  cursor: pointer;
  border-radius: var(--nb-radius-sm);
  transition: all var(--nb-transition);
  border-left: 2px solid transparent;
}

.nb-toc-item:hover {
  color: var(--nb-text-primary);
  background: var(--nb-accent-bg);
}

.nb-toc-item--active {
  color: var(--nb-accent);
  border-left-color: var(--nb-accent);
  background: var(--nb-accent-bg);
}

/* ── Toolbar Actions ── */

.nb-toolbar-btn {
  padding: 5px 10px;
  border: 1px solid var(--nb-border);
  border-radius: var(--nb-radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: var(--nb-text-secondary);
  transition: all var(--nb-transition);
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.nb-toolbar-btn:hover {
  background: var(--nb-accent-bg);
  color: var(--nb-text-primary);
  border-color: rgba(255, 255, 255, 0.14);
}

.nb-toolbar-btn--primary {
  background: var(--nb-accent);
  color: #fff;
  border-color: var(--nb-accent);
}

.nb-toolbar-btn--primary:hover {
  background: #7a7bee;
  color: #fff;
}

.nb-toolbar-dropdown {
  position: relative;
}

.nb-toolbar-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 160px;
  background: var(--nb-bg-card);
  border: 1px solid var(--nb-border);
  border-radius: var(--nb-radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
  overflow: hidden;
}

.nb-toolbar-dropdown-item {
  display: block;
  width: 100%;
  padding: 9px 14px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--nb-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: all var(--nb-transition);
}

.nb-toolbar-dropdown-item:hover {
  background: var(--nb-accent-bg);
  color: var(--nb-text-primary);
}

/* ── Empty State ── */

.nb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.nb-empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.4;
}

.nb-empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--nb-text-primary);
  margin-bottom: 8px;
}

.nb-empty-desc {
  font-size: 14px;
  color: var(--nb-text-secondary);
  line-height: 1.6;
  max-width: 400px;
  margin-bottom: 24px;
}

.nb-empty-btn {
  padding: 9px 20px;
  border: 1px solid var(--nb-border);
  border-radius: var(--nb-radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: var(--nb-text-primary);
  transition: all var(--nb-transition);
}

.nb-empty-btn:hover {
  background: var(--nb-accent-bg);
  border-color: var(--nb-accent);
  color: var(--nb-accent);
}

/* ── Loading ── */

.nb-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--nb-text-muted);
  font-size: 14px;
}

/* ── Error ── */

.nb-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  color: var(--nb-danger);
}

.nb-error-msg {
  font-size: 14px;
  margin: 12px 0;
}

.nb-error-btn {
  padding: 8px 20px;
  border: none;
  border-radius: var(--nb-radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: var(--nb-accent);
  color: #fff;
}

/* ── Sidebar mobile drawer ── */

@media (max-width: 767px) {
  .nb-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 200;
    width: 280px;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
  }

  .nb-sidebar--open {
    transform: translateX(0);
  }

  .nb-sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 199;
  }

  .nb-mobile-menu-btn {
    display: flex !important;
  }
}

.nb-mobile-menu-btn {
  display: none;
  padding: 5px 8px;
  border: 1px solid var(--nb-border);
  border-radius: var(--nb-radius-sm);
  background: transparent;
  color: var(--nb-text-secondary);
  cursor: pointer;
  font-size: 16px;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/notebook/notebook.css
git commit -m "feat: add notebook dark theme CSS"
```

---

### Task 4: 前端 — ResourceCard 组件

**Files:**
- Create: `frontend/src/components/notebook/ResourceCard.tsx`

**Interfaces:**
- Consumes: `NotebookResource` from `../../api/recommendationsCenter`
- Produces: `<ResourceCard>` component, props: `{ resource, onDelete, onNavigate }`

- [ ] **Step 1: 创建 ResourceCard.tsx**

```tsx
import React from 'react'
import type { NotebookResource } from '../../api/recommendationsCenter'
import { RESOURCE_TYPE_CONFIG } from '../../api/recommendationsCenter'
import './notebook.css'

interface ResourceCardProps {
  resource: NotebookResource
  onViewDetail: (id: string) => void
  onDelete: (id: string) => void
  deleting: boolean
}

export default function ResourceCard({ resource, onViewDetail, onDelete, deleting }: ResourceCardProps) {
  const typeCfg = RESOURCE_TYPE_CONFIG[resource.resource_type]
  const badgeColor = typeCfg?.color || '#8b8cff'
  const badgeBg = typeCfg?.bg || 'rgba(139,140,255,0.12)'
  const typeLabel = resource.resource_type_label || resource.resource_type

  // Difficulty stars
  const stars = resource.difficulty_level
    ? '⭐'.repeat(resource.difficulty_level) + '☆'.repeat(5 - resource.difficulty_level)
    : null

  return (
    <div className="nb-resource-card">
      <div className="nb-resource-card-header">
        <span
          className="nb-resource-card-title"
          onClick={() => onViewDetail(resource.id)}
          title={resource.title}
        >
          {resource.title}
        </span>
        <span
          className="nb-resource-card-badge"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {typeLabel}
        </span>
      </div>

      {(resource.tags.length > 0 || stars) && (
        <div className="nb-resource-card-meta">
          {stars && <span>{stars}</span>}
          {resource.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', fontSize: 11 }}>
              {tag}
            </span>
          ))}
          {resource.source_label && (
            <span>来源: {resource.source_label}</span>
          )}
        </div>
      )}

      <div className="nb-resource-card-actions">
        <button className="nb-resource-card-action-btn" onClick={() => onViewDetail(resource.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          查看详情
        </button>
        <button
          className="nb-resource-card-action-btn nb-resource-card-action-btn--danger"
          onClick={() => onDelete(resource.id)}
          disabled={deleting}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          {deleting ? '删除中...' : '移除'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/notebook/ResourceCard.tsx
git commit -m "feat: add ResourceCard component"
```

---

### Task 5: 前端 — ResourceTypeSection 组件

**Files:**
- Create: `frontend/src/components/notebook/ResourceTypeSection.tsx`

**Interfaces:**
- Consumes: `NotebookSection` from `../../api/recommendationsCenter`; `ResourceCard`
- Produces: `<ResourceTypeSection>` component, props: `{ section, sectionId, onViewDetail, onDelete, deletingId }`

- [ ] **Step 1: 创建 ResourceTypeSection.tsx**

```tsx
import React from 'react'
import type { NotebookSection } from '../../api/recommendationsCenter'
import ResourceCard from './ResourceCard'
import './notebook.css'

interface ResourceTypeSectionProps {
  section: NotebookSection
  sectionId: string
  onViewDetail: (id: string) => void
  onDelete: (id: string) => void
  deletingId: string | null
}

export default function ResourceTypeSection({
  section,
  sectionId,
  onViewDetail,
  onDelete,
  deletingId,
}: ResourceTypeSectionProps) {
  if (section.resources.length === 0) return null

  return (
    <div className="nb-article-section" id={sectionId}>
      <h3 className="nb-article-section-title">
        {section.type_label}
        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--nb-text-muted)' }}>
          ({section.resources.length})
        </span>
      </h3>
      {section.resources.map(r => (
        <ResourceCard
          key={r.id}
          resource={r}
          onViewDetail={onViewDetail}
          onDelete={onDelete}
          deleting={deletingId === r.id}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/notebook/ResourceTypeSection.tsx
git commit -m "feat: add ResourceTypeSection component"
```

---

### Task 6: 前端 — ResourceArticle 组件

**Files:**
- Create: `frontend/src/components/notebook/ResourceArticle.tsx`

**Interfaces:**
- Consumes: `NotebookTopic`; `ResourceTypeSection`
- Produces: `<ResourceArticle>` component, props: `{ topic, onViewDetail, onDelete, deletingId }`

- [ ] **Step 1: 创建 ResourceArticle.tsx**

```tsx
import React from 'react'
import type { NotebookTopic } from '../../api/recommendationsCenter'
import ResourceTypeSection from './ResourceTypeSection'
import { RESOURCE_TYPE_CONFIG } from '../../api/recommendationsCenter'
import './notebook.css'

interface ResourceArticleProps {
  topic: NotebookTopic | null
  onViewDetail: (id: string) => void
  onDelete: (id: string) => void
  deletingId: string | null
}

export default function ResourceArticle({ topic, onViewDetail, onDelete, deletingId }: ResourceArticleProps) {
  if (!topic) {
    return (
      <div className="nb-article" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="nb-empty">
          <div className="nb-empty-icon">📖</div>
          <div className="nb-empty-title">选择一个知识点</div>
          <div className="nb-empty-desc">从左侧目录中选择一个知识点，查看系统为你整理的学习资源。</div>
        </div>
      </div>
    )
  }

  const totalResources = topic.sections.reduce((sum, s) => sum + s.resources.length, 0)

  // Build type summary for subtitle
  const typeLabels = topic.sections
    .filter(s => s.resources.length > 0)
    .map(s => s.type_label)

  // Build recommended order
  const orderedTypes = topic.sections
    .filter(s => s.resources.length > 0)
    .map(s => s.type_label)
  const suggestedOrder = orderedTypes.length > 0
    ? orderedTypes.join(' → ')
    : '暂无'

  return (
    <div className="nb-article">
      {/* Title */}
      <h1 className="nb-article-title">{topic.title}</h1>

      {/* Subtitle / guide */}
      <p className="nb-article-subtitle">
        系统为「{topic.title}」整理了 {totalResources} 个学习资源。
        {orderedTypes.length > 0 && (
          <>建议按顺序学习：{suggestedOrder}。</>
        )}
      </p>

      <hr className="nb-article-divider" />

      {/* Overview section */}
      <div className="nb-article-section" id="section-overview">
        <h3 className="nb-article-section-title">📊 推荐概览</h3>
        <div className="nb-overview">
          <div className="nb-overview-item">
            <div className="nb-overview-item-label">推荐数量</div>
            <div className="nb-overview-item-value">{totalResources}</div>
          </div>
          <div className="nb-overview-item">
            <div className="nb-overview-item-label">资源类型</div>
            <div className="nb-overview-item-value">{typeLabels.length} 种</div>
          </div>
          {topic.mastery_score != null && (
            <div className="nb-overview-item">
              <div className="nb-overview-item-label">当前掌握度</div>
              <div className="nb-overview-item-value">
                {Math.round(topic.mastery_score)}%
              </div>
            </div>
          )}
          <div className="nb-overview-item">
            <div className="nb-overview-item-label">建议顺序</div>
            <div className="nb-overview-item-value" style={{ fontSize: 12 }}>
              {suggestedOrder}
            </div>
          </div>
        </div>
      </div>

      {/* Resource type sections */}
      {topic.sections.map(section => (
        <ResourceTypeSection
          key={section.type}
          section={section}
          sectionId={`section-${section.type}`}
          onViewDetail={onViewDetail}
          onDelete={onDelete}
          deletingId={deletingId}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/notebook/ResourceArticle.tsx
git commit -m "feat: add ResourceArticle component"
```

---

### Task 7: 前端 — KnowledgeSidebar 组件

**Files:**
- Create: `frontend/src/components/notebook/KnowledgeSidebar.tsx`

**Interfaces:**
- Consumes: `NotebookCategory`, `NotebookTopic` from API types
- Produces: `<KnowledgeSidebar>`, props: `{ categories, selectedTopicId, expandedGroups, onSelectTopic, onToggleGroup }`

- [ ] **Step 1: 创建 KnowledgeSidebar.tsx**

```tsx
import React from 'react'
import type { NotebookCategory, NotebookTopic } from '../../api/recommendationsCenter'
import './notebook.css'

interface KnowledgeSidebarProps {
  categories: NotebookCategory[]
  selectedTopicId: string | null
  expandedGroups: Set<string>
  onSelectTopic: (categoryId: string, topic: NotebookTopic) => void
  onToggleGroup: (categoryId: string) => void
  isOpen?: boolean
  onClose?: () => void
}

export default function KnowledgeSidebar({
  categories,
  selectedTopicId,
  expandedGroups,
  onSelectTopic,
  onToggleGroup,
  isOpen,
  onClose,
}: KnowledgeSidebarProps) {
  const inner = (
    <>
      <div className="nb-sidebar-header">个性化资源笔记</div>
      {categories.map(cat => {
        const isExpanded = expandedGroups.has(cat.id)
        return (
          <div key={cat.id} className="nb-sidebar-group">
            <div
              className="nb-sidebar-group-header"
              onClick={() => onToggleGroup(cat.id)}
            >
              <span className={`nb-sidebar-group-chevron${isExpanded ? ' nb-sidebar-group-chevron--open' : ''}`}>
                ▶
              </span>
              {cat.title}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--nb-text-muted)' }}>
                {cat.topics.length}
              </span>
            </div>
            {isExpanded && cat.topics.map(topic => (
              <button
                key={topic.id}
                className={`nb-sidebar-topic${selectedTopicId === topic.id ? ' nb-sidebar-topic--active' : ''}`}
                onClick={() => onSelectTopic(cat.id, topic)}
              >
                {topic.title}
                <span className="nb-sidebar-topic-count">
                  {topic.resource_count}个资源
                </span>
              </button>
            ))}
          </div>
        )
      })}
    </>
  )

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="nb-sidebar-overlay" onClick={onClose} />}
      <aside className={`nb-sidebar${isOpen ? ' nb-sidebar--open' : ''}`}>
        {inner}
      </aside>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/notebook/KnowledgeSidebar.tsx
git commit -m "feat: add KnowledgeSidebar component"
```

---

### Task 8: 前端 — ArticleToc 组件

**Files:**
- Create: `frontend/src/components/notebook/ArticleToc.tsx`

**Interfaces:**
- Consumes: `NotebookTopic` from API types
- Produces: `<ArticleToc>`, props: `{ topic, activeSectionId }`

- [ ] **Step 1: 创建 ArticleToc.tsx**

```tsx
import React, { useEffect, useState, useCallback } from 'react'
import type { NotebookTopic } from '../../api/recommendationsCenter'
import './notebook.css'

interface ArticleTocProps {
  topic: NotebookTopic | null
}

export default function ArticleToc({ topic }: ArticleTocProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  // IntersectionObserver: track which section is in view
  useEffect(() => {
    if (!topic) return

    const sectionIds = [
      'section-overview',
      ...topic.sections.map(s => `section-${s.type}`),
    ]

    const observers: IntersectionObserver[] = []

    // Use a map to track which sections are intersecting
    const visibleSections = new Map<string, boolean>()

    const handleIntersect = (id: string) => (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        visibleSections.set(id, entry.isIntersecting)
      })
      // Find the first visible section (topmost)
      for (const sid of sectionIds) {
        if (visibleSections.get(sid)) {
          setActiveId(sid)
          return
        }
      }
    }

    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (el) {
        const observer = new IntersectionObserver(handleIntersect(id), {
          rootMargin: '-80px 0px -60% 0px',
          threshold: 0,
        })
        observer.observe(el)
        observers.push(observer)
      }
    })

    return () => observers.forEach(o => o.disconnect())
  }, [topic])

  const handleClick = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  if (!topic) return null

  const sections = topic.sections.filter(s => s.resources.length > 0)

  return (
    <aside className="nb-toc">
      <div className="nb-toc-title">本页目录</div>
      <button
        className={`nb-toc-item${activeId === 'section-overview' ? ' nb-toc-item--active' : ''}`}
        onClick={() => handleClick('section-overview')}
      >
        推荐概览
      </button>
      {sections.map(s => (
        <button
          key={s.type}
          className={`nb-toc-item${activeId === `section-${s.type}` ? ' nb-toc-item--active' : ''}`}
          onClick={() => handleClick(`section-${s.type}`)}
        >
          {s.type_label}
          <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.6 }}>
            ({s.resources.length})
          </span>
        </button>
      ))}
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/notebook/ArticleToc.tsx
git commit -m "feat: add ArticleToc component with IntersectionObserver"
```

---

### Task 9: 前端 — TopCategoryNav + ToolbarActions 组件

**Files:**
- Create: `frontend/src/components/notebook/TopCategoryNav.tsx`
- Create: `frontend/src/components/notebook/ToolbarActions.tsx`

**Interfaces:**
- Consumes: `NotebookCategory`; generation modal state from parent
- Produces: `<TopCategoryNav>`, `<ToolbarActions>`

- [ ] **Step 1: 创建 TopCategoryNav.tsx**

```tsx
import React from 'react'
import type { NotebookCategory } from '../../api/recommendationsCenter'
import './notebook.css'

interface TopCategoryNavProps {
  categories: NotebookCategory[]
  selectedCategoryId: string | null
  onSelectCategory: (categoryId: string) => void
  onMobileMenuToggle: () => void
  children?: React.ReactNode
}

export default function TopCategoryNav({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onMobileMenuToggle,
  children,
}: TopCategoryNavProps) {
  return (
    <nav className="nb-topnav">
      <button className="nb-mobile-menu-btn" onClick={onMobileMenuToggle} title="目录">
        ☰
      </button>

      <button
        className={`nb-topnav-item${selectedCategoryId === '__all__' ? ' nb-topnav-item--active' : ''}`}
        onClick={() => onSelectCategory('__all__')}
      >
        首页
      </button>

      {categories.map(cat => (
        <button
          key={cat.id}
          className={`nb-topnav-item${selectedCategoryId === cat.id ? ' nb-topnav-item--active' : ''}`}
          onClick={() => onSelectCategory(cat.id)}
        >
          {cat.title}
        </button>
      ))}

      <div className="nb-topnav-spacer" />
      <div className="nb-topnav-actions">
        {children}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: 创建 ToolbarActions.tsx**

```tsx
import React, { useState, useRef, useEffect } from 'react'
import './notebook.css'

interface ToolbarActionsProps {
  onRefresh: () => void
  loading: boolean
  onGenerateVideo: () => void
  onGenerateMindmap: () => void
  onGenerateCodeCase: () => void
  onGenerateDocument: () => void
  onGenerateImageText: () => void
}

export default function ToolbarActions({
  onRefresh,
  loading,
  onGenerateVideo,
  onGenerateMindmap,
  onGenerateCodeCase,
  onGenerateDocument,
  onGenerateImageText,
}: ToolbarActionsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const handleGen = (fn: () => void) => {
    setDropdownOpen(false)
    fn()
  }

  return (
    <>
      {/* Refresh button */}
      <button className="nb-toolbar-btn" onClick={onRefresh} disabled={loading} title="刷新推荐">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        {loading ? '刷新中...' : '刷新'}
      </button>

      {/* Generate dropdown */}
      <div className="nb-toolbar-dropdown" ref={dropdownRef}>
        <button
          className="nb-toolbar-btn nb-toolbar-btn--primary"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          生成资源
        </button>

        {dropdownOpen && (
          <div className="nb-toolbar-dropdown-menu">
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateMindmap)}>
              🧠 生成思维导图
            </button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateCodeCase)}>
              💻 生成代码案例
            </button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateImageText)}>
              🖼️ 生成图文讲解
            </button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateDocument)}>
              📄 生成文档
            </button>
            <button className="nb-toolbar-dropdown-item" onClick={() => handleGen(onGenerateVideo)}>
              🎬 生成视频讲解
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/notebook/TopCategoryNav.tsx frontend/src/components/notebook/ToolbarActions.tsx
git commit -m "feat: add TopCategoryNav and ToolbarActions components"
```

---

### Task 10: 前端 — NotebookLayout 布局组件 + index.ts 导出

**Files:**
- Create: `frontend/src/components/notebook/NotebookLayout.tsx`
- Create: `frontend/src/components/notebook/index.ts`

**Interfaces:**
- Produces: `<NotebookLayout>` 三栏布局容器；统一导出入口

- [ ] **Step 1: 创建 NotebookLayout.tsx**

```tsx
import React from 'react'
import './notebook.css'

interface NotebookLayoutProps {
  sidebar: React.ReactNode
  article: React.ReactNode
  toc: React.ReactNode
}

export default function NotebookLayout({ sidebar, article, toc }: NotebookLayoutProps) {
  return (
    <div className="nb-layout">
      {sidebar}
      {article}
      {toc}
    </div>
  )
}
```

- [ ] **Step 2: 创建 index.ts**

```tsx
export { default as NotebookLayout } from './NotebookLayout'
export { default as TopCategoryNav } from './TopCategoryNav'
export { default as ToolbarActions } from './ToolbarActions'
export { default as KnowledgeSidebar } from './KnowledgeSidebar'
export { default as ResourceArticle } from './ResourceArticle'
export { default as ResourceTypeSection } from './ResourceTypeSection'
export { default as ResourceCard } from './ResourceCard'
export { default as ArticleToc } from './ArticleToc'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/notebook/NotebookLayout.tsx frontend/src/components/notebook/index.ts
git commit -m "feat: add NotebookLayout and barrel export"
```

---

### Task 11: 前端 — ResourceNotebookPage 页面容器

**Files:**
- Create: `frontend/src/pages/ResourceNotebookPage.tsx`

**Interfaces:**
- Consumes: All notebook components, `recommendationsCenterApi`, `resourcesApi`, `VideoGenModal`, `useNavigate`
- Produces: `<ResourceNotebookPage>` (default export)

- [ ] **Step 1: 创建 ResourceNotebookPage.tsx**

```tsx
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  recommendationsCenterApi,
  type NotebookResponse,
  type NotebookCategory,
  type NotebookTopic,
} from '../api/recommendationsCenter'
import { resourcesApi } from '../api/resources'
import VideoGenModal from '../components/VideoGenModal'
import {
  NotebookLayout,
  TopCategoryNav,
  ToolbarActions,
  KnowledgeSidebar,
  ResourceArticle,
  ArticleToc,
} from '../components/notebook'
import '../components/notebook/notebook.css'

export default function ResourceNotebookPage() {
  const navigate = useNavigate()

  // ── Data state ──
  const [data, setData] = useState<NotebookResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Selection state ──
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<NotebookTopic | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // ── Delete state ──
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Mobile sidebar ──
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // ── Generate modals ──
  const [videoGenModal, setVideoGenModal] = useState(false)
  const [mindmapModal, setMindmapModal] = useState(false)
  const [codeGenModal, setCodeGenModal] = useState(false)
  const [documentGenModal, setDocumentGenModal] = useState(false)
  const [imageTextGenModal, setImageTextGenModal] = useState(false)
  const [genKps, setGenKps] = useState('')
  const [genTitle, setGenTitle] = useState('')
  const [generating, setGenerating] = useState(false)

  // ── Load data ──
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await recommendationsCenterApi.getNotebook()
      setData(res.data)

      // Auto-select first category and first topic
      const cats = res.data.categories
      if (cats.length > 0) {
        const firstCat = cats[0]
        setSelectedCategoryId(firstCat.id)
        setExpandedGroups(prev => {
          const next = new Set(prev)
          next.add(firstCat.id)
          return next
        })
        if (firstCat.topics.length > 0) {
          setSelectedTopic(firstCat.topics[0])
        }
      }
    } catch (err: any) {
      console.error('加载推荐笔记失败', err)
      setError(err.response?.data?.detail || '加载推荐资源失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Handlers ──
  const handleSelectCategory = useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.add(categoryId)
      return next
    })
    // Select first topic in this category
    if (data) {
      const cat = data.categories.find(c => c.id === categoryId)
      if (cat && cat.topics.length > 0) {
        setSelectedTopic(cat.topics[0])
      }
    }
    setMobileSidebarOpen(false)
  }, [data])

  const handleSelectTopic = useCallback((_categoryId: string, topic: NotebookTopic) => {
    setSelectedTopic(topic)
    setMobileSidebarOpen(false)
  }, [])

  const handleToggleGroup = useCallback((categoryId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  const handleViewDetail = useCallback((id: string) => {
    navigate(`/resources/${id}`)
  }, [navigate])

  const handleDelete = useCallback(async (resourceId: string) => {
    setDeletingId(resourceId)
    try {
      await recommendationsCenterApi.deleteResource(resourceId)
      // Reload data after delete
      await loadData()
    } catch (err: any) {
      console.error('删除失败', err)
      alert('删除失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setDeletingId(null)
    }
  }, [loadData])

  // ── Generate handlers (reuse existing modal patterns) ──
  const executeGenerate = useCallback(async (resourceType?: string) => {
    const kpList = genKps.split(/[,，、\n]/).map(s => s.trim()).filter(Boolean)
    if (kpList.length === 0) return
    setGenerating(true)
    try {
      const res = await resourcesApi.generate({
        knowledge_points: kpList,
        title: genTitle || undefined,
        resource_type: resourceType as any,
      })
      if (res.data.id) {
        // Close all modals
        setMindmapModal(false)
        setCodeGenModal(false)
        setImageTextGenModal(false)
        setDocumentGenModal(false)
        setGenKps('')
        setGenTitle('')
        await loadData()
        navigate(`/resources/${res.data.id}`)
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || '生成失败，请检查 API 配置')
    } finally {
      setGenerating(false)
    }
  }, [genKps, genTitle, loadData, navigate])

  // ── Gen modal component ──
  const renderGenModal = (title: string, color: string, onConfirm: () => void, onClose: () => void) => (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 2000,
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        backgroundColor: '#1e1f26', borderRadius: 12, padding: 24,
        width: '90%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
        color: '#e8e6df',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{title}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: '#9ca0aa', marginBottom: 4, display: 'block' }}>
              知识点名称
            </label>
            <textarea
              value={genKps} onChange={e => setGenKps(e.target.value)}
              placeholder="输入知识点名称，多个用逗号隔开"
              rows={3}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, fontSize: 14, outline: 'none',
                resize: 'vertical', fontFamily: 'inherit',
                background: '#2a2b32', color: '#e8e6df',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#9ca0aa', marginBottom: 4, display: 'block' }}>
              标题（可选）
            </label>
            <input
              type="text" value={genTitle} onChange={e => setGenTitle(e.target.value)}
              placeholder="如：二叉树遍历详解"
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, fontSize: 14, outline: 'none',
                background: '#2a2b32', color: '#e8e6df',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} disabled={generating}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#9ca0aa', fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              取消
            </button>
            <button onClick={onConfirm} disabled={generating}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: generating ? '#555' : color, color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: generating ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}>
              {generating ? '生成中...' : '开始生成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Render ──
  const categories = data?.categories || []

  return (
    <div className="nb-page">
      {/* Top Navigation */}
      <TopCategoryNav
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      >
        <ToolbarActions
          onRefresh={loadData}
          loading={loading}
          onGenerateVideo={() => setVideoGenModal(true)}
          onGenerateMindmap={() => setMindmapModal(true)}
          onGenerateCodeCase={() => setCodeGenModal(true)}
          onGenerateDocument={() => setDocumentGenModal(true)}
          onGenerateImageText={() => setImageTextGenModal(true)}
        />
      </TopCategoryNav>

      {/* Three-column layout */}
      {loading && (
        <div className="nb-loading">加载推荐资源...</div>
      )}

      {!loading && error && (
        <div className="nb-error">
          <p className="nb-error-msg">{error}</p>
          <button className="nb-error-btn" onClick={loadData}>重试</button>
        </div>
      )}

      {!loading && !error && data && data.categories.length === 0 && (
        <div className="nb-empty" style={{ flex: 1 }}>
          <div className="nb-empty-icon">📖</div>
          <div className="nb-empty-title">暂无推荐资源</div>
          <div className="nb-empty-desc">
            当前还没有生成推荐资源。你可以刷新学习画像，或通过 AI 对话、练习答题来积累学习数据。
          </div>
          <button className="nb-empty-btn" onClick={loadData}>刷新推荐</button>
        </div>
      )}

      {!loading && !error && data && data.categories.length > 0 && (
        <NotebookLayout
          sidebar={
            <KnowledgeSidebar
              categories={categories}
              selectedTopicId={selectedTopic?.id || null}
              expandedGroups={expandedGroups}
              onSelectTopic={handleSelectTopic}
              onToggleGroup={handleToggleGroup}
              isOpen={mobileSidebarOpen}
              onClose={() => setMobileSidebarOpen(false)}
            />
          }
          article={
            <ResourceArticle
              topic={selectedTopic}
              onViewDetail={handleViewDetail}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          }
          toc={
            <ArticleToc topic={selectedTopic} />
          }
        />
      )}

      {/* Generation Modals */}
      {videoGenModal && (
        <VideoGenModal
          onClose={() => setVideoGenModal(false)}
          onDone={(resourceId: string) => {
            setVideoGenModal(false)
            loadData()
            navigate(`/resources/${resourceId}`)
          }}
        />
      )}

      {mindmapModal && renderGenModal('生成思维导图', '#1677E8', () => executeGenerate('mind_map'), () => setMindmapModal(false))}
      {codeGenModal && renderGenModal('生成代码案例', '#F59E0B', () => executeGenerate('code_case'), () => setCodeGenModal(false))}
      {imageTextGenModal && renderGenModal('生成图文讲解', '#0EA5E9', () => executeGenerate('image_text'), () => setImageTextGenModal(false))}
      {documentGenModal && renderGenModal('生成文档', '#3B82F6', () => executeGenerate('document'), () => setDocumentGenModal(false))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/ResourceNotebookPage.tsx
git commit -m "feat: add ResourceNotebookPage container component"
```

---

### Task 12: 集成 — 路由切换 + 清理旧代码

**Files:**
- Modify: `frontend/src/App.tsx` (line 36-37, 136)
- Delete: `frontend/src/pages/RecommendationsCenterPage.tsx`

**Interfaces:**
- Consumes: 现有路由结构
- Produces: `/recommendations` 指向新页面，旧文件删除

- [ ] **Step 1: 更新 App.tsx 路由**

将第 36 行：
```tsx
const RecommendationsCenterPage = lazy(() => import('./pages/RecommendationsCenterPage'))
```
改为：
```tsx
const ResourceNotebookPage = lazy(() => import('./pages/ResourceNotebookPage'))
```

将第 136 行：
```tsx
<Route path="recommendations" element={<ProtectedRoute><LazyRoute><RecommendationsCenterPage /></LazyRoute></ProtectedRoute>} />
```
改为：
```tsx
<Route path="recommendations" element={<ProtectedRoute><LazyRoute><ResourceNotebookPage /></LazyRoute></ProtectedRoute>} />
```

- [ ] **Step 2: 删除旧文件**

```bash
rm frontend/src/pages/RecommendationsCenterPage.tsx
```

验证无其他文件引用旧组件：
```bash
grep -r "RecommendationsCenterPage" frontend/src --include="*.ts" --include="*.tsx"
```
期望：无输出

- [ ] **Step 3: 重启前端并验证**

```bash
docker-compose restart frontend
sleep 8
curl -s http://localhost:3000 | head -c 200
```
期望：返回正常 HTML

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git rm frontend/src/pages/RecommendationsCenterPage.tsx
git commit -m "feat: switch /recommendations to ResourceNotebookPage, remove old page"
```

---

### Task 13: 验证 — E2E 测试

**Files:**
- 无新建文件

**Interfaces:**
- 与 Playwright 浏览器交互

- [ ] **Step 1: 检查服务状态**

```bash
docker-compose ps
curl -s http://localhost:3000 -o /dev/null -w "%{http_code}"
curl -s http://localhost:8000/api/v1/docs -o /dev/null -w "%{http_code}"
```
期望：所有服务 running，返回 200

- [ ] **Step 2: 执行 Playwright E2E 测试**

```bash
cd frontend
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => console.log('[console]', msg.text()));
  page.on('pageerror', err => console.error('[pageerror]', err.message));

  try {
    // 1. Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type=\"text\"]', 'guoketg');
    await page.fill('input[type=\"password\"]', '123456');
    await page.click('button[type=\"submit\"]');
    await page.waitForTimeout(3000);

    // 2. Navigate to recommendations
    await page.goto('http://localhost:3000/recommendations');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 3. Screenshot
    await page.screenshot({ path: 'test_script/notebook-page.png', fullPage: true });
    console.log('Screenshot saved');

    // 4. Verify key elements
    const body = await page.textContent('body');

    // Check dark theme (background should be dark)
    const bgColor = await page.evaluate(() => getComputedStyle(document.querySelector('.nb-page')!).backgroundColor);
    console.log('Page background:', bgColor);

    // Check top nav exists
    const hasTopNav = await page.locator('.nb-topnav').isVisible();
    console.log('TopNav visible:', hasTopNav);

    // Check sidebar exists
    const hasSidebar = await page.locator('.nb-sidebar').isVisible();
    console.log('Sidebar visible:', hasSidebar);

    // Check article area renders
    const articleText = await page.locator('.nb-article').textContent();
    console.log('Article text preview:', articleText?.substring(0, 200));

    // Check TOC exists (desktop)
    const hasToc = await page.locator('.nb-toc').isVisible();
    console.log('TOC visible:', hasToc);

    // 5. Click a category in top nav
    const navItems = await page.locator('.nb-topnav-item').all();
    if (navItems.length > 1) {
      await navItems[1].click();
      await page.waitForTimeout(500);
      console.log('Clicked second nav item');
    }

    // 6. Click a topic in sidebar
    const topics = await page.locator('.nb-sidebar-topic').all();
    if (topics.length > 0) {
      await topics[0].click();
      await page.waitForTimeout(500);
      console.log('Clicked first topic');
    }

    // 7. Check article updated
    const updatedArticle = await page.locator('.nb-article-title').textContent();
    console.log('Article title after click:', updatedArticle);

    // 8. Check resource cards
    const cards = await page.locator('.nb-resource-card').all();
    console.log('Resource cards count:', cards.length);

    // 9. Responsive test - narrow viewport
    await page.setViewportSize({ width: 800, height: 900 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test_script/notebook-narrow.png', fullPage: true });
    const tocAfterNarrow = await page.locator('.nb-toc').isVisible();
    console.log('TOC visible at 800px:', tocAfterNarrow); // Should be false

    // 10. Mobile test
    await page.setViewportSize({ width: 500, height: 900 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test_script/notebook-mobile.png', fullPage: true });
    const sidebarAtMobile = await page.locator('.nb-sidebar--open').isVisible();
    console.log('Sidebar open at 500px:', sidebarAtMobile); // Should be false initially

    console.log('\\n=== ALL CHECKS PASSED ===');
  } catch (e) {
    console.error('Test failed:', e.message);
    await page.screenshot({ path: 'test_script/notebook-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
"
```

- [ ] **Step 3: 检查截图并验证**

检查 `frontend/test_script/notebook-page.png`、`notebook-narrow.png`、`notebook-mobile.png`：
- 页面为深色主题（非浅色管理列表）
- 顶部横向导航可见
- 左侧目录可见
- 中间文章区渲染正常
- 右侧本页目录可见（宽屏）或隐藏（窄屏）
- 资源卡片正确渲染

- [ ] **Step 4: Commit (如有修复)**

```bash
# 如有修复
git add <修复的文件>
git commit -m "fix: E2E test fixes for notebook redesign"
```

---

## 完成检查清单

- [ ] 后端 `/recommendations/notebook` 端点返回正确的三层结构数据
- [ ] 分类推导正确（KnowledgePoint 精确匹配 + 关键词降级）
- [ ] 前端 `/recommendations` 打开后显示深色笔记风格（非浅色管理列表）
- [ ] 顶部栏目导航可点击切换，联动左侧目录
- [ ] 左侧知识点目录按栏目分组，可展开/收起，选中高亮
- [ ] 中间文章区有标题、导语、资源类型小节、资源卡片
- [ ] 右侧本页目录可点击定位，滚动高亮
- [ ] 刷新功能正常
- [ ] 删除资源功能正常
- [ ] 生成资源弹窗可从右上角触发
- [ ] 窄屏响应式布局正常（TOC 隐藏、sidebar 变抽屉）
- [ ] 旧 `RecommendationsCenterPage.tsx` 已删除且无残留引用
- [ ] 所有 API 响应中的错误信息为中文
