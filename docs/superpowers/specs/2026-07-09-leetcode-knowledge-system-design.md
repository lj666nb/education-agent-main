# 子项目 A：LeetCode 知识点体系搭建 设计文档

**日期**: 2026-07-09
**状态**: 设计中

---

## 1. 目标

用 LeetCode 公开元数据集为现有「数据结构」题库注入编程题数据，实现：
- 完善知识体系：补充 DP、Greedy 等现有 Domain 未覆盖的算法域
- 丰富题库内容：每个知识点最多 5 道经典 programming 题
- 支持编程诊断：与现有掌握度追踪、推荐系统联动

---

## 2. 当前状态

| 项目 | 现状 |
|------|------|
| 题库系统 | `Subject → KnowledgeDomain → KnowledgePoint → Question` 完整 |
| 种子数据 | 硬编码「数据结构」Subject，9 个 Domain，78 个 KnowledgePoint，~60 道选择题 |
| 编程题 | Question.type="programming" 已定义，content.code_template/test_cases 字段已存在但无实际编程题数据 |
| 练习流程 | PracticeSession + StudentAnswer + KnowledgePointRecord 成熟可用 |
| Neo4j | 知识点层级关系 + Question[:TESTS]→KP 关系同步已实现 |

---

## 3. 数据源

**Hugging Face: `kaysss/leetcode-problem-set`**

包含 ~2500+ LeetCode 题目元数据：
- `id`: LeetCode 题号
- `title`: 英文标题
- `title_slug`: URL slug
- `difficulty`: Easy / Medium / Hard
- `acceptance_rate`: 通过率
- `topic_tags`: 标签列表（Array, Linked List, DP 等）
- `url`: LeetCode 题目链接
- （可选）`content`: 英文题干（仅用于生成摘要，不存储原文）

**获取方式**：`datasets` 库直接加载，失败时降级到本地文件。

---

## 4. 知识体系映射

### 4.1 标签 → Domain 映射规则

目标 Subject：现有「数据结构」（UUID: `d91a4645-ab5f-4819-8379-d9e6524f0937`）

| LeetCode 标签 | Target Domain | 类型 |
|--------------|---------------|------|
| Array, Matrix | 数组和广义表 | 现有 |
| Linked List | 线性表 | 现有 |
| Stack, Queue, Monotonic Stack, Monotonic Queue | 栈和队列 | 现有 |
| Tree, Binary Tree, BST, Binary Indexed Tree, Segment Tree, Trie | 树和二叉树 | 现有 |
| Graph, BFS, DFS, Topological Sort, Union Find, Shortest Path, Minimum Spanning Tree | 图 | 现有 |
| Binary Search | 查找 | 现有 |
| Sorting, Merge Sort, Quickselect, Bucket Sort, Counting Sort, Radix Sort | 排序 | 现有 |
| String, Sliding Window, Two Pointers, Prefix Sum | 串 | 现有 |
| Hash Table, Hash Function | 查找 | 现有 |
| Dynamic Programming, Memoization | 其他算法 | **新建** |
| Greedy | 其他算法 | **新建** |
| Backtracking, Recursion | 其他算法 | **新建** |
| Bit Manipulation | 其他算法 | **新建** |
| Math, Geometry | 其他算法 | **新建** |
| Divide and Conquer | 其他算法 | **新建** |
| Heap, Priority Queue | 其他算法 | **新建** |
| 其他未匹配标签 | 其他算法 | **新建** |

### 4.2 KnowledgePoint 创建规则

每个 LeetCode 题创建一个独立 KnowledgePoint：
- `name`: "LeetCode {id}. {title}"（如 "LeetCode 1. Two Sum"）
- `domain_id`: 映射到的 Domain UUID
- `difficulty`: 从 LeetCode 难度映射（Easy→2, Medium→3, Hard→5）
- `description`: AI 生成的中文摘要

---

## 5. 数量控制

每个 KnowledgePoint 最多 **5 道** programming 题。

选择策略：按知识点分组 → 每个知识点优先选中高通过率 + 低题号（经典题）→ 取前 5 道。

预期总量：~200-250 题（10 个 Domain × 平均 5 个标签 × 5 道题，有去重和标签交叉）。

---

## 6. 数据存储

### 6.1 Question 结构

```
Question {
  type: "programming"
  difficulty: "beginner"|"basic"|"intermediate"|"advanced"|"competition"
  status: "published"
  source: "leetcode_import"
  ai_generated: false
  priority: 1
  content: {
    stem: "给定一个整数数组 nums 和一个目标值 target，请找出和为 target 的两个数的下标。"  ← AI 生成
    source_url: "https://leetcode.com/problems/two-sum/"
    leetcode_id: 1
    leetcode_slug: "two-sum"
    acceptance_rate: 48.5
    difficulty_original: "Easy"
  }
  answer: {
    explanation: "使用哈希表存储已遍历元素及其下标..."
    suggested_time_minutes: 30
  }
  knowledge_point_uuids: ["kp-uuid-xxx"]
  tags: ["Array", "Hash Table"]
}
```

### 6.2 公开题库

创建新的 QuestionBank：
- `name`: "LeetCode 算法题库"
- `owner_id`: admin 用户
- `subject_id`: 数据结构 Subject UUID
- `visibility`: "public"
- `description`: "LeetCode 经典算法编程题，含中文摘要和原题链接。每知识点最多 5 题。"

---

## 7. AI 摘要生成

为每道导入的题目调用 LLM 生成中文摘要：

**Prompt 模板：**
```
你是一个算法教学助手。请根据以下 LeetCode 题目信息，用中文写出 1-2 句简短摘要，说明题目的核心问题和典型解法思路。

标题：{title}
标签：{tags}
难度：{difficulty}

要求：
1. 只用 1-2 句话，不超过 80 字
2. 点出核心问题 + 常见解法（如"双指针""哈希表""动态规划"等）
3. 不要翻译整个题干
4. 适合在题库中作为题目简介展示
```

**复用现有 LLM 配置**：`settings.LLM_API_KEY` / `settings.LLM_API_URL` / `settings.LLM_MODEL`

---

## 8. 导入脚本

### 文件

`app/scripts/import_leetcode.py`

### 执行方式

```bash
# 全量导入（首次）
docker-compose exec backend python app/scripts/import_leetcode.py

# 增量导入（只导入新增题，跳过已存在）
docker-compose exec backend python app/scripts/import_leetcode.py --incremental

# 干跑（不写入数据库，仅打印统计）
docker-compose exec backend python app/scripts/import_leetcode.py --dry-run
```

### 流程

```
1. 加载 Hugging Face 数据集
2. 按标签分组，建立标签→Domain 映射
3. 对每个标签下的题集：
   a. 按通过率降序 + 题号升序排序（优先经典题）
   b. 取前 5 道
4. 去重（同一道题可能匹配多个标签，只保留首次匹配的 Domain）
5. 创建/获取 KnowledgePoint（幂等：name 相同时复用）
6. 批量调用 LLM 生成中文摘要
7. 创建 Question（source="leetcode_import"，status="published"）
8. 同步 Neo4j
9. 打印导入统计
```

### 去重策略

每道 LeetCode 题只存储一次。如果一道题同时有 "Array" 和 "Hash Table" 标签：
- 优先归入先匹配到的 Domain（根据映射表顺序）
- 但在 `tags` 字段中保留所有原始标签

---

## 9. 前端影响

**无需新建页面**。导入的题目自动出现在：

- `/banks` 列表页 → 「LeetCode 算法题库」显示（标记为"公开"）
- `/banks/{bankId}` 详情页 → 知识树展示 LeetCode 知识点和题目
- `/banks/{bankId}/practice` 练习页 → 可选择 LeetCode 题进行练习
- `/recommendations` 资源推荐 → 薄弱知识点关联 LeetCode 题推荐

编程题的练习流：
1. 学生看到中文摘要和 LeetCode 链接
2. 可选：在系统内提交解法文本（自由文本输入）
3. 系统无法自动判题（无测试用例），学生自行在 LeetCode 提交 → 回填 self_grade
4. 后续子项目 B（APPS/CodeContests）补充可判题的测试用例

---

## 10. 依赖

### 新增 Python 依赖

```
datasets
```
（Hugging Face datasets 库，用于加载 LeetCode 数据集）

### 无需新增

- LLM API：复用现有配置
- Neo4j：复用现有同步函数
- 数据库：复用现有模型

---

## 11. 验收标准

- [ ] `python app/scripts/import_leetcode.py` 成功执行，无报错
- [ ] 数据库中出现「LeetCode 算法题库」(visibility="public")
- [ ] 新建的「其他算法」Domain 出现在数据结构 Subject 下
- [ ] 每个标签最多 5 道题，总量 ~200-250 题
- [ ] 每道题有中文摘要、原题链接、标签
- [ ] 公开题库对所有用户可见（非 owner 用户可查看题目列表）
- [ ] Neo4j 中 Question[:TESTS]→KnowledgePoint 关系正确
- [ ] 前端 `/banks` 页面可以看到 LeetCode 题库
- [ ] AI 摘要生成失败时有降级（直接用英文标题作为 stem）
- [ ] dry-run 模式正确打印统计而不写入数据库

---

## 12. 不做

- 不存储完整英文题干（版权问题，只存链接 + AI 摘要）
- 不实现代码执行/判题（留给子项目 B）
- 不导入全部 2500+ 题（每个知识点 5 题上限）
- 不修改现有练习流程逻辑
- 不在前端新增页面
