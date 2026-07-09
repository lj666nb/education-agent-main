# 编程题可视化推演系统 设计规格

> 目标：为数据结构题库新增第二种题目类型（编程题），提供图码风格的代码可视化推演编辑器。

---

## 1. 概述

### 1.1 背景

现有题库只包含选择题和判断题。本次新增编程题类型，学生在代码编辑器写代码后，由 Qwen AI 分析执行逻辑，生成逐步推演追踪数据，前端渲染数据结构变化动画。

### 1.2 核心体验

1. 左侧目录树：按知识点章节组织编程题，显示完成状态
2. 题目描述区：展示题干、输入输出格式、样例
3. Monaco 代码编辑器：支持 Python/C++/Java
4. 可视化面板：Canvas 动画展示数据结构状态变化
5. 步骤控制器：前进/后退/自动播放

### 1.3 题目来源

dotcpp ybt-ds（信息学一本通-数据结构），约 50-70 道编程题，覆盖栈、队列、树、图等章节。

---

## 2. 架构

### 2.1 后端组件

| 文件 | 职责 |
|------|------|
| `app/scripts/import_coding_problems.py` | dotcpp 编程题导入脚本 |
| `app/api/endpoints/coding.py` | 编程题 API 端点 |
| `app/schemas/coding.py` | 请求/响应数据模型 |
| `app/services/code_analyzer.py` | Qwen AI 代码分析服务 |

### 2.2 前端组件

| 文件 | 职责 |
|------|------|
| `frontend/src/pages/CodingPracticePage.tsx` | 编程练习主页面（三栏布局） |
| `frontend/src/components/coding/ProblemTree.tsx` | 知识点目录树 |
| `frontend/src/components/coding/CodePlayground.tsx` | 代码编辑器 + 可视化面板 |
| `frontend/src/components/coding/VisualizationCanvas.tsx` | 数据结构动画 Canvas |
| `frontend/src/components/coding/StepController.tsx` | 步骤前进/后退/播放控制器 |
| `frontend/src/api/coding.ts` | 前端 API 客户端 |

---

## 3. 数据模型

### 3.1 题目内容结构 (Question.content for type=programming)

```json
{
  "stem": "后缀表达式求值",
  "description": "从键盘读入一个后缀表达式...",
  "input_format": "一个后缀表达式",
  "output_format": "后缀表达式的值",
  "sample_input": "16 9 4 3 +*-@",
  "sample_output": "-47",
  "code_template": {
    "python": "def solve():\n    pass",
    "cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}",
    "java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n    }\n}"
  },
  "time_limit_ms": 1000,
  "memory_limit_mb": 128,
  "source_problem_id": "dotcpp-3070"
}
```

### 3.2 答案结构 (Question.answer)

```json
{
  "reference_code": "def solve():\n    stack = []...",
  "explanation": "使用栈处理后缀表达式，遇到数字入栈，遇到运算符弹出两个操作数计算后入栈",
  "test_cases": [
    {"input": "16 9 4 3 +*-@", "expected_output": "-47"}
  ]
}
```

### 3.3 AI 执行追踪格式

Qwen AI 分析代码后返回的标准化 JSON，前端用于驱动动画：

```json
{
  "steps": [
    {
      "step": 1,
      "line": 3,
      "line_code": "stack = []",
      "action": "创建空栈",
      "variables": {"stack": []},
      "data_structure": {
        "type": "stack",
        "elements": [],
        "top": -1
      },
      "explanation": "初始化空栈，用于存储中间计算结果"
    }
  ],
  "result": {"output": "-47"},
  "summary": "代码正确实现了后缀表达式求值算法，使用栈存储操作数，遇到运算符时弹出计算"
}
```

### 3.4 支持的数据结构类型

Canvas 渲染支持以下结构类型的动画：`array`, `stack`, `queue`, `linked_list`, `tree`, `graph`, `heap`, `hash_table`

---

## 4. API 设计

### 4.1 GET /coding/tree

获取编程题知识点目录树（含完成状态）。

```
Query: ?subject_id=d91a4645-ab5f-4819-8379-d9e6524f0937 (可选，默认数据结构)
Response: {
  "domains": [
    {
      "domain_id": "...",
      "domain_name": "栈",
      "sort_order": 1,
      "total_problems": 7,
      "completed_count": 2,
      "points": [
        {
          "point_id": "...",
          "point_name": "栈的基本应用",
          "problems": [
            {
              "id": "...",
              "title": "T1331-后缀表达式的值",
              "difficulty": "basic",
              "status": "completed"
            }
          ]
        }
      ]
    }
  ]
}
```

### 4.2 GET /coding/problems/{id}

获取题目详情。

```
Response: {
  "id": "...",
  "title": "T1331-后缀表达式的值",
  "type": "programming",
  "content": { ... },
  "difficulty": "basic",
  "knowledge_point_uuids": [...],
  "tags": [...],
  "user_last_code": "def solve():..." | null
}
```

### 4.3 POST /coding/analyze

SSE 流式，Qwen AI 分析代码生成执行追踪。

```
Request: {
  "problem_id": "...",
  "code": "def solve():\n    stack = []...",
  "language": "python"
}

SSE Events:
  data: {"type":"status","content":"正在分析代码结构..."}
  data: {"type":"status","content":"正在推演执行过程..."}
  data: {"type":"step","data":{"step":1,"line":3,"line_code":"...","variables":{},"data_structure":{},"explanation":"..."}}
  data: {"type":"step","data":{...}}
  ...
  data: {"type":"complete","result":{"output":"-47"},"summary":"代码正确..."}
  data: {"type":"error","content":"分析失败: ..."}
```

### 4.4 POST /coding/submit-result

保存作答结果和代码。

```
Request: {
  "problem_id": "...",
  "code": "def solve():...",
  "language": "python",
  "is_correct": true,
  "time_spent_seconds": 300
}

Response: {
  "success": true,
  "answer_id": "..."
}
```

---

## 5. 前端页面设计

### 5.1 页面路由

`/coding-practice` — 编程练习主页面

URL 参数：
- `?problem=xxx` — 直接打开指定题目
- `?domain=xxx` — 展开指定章节

### 5.2 布局结构

```
┌──────────┬─────────────────────────────────────────────┐
│ 目录树    │  题目内容区                                   │
│ (260px)  │                                              │
│          │  ┌─────────────────────────────────────────┐ │
│ 搜索框    │  │ 标题: T1331-后缀表达式的值  [难度标签]      │ │
│          │  │ 描述: 从键盘读入一个后缀表达式...           │ │
│ ▸ 栈 (7) │  │ 输入/输出格式 + 样例                        │ │
│ ▾ 队列(9)│  ├────────────────────┬────────────────────┤ │
│   T1338  │  │ 代码编辑器(Monaco)   │ 可视化面板           │ │
│   T1339  │  │                    │ [数据结构动画Canvas] │ │
│   ...    │  │ def solve():       │                     │ │
│ ▸ 树(16)│  │   stack = []       │ 变量状态:           │ │
│ ▸ 图(16)│  │   for c in expr:   │  stack = [16, 9]   │ │
│          │  │     ...            │                     │ │
│          │  │                    │ 步骤2: 遇到操作数9   │ │
│          │  ├────────────────────┴────────────────────┤ │
│          │  │ [运行分析] [语言: Python v]              │ │
│          │  │ ◀ 上一步  ▶ 下一步  ▶▶ 自动播放  步骤2/8 │ │
│          │  └─────────────────────────────────────────┘ │
└──────────┴─────────────────────────────────────────────┘
```

### 5.3 目录树交互

- 点击章节标题：展开/折叠子节点
- 点击题目：切换右侧内容（加载题目详情+编辑器+可视化）
- 题目项显示完成状态标记：已通过(绿点)、尝试中(黄点)、未做(灰点)
- 章节标题显示进度：`栈 (2/7)`
- 搜索框：输入关键词过滤题目标题
- 当前选中题目高亮背景

### 5.4 可视化面板

- Canvas 绘制数据结构动画（数组/栈/队列用矩形格，链表用节点箭头，树用节点连线，图用顶点边）
- 动画过渡使用缓动效果（200ms ease-out）
- 数据变化时（如入栈/出栈）播放对应动画
- 当前步骤文字说明显示在 Canvas 下方区域
- 变量状态以表格形式显示在 Canvas 上方

### 5.5 步骤控制器

- 「上一步」按钮：回退一个步骤，还原上一步的数据结构状态
- 「下一步」按钮：前进一个步骤，渲染下一步的变化
- 「自动播放」按钮：以 1 秒/步的速度自动推进
- 步骤进度条：显示当前步骤/总步数
- 可用键盘控制：← 上一步，→ 下一步，Space 自动播放

### 5.6 代码编辑器

- 复用现有 `CodeEditor` 组件（Monaco Editor）
- 顶部语言选择器：Python / C++ / Java
- AI 分析时高亮当前执行行
- 「运行分析」按钮触发 AI 推演
- 代码自动保存到 localStorage（防止意外丢失）

---

## 6. AI 分析 Prompt 设计

```text
你是一个代码可视化推演引擎。请分析以下代码，生成逐步执行追踪。

【题目】
{problem_description}

【代码】
```{language}
{code}
```

【要求】
1. 推理代码执行过程，生成逐步追踪（每一步包含：行号、变量状态、数据结构状态）
2. 数据结构类型从以下选择：array, stack, queue, linked_list, tree, graph, heap, hash_table
3. 每步都要有中文解释
4. 最终给出运行结果和代码评价
5. 严格按 JSON 格式输出，不要加代码块标记

【输出格式】
{
  "steps": [
    {
      "step": 1,
      "line": <行号>,
      "line_code": "<该行代码>",
      "action": "<操作描述>",
      "variables": {<变量名: 值>},
      "data_structure": {
        "type": "<类型>",
        "elements": [...],
        ...其他类型特定字段
      },
      "explanation": "<步骤解释>"
    }
  ],
  "result": {"output": "<程序输出>"},
  "summary": "<整体评价>"
}
```

---

## 7. 题目导入

### 7.1 来源

dotcpp ybt-ds 页面：https://www.dotcpp.com/oj/ybt-ds/

章节页：
- /oj/1081/ → 数据结构-栈 (7题)
- /oj/1082/ → 数据结构-队列 (9题)
- /oj/1083/ → 数据结构-树和堆 (16题)
- /oj/1084/ → 图论相关 (16题)
- /oj/1085/ → 脚本自动发现（遍历分页直到无更多题目）

### 7.2 导入脚本

`app/scripts/import_coding_problems.py`

流程：
1. 遍历各章节页，提取题目列表（ID、标题、难度）
2. 逐一访问题目详情页（/oj/problem{id}.html）
3. 解析：题目描述、输入/输出格式、样例输入/输出、限制
4. Qwen AI 分类 → 匹配到已有知识点 UUID
5. Qwen AI 生成 code_template（Python/C++/Java 三种语言框架）
6. 导入到 seed bank（`type=programming`）

### 7.3 章节映射

| dotcpp 章节 | 对应知识点章节 | 预估题数 |
|---|---|---|
| 数据结构-栈 | 栈和队列 | 7 |
| 数据结构-队列 | 栈和队列 | 9 |
| 数据结构-树和堆 | 树和二叉树 | 16 |
| 图论相关 | 图 | 16 |
| 后续页... | 查找/排序等 | ~20 |
| **合计** | | **~70** |

---

## 8. 全局约束

- 所有用户可见文字必须是中文
- API 需要 JWT 认证（复用现有认证）
- 页面必须有返回导航
- 加载/处理状态要有反馈
- 题目导入幂等（跳过已存在题目）
- 使用 Qwen/DeepSeek API（通过用户设置中的 API key）
- 遵循现有项目代码风格

---

## 9. 实现阶段

| 阶段 | 内容 | 预计 |
|------|------|------|
| P0 | 导入脚本 + 后端 API (tree/problems/analyze/submit) | 核心 |
| P0 | 前端编程练习页 (目录树+编辑器+可视化面板) | 核心 |
| P1 | Canvas 动画渲染 (6种数据结构) | 可视化 |
| P1 | 步骤控制器 + 自动播放 | 交互 |
| P2 | 代码自动保存 + 历史记录 | 体验 |
