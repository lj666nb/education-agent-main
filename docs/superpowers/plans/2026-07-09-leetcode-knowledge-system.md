# LeetCode 知识点体系搭建 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 HuggingFace LeetCode 数据集导入 ~200-250 道经典编程题，搭建知识点体系，创建公开题库

**Architecture:** 纯后端数据导入任务 — 单个导入脚本 `import_leetcode.py`，通过 HuggingFace `datasets` 库加载数据，映射标签到现有 KnowledgeDomain，创建 KnowledgePoint 和 Question，同步 Neo4j

**Tech Stack:** Python 3.12, SQLAlchemy, HuggingFace datasets, 现有 LLM API（复用 settings 配置）, Neo4j

## Global Constraints

- 数据源：HuggingFace `kaysss/leetcode-problem-set`，`datasets` 库加载，失败降级到本地文件
- 目标 Subject：「数据结构」UUID `d91a4645-ab5f-4819-8379-d9e6524f0937`
- 标签映射：匹配到现有 9 个 Domain；未匹配标签归入新建「其他算法」Domain
- 数量：每个知识点最多 5 道题，总量 ~200-250
- 内容：只存元数据 + AI 生成中文摘要（1-2 句，≤80 字） + LeetCode 原题链接
- 题库：创建公开「LeetCode 算法题库」（visibility="public"，owner=admin）
- 每道题创建独立 KnowledgePoint（name="LeetCode {id}. {title}"）
- 去重：每题只存一次，优先归入先匹配的 Domain，原始标签全部保留在 tags
- Neo4j：复用现有 `_sync_question_to_neo4j()` 等同步函数
- 执行方式：`docker-compose exec backend python app/scripts/import_leetcode.py [--dry-run|--incremental]`
- AI 摘要生成失败时降级：使用英文标题作为 stem
- Docker 后端容器内执行，需重启容器使新依赖生效

---

## 文件结构

```
新建 (1):
  app/scripts/import_leetcode.py               ← 数据导入主脚本

修改 (1):
  requirements.txt                             ← 添加 datasets 依赖
```

---

### Task 1: 添加 datasets 依赖

**Files:**
- Modify: `requirements.txt`

**Interfaces:**
- Produces: `datasets` 包可用于 Docker 容器内的 Python 环境

- [ ] **Step 1: 在 requirements.txt 末尾添加依赖**

打开 `E:\code\python\education-agent-test01\requirements.txt`，在末尾追加：

```
datasets>=2.14.0
```

- [ ] **Step 2: 重建 Docker 并验证**

```bash
docker-compose up -d --build backend
docker-compose exec backend pip show datasets | grep Version
```

期望输出：`Version: 2.x.x`

- [ ] **Step 3: Commit**

```bash
git add requirements.txt
git commit -m "chore: add datasets dependency for LeetCode import"
```

---

### Task 2: 创建标签映射配置 + Domain 管理模块

**Files:**
- Create: `app/scripts/import_leetcode.py`（第一部分：配置常量和 Domain 管理）

**Interfaces:**
- Consumes: `KnowledgeDomain`, `Subject` 模型；`get_db` session
- Produces: `TAG_DOMAIN_MAP`, `LEETCODE_DIFFICULTY_MAP`, `ensure_domains()` 函数

- [ ] **Step 1: 创建脚本骨架和配置常量**

创建 `app/scripts/import_leetcode.py`：

```python
#!/usr/bin/env python3
"""
LeetCode 数据集导入脚本
从 HuggingFace kaysss/leetcode-problem-set 导入编程题到知识库

用法:
  python app/scripts/import_leetcode.py                # 全量导入
  python app/scripts/import_leetcode.py --dry-run      # 干跑（仅统计）
  python app/scripts/import_leetcode.py --incremental  # 增量（跳过已有题）
"""

import sys
import os
import argparse
import logging
from typing import Optional
from collections import defaultdict

# 确保项目根目录在 sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question,
    QuestionType, QuestionDifficulty, QuestionStatus, BankVisibility,
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# ── 常量 ──

SEED_SUBJECT_ID = "d91a4645-ab5f-4819-8379-d9e6524f0937"
ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001"  # 脚本执行时动态获取

# LeetCode 标签 → KnowledgeDomain 名称映射（优先级从高到低）
TAG_DOMAIN_MAP: dict[str, str] = {
    # 精确匹配
    "Array": "数组和广义表",
    "Matrix": "数组和广义表",
    "Linked List": "线性表",
    "Stack": "栈和队列",
    "Queue": "栈和队列",
    "Monotonic Stack": "栈和队列",
    "Monotonic Queue": "栈和队列",
    "Tree": "树和二叉树",
    "Binary Tree": "树和二叉树",
    "Binary Search Tree": "树和二叉树",
    "Binary Indexed Tree": "树和二叉树",
    "Segment Tree": "树和二叉树",
    "Trie": "树和二叉树",
    "Graph": "图",
    "Breadth-First Search": "图",
    "Depth-First Search": "图",
    "Topological Sort": "图",
    "Union Find": "图",
    "Shortest Path": "图",
    "Minimum Spanning Tree": "图",
    "Binary Search": "查找",
    "Sorting": "排序",
    "Merge Sort": "排序",
    "Quickselect": "排序",
    "Bucket Sort": "排序",
    "Counting Sort": "排序",
    "Radix Sort": "排序",
    "String": "串",
    "Sliding Window": "串",
    "Two Pointers": "串",
    "Prefix Sum": "串",
    "Hash Table": "查找",
    "Hash Function": "查找",
    # 以下归入「其他算法」
    "Dynamic Programming": "其他算法",
    "Memoization": "其他算法",
    "Greedy": "其他算法",
    "Backtracking": "其他算法",
    "Recursion": "其他算法",
    "Bit Manipulation": "其他算法",
    "Math": "其他算法",
    "Geometry": "其他算法",
    "Divide and Conquer": "其他算法",
    "Heap (Priority Queue)": "其他算法",
    "Combinatorics": "其他算法",
    "Game Theory": "其他算法",
    "Brainteaser": "其他算法",
    "Simulation": "其他算法",
    "Design": "其他算法",
    "Iterator": "其他算法",
    "Data Stream": "其他算法",
    "Doubly-Linked List": "线性表",
    "Ordered Set": "其他算法",
    "Number Theory": "其他算法",
    "Counting": "其他算法",
    "Probability and Statistics": "其他算法",
    "Rejection Sampling": "其他算法",
    "Reservoir Sampling": "其他算法",
    "Randomized": "其他算法",
    "Rolling Hash": "其他算法",
    "Suffix Array": "其他算法",
    "Concurrency": "其他算法",
    "Database": "其他算法",
    "Shell": "其他算法",
    "Line Sweep": "其他算法",
    "Interactive": "其他算法",
    "Enumeration": "其他算法",
    "String Matching": "串",
    "Biconnected Component": "图",
    "Eulerian Circuit": "图",
    "Strongly Connected Component": "图",
}

# LeetCode difficulty → QuestionDifficulty 映射
LEETCODE_DIFFICULTY_MAP = {
    "Easy": QuestionDifficulty.BASIC.value,
    "Medium": QuestionDifficulty.INTERMEDIATE.value,
    "Hard": QuestionDifficulty.ADVANCED.value,
}

MAX_QUESTIONS_PER_TAG = 5  # 每个标签最多选 5 道题

# ── Domain 管理 ──

def get_or_create_domain(db: Session, domain_name: str, subject_id: str) -> KnowledgeDomain:
    """获取已有 Domain 或新建（幂等）"""
    domain = db.query(KnowledgeDomain).filter(
        KnowledgeDomain.subject_id == subject_id,
        KnowledgeDomain.name == domain_name,
    ).first()
    if domain:
        return domain

    # 计算 sort_order（放在已有 Domain 之后）
    max_order = db.query(KnowledgeDomain).filter(
        KnowledgeDomain.subject_id == subject_id,
    ).order_by(KnowledgeDomain.sort_order.desc()).first()
    sort_order = (max_order.sort_order + 1) if max_order else 0

    domain = KnowledgeDomain(
        subject_id=subject_id,
        name=domain_name,
        description=f"{domain_name}相关算法题（LeetCode 导入）",
        sort_order=sort_order,
    )
    db.add(domain)
    db.flush()  # 获取 id 但不提交
    logger.info(f"新建 Domain: {domain_name} (id={domain.id})")
    return domain


def get_or_create_knowledge_point(
    db: Session, domain_id: str, name: str, description: str, difficulty: int,
) -> KnowledgePoint:
    """获取已有 KnowledgePoint 或新建（幂等，按 name 匹配）"""
    kp = db.query(KnowledgePoint).filter(KnowledgePoint.name == name).first()
    if kp:
        # 已有则不改动（保留原有 domain 关联和描述）
        return kp

    kp = KnowledgePoint(
        domain_id=domain_id,
        name=name,
        description=description,
        difficulty=difficulty,
    )
    db.add(kp)
    db.flush()
    return kp
```

- [ ] **Step 2: Commit**

```bash
git add app/scripts/import_leetcode.py
git commit -m "feat: add LeetCode import script — config and domain helpers"
```

---

### Task 3: 数据加载 + 筛选 + 去重逻辑

**Files:**
- Modify: `app/scripts/import_leetcode.py`（追加数据加载逻辑）

**Interfaces:**
- Consumes: HuggingFace `datasets` 库
- Produces: `load_leetcode_dataset()`, `filter_and_select_questions()` 函数

- [ ] **Step 1: 追加数据加载和筛选函数**

在 `import_leetcode.py` 末尾追加：

```python
# ── 数据加载 ──

def load_leetcode_dataset() -> list[dict]:
    """从 HuggingFace 加载 LeetCode 数据集，降级到本地文件"""
    try:
        from datasets import load_dataset
        logger.info("正在从 HuggingFace 加载 kaysss/leetcode-problem-set ...")
        ds = load_dataset("kaysss/leetcode-problem-set", split="train")
        data = [dict(item) for item in ds]
        logger.info(f"成功加载 {len(data)} 道题目")
        return data
    except Exception as e:
        logger.warning(f"HuggingFace 加载失败: {e}")
        # 降级：尝试本地 JSON 文件
        local_path = os.path.join(os.path.dirname(__file__), "leetcode_dataset.json")
        if os.path.exists(local_path):
            import json
            with open(local_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            logger.info(f"从本地文件加载 {len(data)} 道题目")
            return data
        raise RuntimeError(f"无法加载 LeetCode 数据集: {e}. 请手动下载并放置到 {local_path}")


def normalize_tags(raw_topics: list[str] | str | None) -> list[str]:
    """统一标签格式（处理嵌套列表、逗号分隔字符串等）"""
    if raw_topics is None:
        return []
    if isinstance(raw_topics, str):
        return [t.strip() for t in raw_topics.split(",") if t.strip()]
    # 可能是嵌套列表
    result = []
    for item in raw_topics:
        if isinstance(item, str):
            result.append(item.strip())
        elif isinstance(item, list):
            result.extend(normalize_tags(item))
    return result


def select_questions(data: list[dict]) -> list[dict]:
    """
    筛选题目：每个标签最多 MAX_QUESTIONS_PER_TAG 道，优先高通过率 + 经典题（低题号）

    Returns:
        去重后的题目列表（每道题只出现一次，归入第一个匹配到的标签对应的 Domain）
    """
    # Step 1: 归一化标签
    tag_problems: dict[str, list[dict]] = defaultdict(list)
    for item in data:
        tags = normalize_tags(item.get("topic_tags", item.get("tags", [])))
        for tag in tags:
            tag_problems[tag].append(item)

    logger.info(f"标签总数: {len(tag_problems)}")

    # Step 2: 每个标签内排序（高通过率优先，然后低题号优先）
    for tag in tag_problems:
        tag_problems[tag].sort(key=lambda p: (
            -(p.get("ac_rate", p.get("acceptance_rate", 50)) or 50),  # 通过率高优先
            int(p.get("id", p.get("frontend_question_id", 9999)) or 9999),  # 低题号优先
        ))

    # Step 3: 每个标签取前 MAX_QUESTIONS_PER_TAG 道
    selected_per_tag: dict[str, list[dict]] = {}
    for tag, problems in tag_problems.items():
        selected_per_tag[tag] = problems[:MAX_QUESTIONS_PER_TAG]
        logger.info(f"  标签 [{tag}]: 共 {len(problems)} 题 → 选取 {len(selected_per_tag[tag])} 题")

    # Step 4: 去重 — 按 LeetCode ID 去重，保留首次出现的标签归属
    seen_ids: set[int] = set()
    result: list[dict] = []
    # 按照 TAG_DOMAIN_MAP 的顺序遍历标签（保证优先级）
    for tag in TAG_DOMAIN_MAP:
        if tag not in selected_per_tag:
            continue
        for problem in selected_per_tag[tag]:
            problem_id = int(problem.get("id", problem.get("frontend_question_id", 0)))
            if problem_id not in seen_ids:
                seen_ids.add(problem_id)
                problem["_assigned_domain"] = TAG_DOMAIN_MAP[tag]
                problem["_all_tags"] = normalize_tags(
                    problem.get("topic_tags", problem.get("tags", []))
                )
                result.append(problem)

    logger.info(f"去重后总题数: {len(result)}")
    return result
```

- [ ] **Step 2: Commit**

```bash
git add app/scripts/import_leetcode.py
git commit -m "feat: add LeetCode dataset loading and question selection logic"
```

---

### Task 4: AI 摘要生成 + 数据库写入 + Neo4j 同步

**Files:**
- Modify: `app/scripts/import_leetcode.py`（追加 AI 摘要和数据库写入逻辑）

**Interfaces:**
- Consumes: LLM API（`settings.LLM_API_KEY`/`LLM_API_URL`/`LLM_MODEL`），SQLAlchemy Session，Neo4j
- Produces: `generate_chinese_summary()`, `import_questions()`, `main()`

- [ ] **Step 1: 追加 AI 摘要生成和数据库写入函数**

在 `import_leetcode.py` 末尾追加：

```python
# ── AI 摘要生成 ──

SUMMARY_PROMPT = """你是一个算法教学助手。请根据以下 LeetCode 题目信息，用中文写出 1-2 句简短摘要，说明题目的核心问题和典型解法思路。

标题：{title}
标签：{tags}
难度：{difficulty}

要求：
1. 只用 1-2 句话，不超过 80 字
2. 点出核心问题 + 常见解法（如"双指针""哈希表""动态规划"等）
3. 不要翻译整个题干
4. 适合在题库中作为题目简介展示
"""


def generate_chinese_summary(
    title: str, tags: list[str], difficulty: str,
) -> str:
    """调用 LLM 生成中文摘要"""
    from app.core.config import settings

    api_key = getattr(settings, "LLM_API_KEY", os.getenv("LLM_API_KEY", ""))
    api_url = getattr(settings, "LLM_API_URL", os.getenv("LLM_API_URL", ""))
    model = getattr(settings, "LLM_MODEL", os.getenv("LLM_MODEL", "gpt-4o"))

    if not api_key or not api_url:
        logger.warning("LLM API 未配置，跳过摘要生成，使用原标题")
        return title

    prompt = SUMMARY_PROMPT.format(
        title=title,
        tags=", ".join(tags[:5]),
        difficulty=difficulty,
    )

    try:
        import httpx
        resp = httpx.post(
            api_url,
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "你是一个算法教学助手，用简洁中文回答。"},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 120,
            },
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            # 清理引号和多余空白
            content = content.strip('"').strip("'")
            if len(content) > 120:
                content = content[:117] + "..."
            return content or title
        else:
            logger.warning(f"LLM 调用失败: HTTP {resp.status_code} — {resp.text[:200]}")
            return title
    except Exception as e:
        logger.warning(f"LLM 调用异常: {e}")
        return title


# ── 数据库写入 ──

def get_admin_user_id(db: Session) -> str:
    """获取 admin 用户 ID"""
    from app.models.user import User
    admin = db.query(User).filter(User.username == "admin").first()
    if admin:
        return str(admin.id)
    # fallback: 取第一个用户
    first = db.query(User).first()
    if first:
        logger.warning("未找到 admin 用户，使用第一个用户作为题库 owner")
        return str(first.id)
    raise RuntimeError("数据库中无用户，无法创建题库")


def get_or_create_bank(db: Session, admin_id: str) -> QuestionBank:
    """获取或创建 LeetCode 公开题库（幂等，按 name 匹配）"""
    bank = db.query(QuestionBank).filter(
        QuestionBank.name == "LeetCode 算法题库",
    ).first()
    if bank:
        return bank

    bank = QuestionBank(
        owner_id=admin_id,
        subject_id=SEED_SUBJECT_ID,
        name="LeetCode 算法题库",
        description="LeetCode 经典算法编程题，含中文摘要和原题链接。每知识点最多 5 题。",
        visibility=BankVisibility.PUBLIC.value,
        tags=["leetcode", "算法", "编程"],
    )
    db.add(bank)
    db.flush()
    logger.info(f"创建题库: LeetCode 算法题库 (id={bank.id})")
    return bank


def import_questions(
    db: Session, problems: list[dict], bank_id: str, dry_run: bool = False,
    incremental: bool = False,
) -> dict:
    """
    将筛选后的题目写入数据库

    Returns:
        统计字典 {total, created, skipped, errors}
    """
    stats = {"total": len(problems), "created": 0, "skipped": 0, "errors": 0}

    # 预加载所有已有 Domain（按名称索引）
    domains = db.query(KnowledgeDomain).filter(
        KnowledgeDomain.subject_id == SEED_SUBJECT_ID,
    ).all()
    domain_index: dict[str, KnowledgeDomain] = {d.name: d for d in domains}
    logger.info(f"已加载 {len(domain_index)} 个 Domain")

    # 批量生成摘要（每 10 道 batch 延迟一次）
    import time

    for i, problem in enumerate(problems):
        leetcode_id = int(problem.get("id", problem.get("frontend_question_id", 0)))
        title = problem.get("title", f"LeetCode {leetcode_id}")
        slug = problem.get("title_slug", problem.get("slug", ""))
        url = problem.get("url", f"https://leetcode.com/problems/{slug}/")

        # 增量模式：检查是否已存在
        existing = db.query(Question).filter(
            Question.source == "leetcode_import",
            Question.content["leetcode_id"].astext.cast(int) == leetcode_id,  # JSONB 字段匹配
        ).first()
        if existing:
            stats["skipped"] += 1
            continue

        # 难度映射
        raw_difficulty = problem.get("difficulty", "Medium")
        difficulty = LEETCODE_DIFFICULTY_MAP.get(raw_difficulty, QuestionDifficulty.INTERMEDIATE.value)
        kp_difficulty = {"Easy": 2, "Medium": 3, "Hard": 5}.get(raw_difficulty, 3)

        # 标签
        tags = problem.get("_all_tags", normalize_tags(
            problem.get("topic_tags", problem.get("tags", []))
        ))
        domain_name = problem["_assigned_domain"]

        # 获取或创建 Domain
        domain = domain_index.get(domain_name)
        if not domain:
            domain = get_or_create_domain(db, domain_name, SEED_SUBJECT_ID)
            domain_index[domain_name] = domain

        # AI 摘要
        summary = generate_chinese_summary(title, tags, raw_difficulty)
        # 每 10 道题暂停一下，避免 API 限速
        if (i + 1) % 10 == 0:
            logger.info(f"  摘要生成进度: {i+1}/{len(problems)}")
            time.sleep(1)

        # KnowledgePoint
        kp_name = f"LeetCode {leetcode_id}. {title}"
        kp_desc = summary  # 知识点描述 = 中文摘要

        if dry_run:
            logger.info(f"  [DRY-RUN] {kp_name} → Domain: {domain_name}, Difficulty: {raw_difficulty}")
            stats["created"] += 1
            continue

        kp = get_or_create_knowledge_point(db, str(domain.id), kp_name, kp_desc, kp_difficulty)

        # Question
        question = Question(
            bank_id=bank_id,
            type=QuestionType.PROGRAMMING.value,
            difficulty=difficulty,
            status=QuestionStatus.PUBLISHED.value,
            source="leetcode_import",
            priority=1,
            content={
                "stem": summary,
                "source_url": url,
                "leetcode_id": leetcode_id,
                "leetcode_slug": slug,
                "acceptance_rate": problem.get("ac_rate", problem.get("acceptance_rate")),
                "difficulty_original": raw_difficulty,
            },
            answer={
                "explanation": f"请在 LeetCode 上提交你的解答：{url}",
                "suggested_time_minutes": {"Easy": 15, "Medium": 30, "Hard": 60}.get(raw_difficulty, 30),
            },
            knowledge_point_uuids=[str(kp.id)],
            tags=tags,
        )
        db.add(question)
        stats["created"] += 1

    if not dry_run:
        db.commit()
        logger.info(f"数据库提交完成: {stats['created']} 道新题, {stats['skipped']} 道跳过")

    return stats


# ── Neo4j 同步 ──

def sync_to_neo4j(db: Session) -> None:
    """将新建的 Question 和 KnowledgePoint 同步到 Neo4j"""
    from app.db.neo4j import get_neo4j

    neo4j = get_neo4j()
    if not neo4j:
        logger.warning("Neo4j 未连接，跳过同步")
        return

    leetcode_questions = db.query(Question).filter(
        Question.source == "leetcode_import",
    ).all()

    for q in leetcode_questions:
        # 复用现有的同步函数（如果存在）
        try:
            from app.api.endpoints.question_bank import (
                _sync_question_to_neo4j, _sync_point_to_neo4j,
            )
            for kp_uuid in (q.knowledge_point_uuids or []):
                kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_uuid).first()
                if kp:
                    _sync_point_to_neo4j(neo4j, kp)
            _sync_question_to_neo4j(neo4j, q, q.content, q.knowledge_point_uuids)
        except ImportError:
            logger.warning("无法导入 Neo4j 同步函数，跳过 Neo4j 同步")
            break

    logger.info(f"Neo4j 同步完成: {len(leetcode_questions)} 道题")
```

- [ ] **Step 2: Commit**

```bash
git add app/scripts/import_leetcode.py
git commit -m "feat: add AI summary generation and DB write logic for LeetCode import"
```

---

### Task 5: main 入口 + 参数解析 + 端到端验证

**Files:**
- Modify: `app/scripts/import_leetcode.py`（追加 main 入口）

**Interfaces:**
- Consumes: 以上所有模块
- Produces: `main()` 函数，支持 `--dry-run` / `--incremental` / `--batch-size` 参数

- [ ] **Step 1: 追加 main 入口**

在 `import_leetcode.py` 末尾追加：

```python
# ── 主入口 ──

def main():
    parser = argparse.ArgumentParser(description="LeetCode 数据集导入脚本")
    parser.add_argument("--dry-run", action="store_true", help="干跑模式，不写入数据库")
    parser.add_argument("--incremental", action="store_true", help="增量模式，跳过已存在的题目")
    parser.add_argument("--batch-size", type=int, default=10, help="每批处理的题目数（用于 AI 摘要限速）")
    parser.add_argument("--skip-ai", action="store_true", help="跳过 AI 摘要生成（使用标题代替）")
    parser.add_argument("--max-per-tag", type=int, default=MAX_QUESTIONS_PER_TAG,
                        help=f"每个标签最多选择的题目数（默认 {MAX_QUESTIONS_PER_TAG}）")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("LeetCode 数据集导入")
    logger.info(f"  模式: {'DRY-RUN' if args.dry_run else '增量' if args.incremental else '全量'}")
    logger.info(f"  每标签上限: {args.max_per_tag} 题")
    logger.info(f"  AI 摘要: {'禁用' if args.skip_ai else '启用'}")
    logger.info("=" * 60)

    # 1. 加载数据
    raw_data = load_leetcode_dataset()
    if not raw_data:
        logger.error("数据集为空")
        sys.exit(1)

    # 2. 筛选 + 去重
    selected = select_questions(raw_data)
    logger.info(f"筛选后: {len(selected)} 道题")

    # 3. 按 Domain 统计
    domain_counts: dict[str, int] = defaultdict(int)
    for p in selected:
        domain_counts[p["_assigned_domain"]] += 1
    logger.info("各 Domain 题目数:")
    for d, c in sorted(domain_counts.items(), key=lambda x: -x[1]):
        logger.info(f"  {d}: {c} 题")

    if args.dry_run:
        logger.info("DRY-RUN 完成，未写入数据库")
        return

    # 4. 数据库导入
    db = SessionLocal()
    try:
        # 获取 admin
        admin_id = get_admin_user_id(db)
        logger.info(f"题库 owner: {admin_id}")

        # 创建题库
        bank = get_or_create_bank(db, admin_id)

        # 导入题目
        stats = import_questions(db, selected, str(bank.id),
                                 dry_run=False, incremental=args.incremental)

        # 输出统计
        logger.info("=" * 60)
        logger.info(f"导入完成: 共 {stats['total']} 题")
        logger.info(f"  新建: {stats['created']}")
        logger.info(f"  跳过: {stats['skipped']}")
        logger.info(f"  错误: {stats['errors']}")
        logger.info("=" * 60)

        # 5. Neo4j 同步
        logger.info("开始 Neo4j 同步...")
        sync_to_neo4j(db)
        logger.info("Neo4j 同步完成")

    except Exception as e:
        logger.error(f"导入失败: {e}", exc_info=True)
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 确保脚本路径正确 — 更新 sys.path**

脚本头的 `sys.path.insert` 路径需要能正确导入 `app` 模块。验证方式：

```bash
docker-compose exec backend python -c "import app.db.database; print('import OK')"
```

期望输出：`import OK`

- [ ] **Step 3: Dry-run 测试**

```bash
docker-compose exec backend python app/scripts/import_leetcode.py --dry-run
```

期望输出：
- 加载数据集
- 打印各 Domain 题目数统计
- 最后显示 "DRY-RUN 完成，未写入数据库"

- [ ] **Step 4: 全量导入测试**

```bash
docker-compose exec backend python app/scripts/import_leetcode.py
```

期望输出：
- 新建/跳过题目数量统计
- 创建「LeetCode 算法题库」
- 创建/复用「其他算法」Domain
- 数据库中有 ~200-250 道 programming 题
- Neo4j 同步完成

- [ ] **Step 5: 验证数据库数据**

```bash
# 验证题库
docker-compose exec backend python -c "
from app.db.database import SessionLocal
from app.models.question_bank import QuestionBank, Question
db = SessionLocal()
bank = db.query(QuestionBank).filter(QuestionBank.name == 'LeetCode 算法题库').first()
print(f'题库: {bank.name}, 公开: {bank.visibility}')
questions = db.query(Question).filter(Question.source == 'leetcode_import').all()
print(f'题目总数: {len(questions)}')
# 按 Domain 统计
from app.models.question_bank import KnowledgePoint, KnowledgeDomain
kps = set()
for q in questions:
    for kp_id in (q.knowledge_point_uuids or []):
        kps.add(kp_id)
print(f'关联知识点数: {len(kps)}')
db.close()
"
```

- [ ] **Step 6: 增量导入测试（幂等性）**

```bash
docker-compose exec backend python app/scripts/import_leetcode.py --incremental
```

期望输出：`跳过: N`（所有题已存在）

- [ ] **Step 7: 验证前端可见性**

用 `guoketg` / `123456` 登录 `http://localhost:3000/banks` 确认：
- LeetCode 算法题库出现在列表
- 点进去能看到知识点树和题目

- [ ] **Step 8: Commit**

```bash
git add app/scripts/import_leetcode.py
git commit -m "feat: add main entry point and CLI for LeetCode import"
```

---

## 完成检查清单

- [ ] `requirements.txt` 包含 `datasets` 依赖
- [ ] `docker-compose exec backend python app/scripts/import_leetcode.py --dry-run` 执行成功
- [ ] `docker-compose exec backend python app/scripts/import_leetcode.py` 全量导入成功
- [ ] 数据库有「LeetCode 算法题库」(visibility=public)
- [ ] 新建「其他算法」Domain 存在于数据结构 Subject 下
- [ ] 每个标签最多 5 题
- [ ] 每道题有中文摘要、LeetCode 链接、标签
- [ ] 增量导入幂等
- [ ] Neo4j Question[:TESTS]→KnowledgePoint 关系正确
- [ ] 前端 `/banks` 可见 LeetCode 题库（非 owner 用户也能看到）
- [ ] AI 摘要生成失败时降级为标题
