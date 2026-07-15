# 教育智能体：面向个性化学习的多智能体系统 - Design Spec

## I. Project Information

| Item | Value |
| --- | --- |
| **Project Name** | 教育智能体：面向个性化学习的多智能体系统 |
| **Canvas Format** | PPT 16:9（1280×720） |
| **Page Count** | 20 |
| **Design Style** | dark-tech / 深空青蓝技术演示 |
| **Target Audience** | 中国软件杯 A3 初赛评审专家、科大讯飞技术评委与教育应用评委 |
| **Use Case** | 现场项目路演与答辩 |
| **Delivery Purpose** | presentation |
| **Content Strategy** | 平衡赛题逐项响应、项目真实实现证据与可落地创新价值；不夸大未完成能力 |
| **Created Date** | 2026-07-15 |

---

## II. Canvas Specification

| Property | Value |
| --- | --- |
| **Format** | PPT 16:9 |
| **Dimensions** | 1280×720 |
| **viewBox** | `0 0 1280 720` |
| **Margins** | 左右 56，上 42，下 34 |
| **Content Area** | 1168×644 |

---

## III. Visual Theme

### Theme Style

- **Mode**: pyramid
- **Visual style**: dark-tech
- **Theme**: Dark theme
- **Tone**: 技术可信、教育友好、评审导向、证据先行

### Color Scheme

| Role | HEX | Purpose |
| --- | --- | --- |
| **Background** | `#07131A` | 深空主背景 |
| **Secondary bg** | `#0E2530` | 卡片、分层与注释面板 |
| **Primary** | `#00B8D9` | 智能体链路、标题装饰、主高亮 |
| **Accent** | `#FFD166` | 评分、成果数字与关键价值 |
| **Secondary accent** | `#3D7EFF` | 数据、学习路径与技术模块 |
| **Body text** | `#F0FAFF` | 主正文 |
| **Secondary text** | `#A9C4CF` | 注释与次级说明 |
| **Tertiary text** | `#6F8D98` | 页脚、来源 |
| **Border/divider** | `#1B4351` | 卡片边框与网格线 |
| **Success** | `#52D6A2` | 已实现、闭环与通过状态 |
| **Warning** | `#FF7A90` | 风险与规划项 |

### Gradient Scheme

标题使用 `#00B8D9 → #3D7EFF` 的低饱和线性渐变；背景仅允许 8%–14% 透明度的径向光晕，避免抢夺信息层级。

---

## IV. Typography System

### Font Plan

**Typography direction**: CJK 主导的技术终端感，标题更硬朗，正文保证答辩投影可读。

| Role | Chinese | English | Fallback tail |
| --- | --- | --- | --- |
| **Title** | SimHei | Consolas | monospace |
| **Body** | Microsoft YaHei | Segoe UI | sans-serif |
| **Emphasis** | SimHei | Consolas | sans-serif |
| **Code** | Microsoft YaHei | Consolas | monospace |

**Per-role font stacks**:

- Title: `Consolas, SimHei, "Microsoft YaHei", monospace`
- Body: `"Microsoft YaHei", "Segoe UI", Arial, sans-serif`
- Emphasis: `Consolas, SimHei, "Microsoft YaHei", sans-serif`
- Code: `Consolas, "Microsoft YaHei", monospace`

### Font Size Hierarchy

| Role | Size | Weight |
| --- | ---: | --- |
| Cover title | 88 | 700 |
| Page title | 56 | 700 |
| Hero number | 64 | 700 |
| Subtitle / lead | 40 | 600 |
| Subheading | 36 | 600 |
| Body | 32 | 400 |
| Annotation | 24 | 400 |
| Footnote / page number | 18 | 400 |

---

## V. Layout Principles

### Page Structure

- **Header area**: 42–118；页码、章节标签、标题与一句核心判断。
- **Content area**: 126–664；每页只承载一个评审结论，图表和截图优先。
- **Footer area**: 678–706；来源、实现状态或页码。
- 截图始终完整呈现，使用 `meet`，不裁掉浏览器页面关键区域。
- 深色页面保留明显负空间；不连续使用相同卡片网格超过两页。

### Layout Pattern Library

- 证据页：截图占 60%–76%，结论与标注占 24%–40%。
- 架构页：分层或水平管线，箭头只表达真实数据流。
- 价值页：3–4 个并行支柱，强调学生、教师、平台三方价值。
- 闭环页：环形阶段强调“画像—生成—学习—评价—更新”。
- 总览页：小多图均匀网格，不对截图做风格化处理。

### Spacing Specification

| Element | Current Project |
| --- | ---: |
| Safe margin | 56 |
| Content block gap | 28 |
| Icon-text gap | 12 |
| Card gap | 22 |
| Card padding | 24 |
| Card radius | 14 |

---

## VI. Icon Usage Specification

- **Library**: `phosphor-duotone`
- **Method**: `<use data-icon="phosphor-duotone/icon-name" .../>`

| Purpose | Icon Path | Page |
| --- | --- | --- |
| 智能体与 AI | `phosphor-duotone/robot`, `phosphor-duotone/brain` | P02, P06, P07 |
| 学习者与教育 | `phosphor-duotone/student`, `phosphor-duotone/graduation-cap` | P03, P04, P09 |
| 路径与流程 | `phosphor-duotone/path`, `phosphor-duotone/flow-arrow` | P07, P10, P13 |
| 知识与数据 | `phosphor-duotone/graph`, `phosphor-duotone/database`, `phosphor-duotone/tree-structure` | P06, P09, P12 |
| 资源类型 | `phosphor-duotone/video-camera`, `phosphor-duotone/code`, `phosphor-duotone/question`, `phosphor-duotone/file-doc`, `phosphor-duotone/books` | P11 |
| 可信与评估 | `phosphor-duotone/shield-check`, `phosphor-duotone/chart-line-up`, `phosphor-duotone/check-circle` | P05, P15, P18 |

---

## VII. Visualization Reference List

Catalog read: 76 templates

| Page | Template | Path | Summary-quote | Usage |
| --- | --- | --- | --- | --- |
| P05 | kpi_cards | `templates/charts/kpi_cards.svg` | "Pick for 4-8 standalone numeric metrics shown as overview cards (2x2 or 1x4) — exec summary opener, dashboard headline, quarterly recap, results-at-a-glance. Skip if metrics have target baselines (use bullet_chart) or single hero number (use gauge_chart)." | 展示赛题评分 45/35/10/10，并用结构而非面积暗示权重 |
| P06 | layered_architecture | `templates/charts/layered_architecture.svg` | "Pick for 3-4 horizontal architecture layers (presentation/service/data), 2-4 module cards per layer, each card = title + 1-line description (description required, even if source brief). Skip if no per-module descriptions (use icon_grid) or no horizontal layering (use module_composition)." | 前端交互层—智能体编排层—模型/检索层—数据基础层 |
| P07 | pipeline_with_stages | `templates/charts/pipeline_with_stages.svg` | "Pick for 3-5 horizontal pipeline stages, each = title + 1-line description + output artifact, connected by arrows (data pipelines, ETL, build pipelines). Skip if any stage lacks an artifact (use process_flow or numbered_steps)." | Scheduler→Profile→ResourceGen→PathPush，标注每阶段输出 |
| P08 | process_flow | `templates/charts/process_flow.svg` | "Pick for 3-8 sequential steps connected by simple arrows — approval workflows, customer onboarding, request handling, lifecycle stages. Skip if cyclical (use circular_stages) or stages produce named outputs (use pipeline_with_stages)." | 请求、SSE 状态、取消与结果追踪 |
| P09 | segmented_wheel | `templates/charts/segmented_wheel.svg` | "Pick for one central topic split into 4-8 equally-weighted parallel dimensions (5W1H, 4P, 5S, 6-aspect review), each wedge paired with a description card. Skip for sequential cycles (use circular_stages), proportional shares (use pie_chart), or hub with non-wedge spokes (use hub_spoke)." | 8 维动态学习者画像 |
| P10 | circular_stages | `templates/charts/circular_stages.svg` | "Pick for 4-6 stage closed loop where stages compose a cycle — PDCA, flywheel compounding loops (Attract → Engage → Delight), lifecycle, continuous improvement. Skip for linear flow (use process_flow), one-shot sequence (use numbered_steps), or wedge-based central topic (use segmented_wheel)." | 画像—生成—学习—评价—更新闭环 |
| P11 | icon_grid | `templates/charts/icon_grid.svg` | "Pick for 4-9 parallel features/capabilities/services as icon cards — feature grid, service lineup, benefits matrix, brand values, product highlights. Skip for sequential ordering (use numbered_steps) or hierarchical layers (use pyramid_chart)." | 5 类并发生成资源 |
| P12 | top_down_tree | `templates/charts/top_down_tree.svg` | "Pick for hierarchical top-down tree 2-4 levels deep with parent→children reporting/decomposition lines — org charts (CEO → VPs → Directors), OKR cascades (Objective → Key Results → Initiatives), WBS decomposition. Skip for non-hierarchical brainstorm (use mind_map) or flat team showcase (use team_roster)." | 文档—知识点—关系—检索证据层级 |
| P13 | roadmap_vertical | `templates/charts/roadmap_vertical.svg` | "Pick for 4-8 milestones on a vertical timeline with status indicators. Skip for horizontal time emphasis (use timeline) or tasks with durations (use gantt_chart)." | 学习路径阶段与资源推送 |
| P15 | circular_stages | `templates/charts/circular_stages.svg` | "Pick for 4-6 stage closed loop where stages compose a cycle — PDCA, flywheel compounding loops (Attract → Engage → Delight), lifecycle, continuous improvement. Skip for linear flow (use process_flow), one-shot sequence (use numbered_steps), or wedge-based central topic (use segmented_wheel)." | 练习—判题—错因—掌握度—推荐反馈闭环 |
| P16 | snake_flow | `templates/charts/snake_flow.svg` | "Pick for 6-10 winding sequential steps fitting a long journey/lifecycle on one slide. Skip for <=5 steps (use numbered_steps)." | 从登录到学习效果回写的完整用户旅程，配产品截图证据 |
| P17 | hub_spoke | `templates/charts/hub_spoke.svg` | "Pick for 1 core capability + 4-8 surrounding capabilities (platform/ecosystem); each spoke = title or title + 1-2 line description. Skip if center is a system containing parts with their own descriptions (use module_composition), or surroundings exert inward pressure on the center (use hub_inward_arrows)." | 大模型核心融合 LangGraph、RAG、KG、向量检索、SSE 与代码执行 |
| P18 | layered_architecture | `templates/charts/layered_architecture.svg` | "Pick for 3-4 horizontal architecture layers (presentation/service/data), 2-4 module cards per layer, each card = title + 1-line description (description required, even if source brief). Skip if no per-module descriptions (use icon_grid) or no horizontal layering (use module_composition)." | 内容安全、权限、隔离执行、可追踪状态与容器部署 |
| P19 | vertical_pillars | `templates/charts/vertical_pillars.svg` | "Pick for 1×3 / 1×4 / 1×5 vertical column layout where each pillar = one independent category with title + bullets — PEST (Political/Economic/Social/Technological), four-pillar strategy overview, side-by-side independent categories. Skip for 2×2 quadrant (use quadrant_text_bullets), pricing tiers (use comparison_columns), or 2×2 parallel aspects (use labeled_card)." | 创新、实用、工程与演进四柱 |

**Runners-up considered**:

- `numbered_steps`：不用于 P07，因为四个智能体阶段都有明确输出物，管线模板更准确。
- `module_composition`：不用于 P06，因为项目架构存在明确横向分层而非单一系统部件集合。
- `timeline`：不用于 P13，因为学习阶段强调纵向进阶而非真实日期跨度。
- `mind_map`：不用于 P12，因为知识图谱证据链具有上下级分解关系。

---

## VIII. Image Resource Inventory

唯一来源：`C:\Users\daiyu\Desktop\教育智能体项目截图_2026-07-15`。所有图片均为用户提供的真实产品截图，`Existing`，必须无裁切。

| Filename | Size | Intent | Page usage | Type | Status | Layout pattern |
| --- | --- | --- | --- | --- | --- | --- |
| `src_01_01-首页.png` | 1600×900 | hero | P01, P16 | Product UI Screenshot | Existing | #42 Background image + glassmorphism UI panels |
| `src_02_02-AI对话.png` | 1600×900 | hero | P02, P14, P16 | Product UI Screenshot | Existing | #45 Background image + numbered hotspots with sidebar legend |
| `src_03_05-学习路径.png` | 1600×900 | side-by-side | P13, P16 | Product UI Screenshot | Existing | #62 Same image, two references — full view + zoom-callout |
| `src_04_Snipaste_2026-07-15_16-33-35.png` | 2880×1530 | evidence | P16 | Product UI Screenshot | Existing | #50 Tiled grid (2×2, 2×3, 3×3) with equal cells |
| `src_05_Snipaste_2026-07-15_16-34-40.png` | 2880×1530 | evidence | P16 | Product UI Screenshot | Existing | #50 Tiled grid (2×2, 2×3, 3×3) with equal cells |
| `src_06_Snipaste_2026-07-15_16-35-52.png` | 2864×1536 | evidence | P16 | Product UI Screenshot | Existing | #50 Tiled grid (2×2, 2×3, 3×3) with equal cells |
| `src_07_Snipaste_2026-07-15_16-36-15.png` | 2864×1536 | evidence | P16 | Product UI Screenshot | Existing | #50 Tiled grid (2×2, 2×3, 3×3) with equal cells |
| `src_08_Snipaste_2026-07-15_16-36-37.png` | 2864×1536 | evidence | P16 | Product UI Screenshot | Existing | #50 Tiled grid (2×2, 2×3, 3×3) with equal cells |
| `src_09_Snipaste_2026-07-15_16-37-07.png` | 2864×1536 | evidence | P16 | Product UI Screenshot | Existing | #50 Tiled grid (2×2, 2×3, 3×3) with equal cells |
| `src_10_Snipaste_2026-07-15_16-42-40.png` | 2880×1530 | evidence | P16 | Product UI Screenshot | Existing | #50 Tiled grid (2×2, 2×3, 3×3) with equal cells |

---

## IX. Content Outline

| Page | Title | Core message and evidence | Visual / layout | Rhythm |
| --- | --- | --- | --- | --- |
| P01 | 教育智能体 | 面向个性化学习的多智能体协作系统；一句话价值：让画像、资源、路径与评价形成可追踪闭环。 | 首页截图右侧主视觉，左侧标题与赛题标签 | anchor |
| P02 | 不是“会聊天”，而是“会协作的 AI 教学团队” | 动态感知学习者，分工生成资源，持续调整路径；真实 AI 对话页面作为产品证据。 | AI 对话截图全景 + 3 个浮动结论 | breathing |
| P03 | 教学个性化为什么难 | 画像碎片化、资源供给慢、路径静态、效果反馈断裂，四个断点导致“千人一面”。 | 4 个问题卡与一条断裂链路 | dense |
| P04 | 应用价值：把一次回答变成持续学习服务 | 学生获得适配内容；教师降低备课与诊断成本；平台沉淀可解释数据资产。 | 3 个价值支柱 + 顶部结果判断 | dense |
| P05 | 先对准评分，再组织证据 | 功能与技术 45%、创新与实用 35%、文档 10%、视频/PPT 10%；后续页面一一响应。 | 4 个 KPI 卡，45/35 强调 | dense |
| P06 | 总体架构：交互、编排、模型、数据四层协同 | React/Vite；FastAPI/LangGraph；LLM/RAG/KG；PostgreSQL/pgvector、Neo4j、MongoDB、Redis。 | 四层架构，右侧技术注记 | dense |
| P07 | 四智能体流水线：每一步都有明确产物 | Scheduler 编排；Profile 输出画像快照；ResourceGen 输出五类资源；PathPush 输出阶段路径与推送。 | 4 段水平管线 | dense |
| P08 | 任务可追踪，而不是黑盒等待 | 生成、状态、SSE 进度、取消、结果回看构成可观察任务链路。 | 请求到结果的 6 步流程 | dense |
| P09 | 8 维动态画像：个性化的共同状态 | 掌握度、认知风格、易错偏好、多模态偏好、活跃时段、学习节奏、元认知校准、注意力特征。 | 8 维分段轮盘 | dense |
| P10 | 个性化不是一次设置，而是持续更新 | 画像→生成→学习→评价→画像更新，形成长期自适应飞轮。 | 五阶段闭环，中心为“可解释个性化” | breathing |
| P11 | 五类资源并发生成，覆盖教、学、练、用 | 视频脚本、代码案例、练习题、讲义文档、思维导图；当前实现固定五类并发生成。 | 五卡 icon grid | dense |
| P12 | 知识图谱 + RAG：让生成有依据 | 文档解析形成知识点与关系；向量召回提供证据；知识图谱支撑前置依赖与路径规划。 | 自上而下证据树 | dense |
| P13 | 学习路径：从目标到阶段，再到精准资源 | 目标、知识差距、阶段顺序、资源推送和完成状态串联；真实学习路径截图。 | 左 36% 路线图，右 64% 截图 | dense |
| P14 | 智能辅导：多模态交互连接“问”与“学” | 流式 Markdown、多模态卡片、知识缺口识别与一键生成资源；真实 AI 对话截图。 | 全景截图 + 3 个热点标注 | breathing |
| P15 | 评价闭环：每次练习都反哺下一步 | 练习/代码判题→错因与标签→掌握度更新→画像更新→下一资源推荐。 | 五阶段评价闭环 | dense |
| P16 | 完整用户旅程已落到真实页面 | 登录/首页→画像→对话→知识图谱→资源→路径→练习→统计→任务追踪；10 张指定截图作为证据池。 | 10 图证据墙 + 底部旅程线 | dense |
| P17 | 前沿 AI 融合：不是堆模型，而是分层协同 | LangGraph 编排、LLM 生成、RAG 证据、KG 关系、向量检索、SSE 体验与隔离执行围绕同一学习状态协同。 | 中心辐射图 | dense |
| P18 | 工程可信：安全、可追踪、可部署 | JWT、内容安全/反幻觉、代码隔离、任务取消与进度、Docker Compose、多数据库分工。 | 3 层可信架构 + 状态标签 | dense |
| P19 | 创新价值与诚实演进 | 已实现：多智能体闭环、8 维画像、五类并发资源、KG+RAG；增强项：自动周报、长期策略自动优化。 | 四柱：创新/实用/工程/演进 | breathing |
| P20 | 让每一次学习，都成为下一次个性化的依据 | 收束价值：可感知、可生成、可追踪、可进化；邀请评审体验真实产品链路。 | 大标题 + 四关键词 + 轻量产品剪影 | anchor |

---

## X. Source and Accuracy Notes

- 赛题来源：`https://www.cnsoftbei.com/content-3-1286-1.html`（A3 大模型驱动的个性化学习资源生成与学习多智能体系统）。
- 项目实现证据来自当前仓库；多智能体工作流以 Scheduler、Profile、ResourceGen、PathPush 四个节点为准。
- 当前固定并发生成五类资源，不将可扩展枚举误写成已稳定生成七类。
- 自动周报和长期策略自动优化在 P19 明确标为增强项，不作为已完成能力宣称。
- 图片来源严格限定为用户指定桌面目录中的 10 张真实产品截图。
