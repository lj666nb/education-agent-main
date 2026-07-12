#!/usr/bin/env python3
"""
客观题库爬取脚本 — 从 dotcpp.com 数据结构试卷爬取客观题
dotcpp 有 10 套公开的数据结构试卷（选择题+判断题），通过 paper/preview API 获取，无需登录。

用法:
  python app/scripts/import_objective_questions.py              # 全量爬取导入
  python app/scripts/import_objective_questions.py --dry-run    # 干跑预览
  python app/scripts/import_objective_questions.py --domain 树和二叉树  # 仅指定章节
"""

import sys
import os
import time
import argparse
import json
import logging
import re
import uuid as _uuid_mod
from typing import Optional
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import httpx
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question,
)
from app.models.user import User
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════════

SEED_BANK_ID = "2ce6ee7d-ed5a-42a1-8a26-6ad6856afd3e"
API_PREVIEW = "https://www.dotcpp.com/addons/exam/paper/preview"
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

# dotcpp 试卷 ID → 本地章节名称映射
PAPER_MAP = [
    {"paper_id": 1082, "domain": "绪论",       "label": "数据结构基本概念测试题",       "count": 20},
    {"paper_id": 1081, "domain": "线性表",      "label": "数据结构线性表测试题",         "count": 20},
    {"paper_id": 1080, "domain": "栈和队列",    "label": "数据结构栈与队列测试题",       "count": 20},
    {"paper_id": 1079, "domain": "串",         "label": "数据结构串测试题",             "count": 20},
    {"paper_id": 1077, "domain": "树和二叉树",  "label": "数据结构二叉树与树表测试题",    "count": 31},
    {"paper_id": 1076, "domain": "图",         "label": "数据结构图测试题",             "count": 31},
    {"paper_id": 1075, "domain": "查找",       "label": "数据结构查找测试题",           "count": 28},
    {"paper_id": 1074, "domain": "排序",       "label": "数据结构排序测试题",           "count": 21},
    {"paper_id": 1078, "domain": None,         "label": "数据结构期中测试题",           "count": 40},   # 综合题，按标题关键词分配
    {"paper_id": 1073, "domain": None,         "label": "数据结构期末测试题",           "count": 70},   # 综合题，按标题关键词分配
]

# dotcpp question kind → 本地类型
KIND_MAP = {
    "SINGLE": "single_choice",
    "JUDGE": "true_false",
    "MULTI": "multiple_choice",
}

# dotcpp difficulty → 本地难度
DIFFICULTY_MAP = {
    "EASY": "beginner",
    "GENERAL": "basic",
    "HARD": "intermediate",
}


def strip_html(text: str) -> str:
    """去除 HTML 标签，保留纯文本。"""
    if not text:
        return ""
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</?p[^>]*>', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&amp;', '&').replace('&quot;', '"')
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def parse_options(options_json) -> list[dict]:
    """解析 dotcpp 的 options_json 字段。"""
    if isinstance(options_json, list):
        return [{"key": str(o.get("key", "")), "text": strip_html(str(o.get("value", o.get("text", ""))))}
                for o in options_json]
    if isinstance(options_json, str):
        try:
            parsed = json.loads(options_json)
            if isinstance(parsed, list):
                return [{"key": str(o.get("key", "")), "text": strip_html(str(o.get("value", o.get("text", ""))))}
                        for o in parsed]
        except (json.JSONDecodeError, TypeError):
            pass
    return []


def resolve_subject_id(db: Session) -> Optional[str]:
    """动态解析「数据结构」学科 ID。"""
    subject = db.query(Subject).filter(Subject.name == "数据结构").first()
    return str(subject.id) if subject else None


def load_domain_map(db: Session, subject_id: str) -> dict:
    """加载章节名称 → ID 映射。"""
    domains = db.query(KnowledgeDomain).filter(
        KnowledgeDomain.subject_id == subject_id
    ).all()
    return {d.name: str(d.id) for d in domains}


def load_kp_map(db: Session, subject_id: str) -> dict:
    """加载知识点名称 → {uuid, domain_name} 映射（用于关键词匹配分配知识点）。"""
    points = (
        db.query(KnowledgePoint).join(KnowledgeDomain)
        .filter(KnowledgeDomain.subject_id == subject_id)
        .all()
    )
    kp_map = {}
    for pt in points:
        kp_map[pt.name] = {"uuid": str(pt.id), "domain_name": pt.domain.name}
    return kp_map


def load_existing_source_ids(db: Session) -> set:
    """获取已导入的 dotcpp 题目 source ID。"""
    questions = db.query(Question).filter(
        Question.source == "dotcpp_exam",
        Question.type.in_(["single_choice", "multiple_choice", "true_false", "fill_blank"]),
    ).all()
    ids = set()
    for q in questions:
        c = q.content or {}
        sid = c.get("source_question_id", "")
        if sid:
            ids.add(sid)
    return ids


def match_knowledge_point(stem: str, domain_name: str, kp_map: dict) -> Optional[str]:
    """根据题干关键词匹配最相关的知识点 UUID。"""
    # 过滤出属于该章节的知识点
    candidates = [(name, info) for name, info in kp_map.items()
                  if info["domain_name"] == domain_name]
    if not candidates:
        # 如果该章节没有知识点，返回该章节任意知识点
        candidates = [(name, info) for name, info in kp_map.items()
                      if info["domain_name"] == domain_name]

    # 按关键词匹配
    best_match = None
    best_score = 0
    for kp_name, info in candidates:
        score = 0
        # 简单的关键词匹配
        for char in kp_name:
            if char in stem:
                score += 1
        # 如果知识点名在题干中出现（子串匹配），加分
        for word in re.split(r'[，。、；：\s]+', kp_name):
            if len(word) >= 2 and word in stem:
                score += 5
        if score > best_score:
            best_score = score
            best_match = info["uuid"]

    # 如果没匹配到，返回该章节第一个知识点
    if not best_match and candidates:
        best_match = candidates[0][1]["uuid"]
    return best_match


def classify_by_keywords(stem: str, kp_map: dict) -> Optional[str]:
    """对综合试卷（期中/期末），根据题干关键词分配到最合适的章节。"""
    # 关键词 → 章节映射
    keyword_domain = [
        (["基本概念", "数据", "结构", "算法", "时间复杂度", "空间复杂度", "逻辑结构", "存储结构", "抽象数据类型"], "绪论"),
        (["线性表", "顺序表", "链表", "单链表", "双向链表", "循环链表", "头结点", "头指针"], "线性表"),
        (["栈", "队列", "出栈", "入栈", "出队", "入队", "循环队列", "链栈", "表达式求值", "后缀表达式"], "栈和队列"),
        (["串", "模式匹配", "KMP", "子串", "字符串", "next"], "串"),
        (["数组", "广义表", "稀疏矩阵", "三元组", "十字链表", "对称矩阵"], "数组和广义表"),
        (["二叉树", "树", "先序", "中序", "后序", "层序", "遍历", "哈夫曼", "线索", "森林", "叶子", "结点", "深度", "高度", "平衡二叉树", "二叉排序树", "BST", "B树", "B+树", "堆"], "树和二叉树"),
        (["图", "有向", "无向", "邻接", "深度优先", "广度优先", "DFS", "BFS", "拓扑", "最短路径", "最小生成树", "关键路径", "连通", "度"], "图"),
        (["查找", "哈希", "散列", "二分", "顺序查找", "折半", "冲突", "ASL", "二叉排序树", "平衡", "B树", "B+树", "索引"], "查找"),
        (["排序", "冒泡", "快速", "插入", "希尔", "选择", "堆排", "归并", "基数", "稳定", "交换", "比较"], "排序"),
    ]
    for keywords, domain in keyword_domain:
        for kw in keywords:
            if kw in stem:
                return domain
    return None


def scrape_all_papers(domain_filter: str = None) -> list[dict]:
    """爬取所有 dotcpp 试卷的客观题。"""
    all_questions = []
    with httpx.Client(headers=HTTP_HEADERS, follow_redirects=True, timeout=30) as client:
        for paper in PAPER_MAP:
            # 章节筛选
            if domain_filter and paper["domain"] and paper["domain"] != domain_filter:
                continue
            # 对于综合试卷，如果指定了章节则也包含（通过关键词匹配分配）
            # 如果指定了章节且当前试卷是无固定章节的综合卷，也要爬取

            pid = paper["paper_id"]
            label = paper["label"]
            assigned_domain = paper["domain"]

            try:
                # 先访问试卷页面获取 cookie
                page_url = f"https://www.dotcpp.com/exam/{pid}/"
                client.get(page_url)
                time.sleep(0.5)

                # 调用 preview API
                api_url = f"{API_PREVIEW}?paper_id={pid}"
                resp = client.get(api_url)
                if resp.status_code != 200:
                    logger.warning(f"  [{label}] API 返回 {resp.status_code}")
                    continue

                data = resp.json()
                if data.get("code") != 1:
                    logger.warning(f"  [{label}] API code={data.get('code')}")
                    continue

                questions = data["data"].get("questions", [])
                logger.info(f"  [{label}] 获取 {len(questions)} 题 (kind={pid})")

                for q in questions:
                    qid = str(q.get("id", ""))
                    kind = q.get("kind", "SINGLE")
                    qtype = KIND_MAP.get(kind)
                    if not qtype:
                        # 跳过不支持的类型
                        continue

                    stem = strip_html(q.get("title", ""))
                    if not stem or len(stem) < 5:
                        continue

                    options = parse_options(q.get("options_json"))
                    answer_raw = str(q.get("answer", "")).strip()
                    explanation = strip_html(q.get("explain", ""))
                    difficulty_raw = q.get("difficulty", "GENERAL")

                    # 解析正确答案
                    correct_answers = []
                    if qtype == "true_false":
                        # dotcpp 的判断题：answer="A" 表示对，"B" 表示错
                        if answer_raw == "A":
                            correct_answers = ["对"]
                        elif answer_raw == "B":
                            correct_answers = ["错"]
                        else:
                            correct_answers = ["对"]  # fallback
                    elif qtype in ("single_choice", "multiple_choice"):
                        correct_answers = [a.strip() for a in answer_raw.split(",") if a.strip()]

                    if not correct_answers:
                        continue

                    difficulty = DIFFICULTY_MAP.get(difficulty_raw, "basic")

                    all_questions.append({
                        "type": qtype,
                        "content": {
                            "stem": stem,
                            "options": options if qtype != "true_false" else [
                                {"key": "A", "text": "对"},
                                {"key": "B", "text": "错"},
                            ],
                            "source_question_id": f"dotcpp_{pid}_{qid}",
                        },
                        "answer": {
                            "correct_answer": correct_answers,
                            "explanation": explanation,
                        },
                        "difficulty": difficulty,
                        "source": "dotcpp_exam",
                        "ai_generated": False,
                        "assigned_domain": assigned_domain,
                        "paper_label": label,
                    })

                time.sleep(0.5)  # 请求间隔

            except Exception as e:
                logger.error(f"  [{label}] 爬取失败: {e}")
                continue

    return all_questions


def import_question(db: Session, neo4j: Neo4jConnection, q_data: dict, bank_id: str,
                    kp_uuids: list[str]):
    """导入单道题目到 PostgreSQL + Neo4j。"""
    question = Question(
        id=_uuid_mod.uuid4(),
        bank_id=bank_id,
        type=q_data["type"],
        difficulty=q_data.get("difficulty", "basic"),
        status="published",
        priority=0,
        content=q_data["content"],
        answer=q_data["answer"],
        knowledge_point_uuids=kp_uuids,
        tags=[q_data.get("assigned_domain", ""), "dotcpp爬取", "客观题"],
        ai_generated=False,
        source="dotcpp_exam",
    )
    db.add(question)
    db.commit()
    db.refresh(question)

    # 同步到 Neo4j
    try:
        with neo4j.connect().session() as neo_session:
            neo_session.run("MERGE (q:Question {uuid: $uuid})", uuid=str(question.id))
            for kp_uuid in kp_uuids:
                neo_session.run(
                    """
                    MATCH (q:Question {uuid: $quid})
                    MATCH (kp:KnowledgePoint {uuid: $kpuuid})
                    MERGE (q)-[:TESTS]->(kp)
                    """,
                    quid=str(question.id), kpuuid=str(kp_uuid),
                )
    except Exception as e:
        logger.warning(f"    Neo4j 同步失败 [{question.id}]: {e}")


def update_bank_count(db: Session, bank_id: str):
    """更新题库题目计数。"""
    count = db.query(Question).filter(Question.bank_id == bank_id).count()
    db.query(QuestionBank).filter(QuestionBank.id == bank_id).update(
        {"total_questions": count}
    )
    db.commit()


def main():
    parser = argparse.ArgumentParser(
        description="客观题库爬取 — 从 dotcpp.com 数据结构试卷爬取选择题和判断题"
    )
    parser.add_argument("--dry-run", action="store_true", help="干跑模式：仅预览不写入")
    parser.add_argument("--domain", type=str, default=None, help="只处理指定章节")
    parser.add_argument("--target-bank", type=str, default=SEED_BANK_ID, help="目标题库 UUID")
    args = parser.parse_args()

    db = SessionLocal()
    neo4j = get_neo4j()

    stats = {"scraped": 0, "valid": 0, "imported": 0, "skipped": 0, "failed": 0}

    print("\n" + "=" * 60)
    print("  客观题库爬取 — dotcpp 数据结构试卷")
    print("=" * 60)

    try:
        # Step 0: 解析学科 ID
        subject_id = resolve_subject_id(db)
        if not subject_id:
            print("  ❌ 未找到「数据结构」学科，请先运行 seed.py")
            return
        print(f"  学科 ID: {subject_id}")

        # Step 1: 加载本地映射
        domain_map = load_domain_map(db, subject_id)
        kp_map = load_kp_map(db, subject_id)
        existing_ids = load_existing_source_ids(db)
        print(f"  章节数: {len(domain_map)}, 知识点数: {len(kp_map)}")
        print(f"  已导入 dotcpp 题目: {len(existing_ids)}")

        # Step 2: 爬取所有试卷
        print(f"\n🔍 爬取 dotcpp 试卷...")
        all_questions = scrape_all_papers(args.domain)
        stats["scraped"] = len(all_questions)
        print(f"\n  共爬取 {len(all_questions)} 道原始题目")

        # Step 3: 按章节统计
        domain_counts = defaultdict(int)
        for q in all_questions:
            d = q.get("assigned_domain") or "综合(待分配)"
            domain_counts[d] += 1
        print("  章节分布:")
        for d, c in sorted(domain_counts.items(), key=lambda x: -x[1]):
            print(f"    {d}: {c} 题")

        # Step 4: 处理每道题
        print(f"\n📋 处理题目...")

        for i, q in enumerate(all_questions):
            stem = q["content"]["stem"]
            source_id = q["content"].get("source_question_id", "")
            assigned_domain = q["assigned_domain"]

            # 去重检查
            if source_id in existing_ids:
                stats["skipped"] += 1
                continue

            # 对综合试卷（期中/期末），按关键词分配章节
            if not assigned_domain:
                assigned_domain = classify_by_keywords(stem, kp_map)

            if not assigned_domain or assigned_domain not in domain_map:
                stats["skipped"] += 1
                continue

            # 匹配知识点
            kp_uuid = match_knowledge_point(stem, assigned_domain, kp_map)
            if not kp_uuid:
                stats["skipped"] += 1
                continue

            q["assigned_domain"] = assigned_domain
            stats["valid"] += 1

            if not args.dry_run:
                try:
                    import_question(db, neo4j, q, args.target_bank, [kp_uuid])
                    stats["imported"] += 1
                    existing_ids.add(source_id)
                except Exception as e:
                    logger.error(f"  导入失败 [{source_id}]: {e}")
                    stats["failed"] += 1
                    db.rollback()

            if (i + 1) % 20 == 0:
                print(f"    处理进度: {i+1}/{len(all_questions)}")

        # Step 5: 更新题库计数
        if stats["imported"] > 0:
            update_bank_count(db, args.target_bank)

        # Step 6: 汇总
        print("\n" + "=" * 60)
        print(f"  汇总:")
        print(f"    爬取总数: {stats['scraped']}")
        print(f"    有效题目: {stats['valid']}")
        print(f"    已导入:   {stats['imported']}")
        print(f"    跳过(重复/无法分配): {stats['skipped']}")
        print(f"    失败:     {stats['failed']}")
        if args.dry_run:
            print(f"    [干跑模式] 未实际写入数据库")
        print("=" * 60 + "\n")

    finally:
        db.close()


if __name__ == "__main__":
    main()
