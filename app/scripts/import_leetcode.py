#!/usr/bin/env python3
"""
LeetCode 数据集导入脚本
从 HuggingFace kaysss/leetcode-problem-set 导入编程题到知识库

用法:
  python app/scripts/import_leetcode.py                # 全量导入
  python app/scripts/import_leetcode.py --dry-run      # 干跑（仅统计）
  python app/scripts/import_leetcode.py --incremental  # 增量（跳过已有题）
  python app/scripts/import_leetcode.py --skip-ai      # 跳过 AI 摘要
"""

import sys
import os
import time
import argparse
import logging
from typing import Optional
from collections import defaultdict

# 确保项目根目录在 sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.neo4j import get_neo4j
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question,
    QuestionType, QuestionDifficulty, QuestionStatus, BankVisibility,
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
# 配置常量
# ═══════════════════════════════════════════════════════════════════

# 目标 Subject — 「数据结构」（与 seed.py / seed_data JSON 一致）
SEED_SUBJECT_ID = "d91a4645-ab5f-4819-8379-d9e6524f0937"

# LeetCode 标签 → KnowledgeDomain 名称映射（优先级从高到低）
TAG_DOMAIN_MAP: dict[str, str] = {
    # ── 精确匹配 ──
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
    # ── 以下归入「其他算法」─
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

# ═══════════════════════════════════════════════════════════════════
# Domain / KnowledgePoint 管理（幂等操作）
# ═══════════════════════════════════════════════════════════════════

def get_or_create_domain(db: Session, domain_name: str, subject_id: str) -> KnowledgeDomain:
    """获取已有 Domain 或新建（幂等，按 subject_id + name 匹配）"""
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
    logger.info(f"  新建 Domain: {domain_name} (id={domain.id})")
    return domain


def get_or_create_knowledge_point(
    db: Session, domain_id: str, name: str, description: str, difficulty: int,
) -> KnowledgePoint:
    """获取已有 KnowledgePoint 或新建（幂等，按 name 匹配）"""
    kp = db.query(KnowledgePoint).filter(KnowledgePoint.name == name).first()
    if kp:
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


# ═══════════════════════════════════════════════════════════════════
# 数据加载
# ═══════════════════════════════════════════════════════════════════

def _normalize_problem_fields(item: dict) -> dict:
    """
    将 HuggingFace 数据集的 camelCase 字段统一转换为 snake_case，
    并解析 topicTags 字符串为 Python 列表。
    """
    import ast

    # 解析 topicTags — 数据集存储为 Python 列表字符串如 "['Array', 'Hash Table']"
    tags_raw = item.get("topicTags", item.get("topic_tags", []))
    if isinstance(tags_raw, str):
        try:
            parsed = ast.literal_eval(tags_raw)
            if isinstance(parsed, list):
                tags_raw = [str(t).strip() for t in parsed if t]
            else:
                tags_raw = [t.strip() for t in tags_raw.split(",") if t.strip()]
        except (ValueError, SyntaxError):
            tags_raw = [t.strip() for t in tags_raw.split(",") if t.strip()]
    elif not isinstance(tags_raw, list):
        tags_raw = []

    title_slug = item.get("titleSlug", item.get("title_slug", ""))

    return {
        "id": int(item.get("frontendQuestionId", item.get("id", 0)) or 0),
        "title": item.get("title", ""),
        "title_slug": title_slug,
        "difficulty": item.get("difficulty", "Medium"),
        "ac_rate": float(item.get("acRate", item.get("ac_rate", item.get("acceptance_rate", 50))) or 50),
        "topic_tags": tags_raw,
        "url": f"https://leetcode.com/problems/{title_slug}/" if title_slug else "",
    }


def load_leetcode_dataset() -> list[dict]:
    """从 HuggingFace 加载 LeetCode 数据集，字段归一化后返回；失败时降级到本地文件"""
    try:
        from datasets import load_dataset
        logger.info("正在从 HuggingFace 加载 kaysss/leetcode-problem-set ...")
        ds = load_dataset("kaysss/leetcode-problem-set", split="train")
        data = [_normalize_problem_fields(dict(item)) for item in ds]
        logger.info(f"成功加载 {len(data)} 道题目")
        return data
    except Exception as e:
        logger.warning(f"HuggingFace 加载失败: {e}")
        # 降级：尝试本地 JSON 文件
        local_path = os.path.join(os.path.dirname(__file__), "leetcode_dataset.json")
        if os.path.exists(local_path):
            import json
            with open(local_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            data = [_normalize_problem_fields(item) for item in raw]
            logger.info(f"从本地文件加载 {len(data)} 道题目")
            return data
        raise RuntimeError(f"无法加载 LeetCode 数据集: {e}. 请手动下载并放置到 {local_path}")


def normalize_tags(raw_topics: list[str] | str | None) -> list[str]:
    """统一标签格式（处理 Python 列表字符串、嵌套列表、逗号分隔字符串等）"""
    if raw_topics is None:
        return []
    if isinstance(raw_topics, str):
        # 尝试解析 Python 列表字符串如 "['Array', 'Hash Table']"
        import ast
        try:
            parsed = ast.literal_eval(raw_topics)
            if isinstance(parsed, list):
                return [str(t).strip() for t in parsed if t]
        except (ValueError, SyntaxError):
            pass
        return [t.strip() for t in raw_topics.split(",") if t.strip()]
    # 已经是列表
    result = []
    for item in raw_topics:
        if isinstance(item, str):
            result.append(item.strip())
        elif isinstance(item, list):
            result.extend(normalize_tags(item))
    return result


# ═══════════════════════════════════════════════════════════════════
# 题目筛选 & 去重
# ═══════════════════════════════════════════════════════════════════

def select_questions(data: list[dict], max_per_tag: int = MAX_QUESTIONS_PER_TAG) -> list[dict]:
    """
    筛选题目：每个标签最多 max_per_tag 道，优先高通过率 + 经典题（低题号）

    Returns:
        去重后的题目列表（每道题只出现一次，归入第一个匹配到的标签对应的 Domain）
    """
    # Step 1: 归一化标签 → 按标签分组
    tag_problems: dict[str, list[dict]] = defaultdict(list)
    for item in data:
        tags = normalize_tags(item.get("topic_tags", item.get("tags", [])))
        for tag in tags:
            tag_problems[tag].append(item)

    logger.info(f"标签总数: {len(tag_problems)}")

    # Step 2: 每个标签内排序（高通过率优先，然后低题号优先）
    for tag in tag_problems:
        tag_problems[tag].sort(key=lambda p: (
            -(p.get("ac_rate", p.get("acceptance_rate", 50)) or 50),
            int(p.get("id", p.get("frontend_question_id", 9999)) or 9999),
        ))

    # Step 3: 每个标签取前 max_per_tag 道
    selected_per_tag: dict[str, list[dict]] = {}
    for tag, problems in tag_problems.items():
        selected_per_tag[tag] = problems[:max_per_tag]
        logger.info(f"  标签 [{tag}]: 共 {len(problems)} 题 → 选取 {len(selected_per_tag[tag])} 题")

    # Step 4: 去重 — 按 LeetCode ID 去重，保留首次出现的标签归属（按 TAG_DOMAIN_MAP 顺序）
    seen_ids: set[int] = set()
    result: list[dict] = []
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


# ═══════════════════════════════════════════════════════════════════
# AI 摘要生成
# ═══════════════════════════════════════════════════════════════════

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
    """调用 LLM 生成中文摘要（优先使用 DeepSeek 配置）"""
    from app.core.config import settings

    # 优先使用 DeepSeek，其次 Qwen
    api_key = settings.DEEPSEEK_API_KEY or settings.QWEN_API_KEY or os.getenv("LLM_API_KEY", "")
    base_url = settings.DEEPSEEK_BASE_URL or settings.QWEN_BASE_URL or os.getenv("LLM_API_URL", "")
    model = settings.DEEPSEEK_MODEL or os.getenv("LLM_MODEL", "")

    # 如果 DeepSeek 没配但 Qwen 配了，使用 Qwen
    if not api_key or not base_url:
        api_key = settings.QWEN_API_KEY
        base_url = settings.QWEN_BASE_URL
        model = settings.QWEN_MODEL

    if not api_key or not base_url:
        logger.warning("LLM API 未配置，跳过摘要生成，使用标题")
        return title

    # 确保 URL 以 /chat/completions 结尾
    api_url = base_url.rstrip("/") if base_url.endswith("/chat/completions") else base_url.rstrip("/") + "/chat/completions"

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


# ═══════════════════════════════════════════════════════════════════
# 数据库写入
# ═══════════════════════════════════════════════════════════════════

def get_admin_user_id(db: Session) -> str:
    """获取 admin 用户 ID，优先 admin 角色用户，否则取第一个用户"""
    from app.models.user import User
    admin = db.query(User).filter(User.username == "admin").first()
    if admin:
        return str(admin.id)
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
        logger.info(f"题库已存在: LeetCode 算法题库 (id={bank.id})")
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


def _question_exists(db: Session, leetcode_id: int) -> bool:
    """检查 LeetCode 题目是否已存在（通过 content JSONB 字段查询）"""
    # 查询 source == "leetcode_import" 的题目，Python 侧检查 leetcode_id
    existing = db.query(Question).filter(
        Question.source == "leetcode_import",
    ).all()
    for q in existing:
        if q.content and isinstance(q.content, dict) and q.content.get("leetcode_id") == leetcode_id:
            return True
    return False


def import_questions(
    db: Session, problems: list[dict], bank_id: str, dry_run: bool = False,
    incremental: bool = False, skip_ai: bool = False,
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
    logger.info(f"已加载 {len(domain_index)} 个现有 Domain")

    for i, problem in enumerate(problems):
        try:
            leetcode_id = int(problem.get("id", problem.get("frontend_question_id", 0)))
            title = problem.get("title", f"LeetCode {leetcode_id}")
            slug = problem.get("title_slug", problem.get("slug", ""))
            url = problem.get("url", f"https://leetcode.com/problems/{slug}/")

            # 增量模式：检查是否已存在
            if incremental and _question_exists(db, leetcode_id):
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

            # AI 摘要（跳过则使用标题）
            if skip_ai:
                summary = title
            else:
                summary = generate_chinese_summary(title, tags, raw_difficulty)

            # 每 10 道题暂停一下，避免 API 限速
            if not skip_ai and (i + 1) % 10 == 0:
                logger.info(f"  摘要生成进度: {i+1}/{len(problems)}")
                time.sleep(1)

            # KnowledgePoint
            kp_name = f"LeetCode {leetcode_id}. {title}"
            kp_desc = summary

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

        except Exception as e:
            logger.error(f"导入题目失败 [LeetCode {problem.get('id', '?')}]: {e}")
            stats["errors"] += 1

    if not dry_run:
        db.commit()
        logger.info(f"数据库提交完成: {stats['created']} 道新题, {stats['skipped']} 道跳过, {stats['errors']} 道错误")

    return stats


# ═══════════════════════════════════════════════════════════════════
# Neo4j 同步
# ═══════════════════════════════════════════════════════════════════

def sync_to_neo4j(db: Session) -> None:
    """将 leetcode_import 题目、Domain、KnowledgePoint 同步到 Neo4j"""
    neo4j = get_neo4j()
    if not neo4j:
        logger.warning("Neo4j 未连接，跳过同步")
        return

    # 尝试导入同步函数
    try:
        from app.api.endpoints.question_bank import (
            _sync_question_to_neo4j, _sync_point_to_neo4j, _sync_domain_to_neo4j,
        )
    except ImportError:
        logger.warning("无法导入 Neo4j 同步函数，跳过 Neo4j 同步")
        return

    # Step 1: 同步所有涉及到的 Domain 到 Neo4j（必须先于 KnowledgePoint）
    leetcode_questions = db.query(Question).filter(
        Question.source == "leetcode_import",
    ).all()

    if not leetcode_questions:
        logger.info("没有需要同步的题目")
        return

    # 收集所有涉及的知识点
    all_kp_uuids = set()
    for q in leetcode_questions:
        for kp_uuid in (q.knowledge_point_uuids or []):
            all_kp_uuids.add(kp_uuid)

    # 收集所有涉及的 Domain（按 domain_id 去重）
    synced_domains = set()
    for kp_uuid in all_kp_uuids:
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_uuid).first()
        if kp and kp.domain_id not in synced_domains:
            domain = db.query(KnowledgeDomain).filter(KnowledgeDomain.id == kp.domain_id).first()
            if domain:
                try:
                    _sync_domain_to_neo4j(neo4j, domain, domain.subject_id)
                    synced_domains.add(kp.domain_id)
                except Exception as e:
                    logger.warning(f"Neo4j 同步 Domain {domain.name} 失败: {e}")

    logger.info(f"已同步 {len(synced_domains)} 个 Domain 到 Neo4j")

    # Step 2: 同步 KnowledgePoint
    synced_kps = set()
    for kp_uuid in all_kp_uuids:
        kp = db.query(KnowledgePoint).filter(KnowledgePoint.id == kp_uuid).first()
        if kp:
            try:
                _sync_point_to_neo4j(neo4j, kp, kp.domain_id)
                synced_kps.add(kp_uuid)
            except Exception as e:
                logger.warning(f"Neo4j 同步知识点 {kp.name} 失败: {e}")

    logger.info(f"已同步 {len(synced_kps)} 个知识点到 Neo4j")

    # Step 3: 同步 Question + TESTS 关系
    synced_questions = 0
    for q in leetcode_questions:
        try:
            _sync_question_to_neo4j(neo4j, q)
            synced_questions += 1
        except Exception as e:
            logger.warning(f"Neo4j 同步题目 {q.id} 失败: {e}")

    logger.info(f"Neo4j 同步完成: {synced_questions} 道题, {len(synced_kps)} 个知识点, {len(synced_domains)} 个 Domain")


# ═══════════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="LeetCode 数据集导入脚本")
    parser.add_argument("--dry-run", action="store_true", help="干跑模式，不写入数据库")
    parser.add_argument("--incremental", action="store_true", help="增量模式，跳过已存在的题目")
    parser.add_argument("--batch-size", type=int, default=10, help="每批处理的题目数（用于 AI 摘要限速）")
    parser.add_argument("--skip-ai", action="store_true", help="跳过 AI 摘要生成（使用标题代替）")
    parser.add_argument("--max-per-tag", type=int, default=MAX_QUESTIONS_PER_TAG,
                        help=f"每个标签最多选择的题目数（默认 {MAX_QUESTIONS_PER_TAG}）")
    args = parser.parse_args()

    mode_text = "DRY-RUN" if args.dry_run else ("增量" if args.incremental else "全量")
    logger.info("=" * 60)
    logger.info("LeetCode 数据集导入")
    logger.info(f"  模式: {mode_text}")
    logger.info(f"  每标签上限: {args.max_per_tag} 题")
    logger.info(f"  AI 摘要: {'禁用' if args.skip_ai else '启用'}")
    logger.info("=" * 60)

    # 1. 加载数据
    raw_data = load_leetcode_dataset()
    if not raw_data:
        logger.error("数据集为空")
        sys.exit(1)

    # 2. 筛选 + 去重
    selected = select_questions(raw_data, max_per_tag=args.max_per_tag)
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

        # 创建/获取题库
        bank = get_or_create_bank(db, admin_id)

        # 导入题目
        stats = import_questions(
            db, selected, str(bank.id),
            dry_run=False, incremental=args.incremental, skip_ai=args.skip_ai,
        )

        # 输出统计
        logger.info("=" * 60)
        logger.info(f"导入完成: 共 {stats['total']} 题")
        logger.info(f"  新建: {stats['created']}")
        logger.info(f"  跳过: {stats['skipped']}")
        logger.info(f"  错误: {stats['errors']}")
        logger.info("=" * 60)

        # 更新题库题目计数
        bank.total_questions = db.query(Question).filter(
            Question.bank_id == bank.id,
            Question.source == "leetcode_import",
        ).count()
        db.commit()
        logger.info(f"题库题目计数已更新: {bank.total_questions}")

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
