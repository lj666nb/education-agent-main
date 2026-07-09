#!/usr/bin/env python3
"""
dotcpp 风格题库批量生成脚本
基于 dotcpp 数据结构与算法考试的知识点体系，使用 Qwen AI 批量生成选择题和判断题。

dotcpp 数据来源：https://www.dotcpp.com/exam/ds/
知识点分类参考 dotcpp 的 9 大专题结构。

用法:
  python app/scripts/import_dotcpp_questions.py                  # 全量生成（每知识点 5 题）
  python app/scripts/import_dotcpp_questions.py --dry-run        # 干跑（仅预览不写入）
  python app/scripts/import_dotcpp_questions.py --per-point 10   # 每个知识点生成 10 题
  python app/scripts/import_dotcpp_questions.py --domain 树和二叉树  # 只生成指定章节
  python app/scripts/import_dotcpp_questions.py --types single_choice  # 只生成选择题
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
from app.models.user import User  # 必须导入以注册 User 表的外键关系
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
# 配置常量
# ═══════════════════════════════════════════════════════════════════

SEED_SUBJECT_ID = "d91a4645-ab5f-4819-8379-d9e6524f0937"
SEED_BANK_ID = "2ce6ee7d-ed5a-42a1-8a26-6ad6856afd3e"

# 每个章节默认生成的题目数量分布
DEFAULT_PER_POINT = 5
DEFAULT_CHOICE_RATIO = 0.7  # 70% 选择题, 30% 判断题


# ═══════════════════════════════════════════════════════════════════
# 题目生成 Prompt
# ═══════════════════════════════════════════════════════════════════

GENERATE_BATCH_PROMPT = """你是一位数据结构与算法课程的出题专家。请为以下知识点生成{n}道高质量的题目。

【知识点信息】
- 章节：{domain_name}
- 知识点：{point_name}
- 描述：{point_desc}

【题目要求】
- 题型分布：约 {choice_count} 道单选题 + {tf_count} 道判断题
- 难度分布：基础题 40%，进阶题 40%，挑战题 20%
- 题目必须有区分度，考察深层理解而非简单概念复述
- 选择题选项要有迷惑性，考察易混淆的概念
- 数学公式用 LaTeX：行内 $...$，独立 $$...$$
- 每道题必须标注难度：beginner / basic / intermediate / advanced / competition

【已有题目（避免重复）】
{existing_stems}

【输出格式】
严格输出 JSON 数组（不要代码块标记，不要其他文字）：
[
  {{
    "type": "single_choice",
    "content": {{"stem": "题干（支持 $...$ LaTeX）", "options": [{{"key": "A", "text": "选项A"}}, {{"key": "B", "text": "选项B"}}, {{"key": "C", "text": "选项C"}}, {{"key": "D", "text": "选项D"}}]}},
    "answer": {{"correct_answer": ["A"], "explanation": "详细解析，说明为什么选A、为什么其他选项错误"}},
    "difficulty": "basic"
  }},
  {{
    "type": "true_false",
    "content": {{"stem": "判断题干（支持 $...$ LaTeX）"}},
    "answer": {{"correct_answer": ["对"], "explanation": "详细解析"}},
    "difficulty": "intermediate"
  }}
]

请直接输出 JSON 数组，不要添加任何前缀或后缀文字。"""


# ═══════════════════════════════════════════════════════════════════
# 知识点加载
# ═══════════════════════════════════════════════════════════════════

def load_knowledge_points(db: Session, domain_filter: str = None) -> list[dict]:
    """从数据库加载知识点列表，含章节信息。"""
    query = (
        db.query(KnowledgePoint, KnowledgeDomain)
        .join(KnowledgeDomain)
        .filter(KnowledgeDomain.subject_id == SEED_SUBJECT_ID)
    )
    if domain_filter:
        query = query.filter(KnowledgeDomain.name == domain_filter)

    query = query.order_by(KnowledgeDomain.sort_order, KnowledgePoint.sort_order)

    points = []
    for pt, domain in query.all():
        points.append({
            "uuid": str(pt.id),
            "name": pt.name,
            "description": pt.description or f"{domain.name} - {pt.name}",
            "domain_name": domain.name,
            "domain_id": str(domain.id),
            "difficulty": pt.difficulty or 1,
        })
    return points


def load_existing_stems_for_point(db: Session, kp_uuid: str) -> list[str]:
    """获取某个知识点已有题目的 stem，用于去重提示。"""
    questions = db.query(Question).filter(
        Question.knowledge_point_uuids.contains([kp_uuid]),
        Question.status == "published",
    ).limit(20).all()

    stems = []
    for q in questions:
        content = q.content or {}
        stem = content.get("stem", "") if isinstance(content, dict) else ""
        stem = stem.strip()
        if stem:
            stems.append(stem[:100])
    return stems


# ═══════════════════════════════════════════════════════════════════
# API 凭证解析
# ═══════════════════════════════════════════════════════════════════

def resolve_api_credentials(db: Session) -> dict:
    """
    解析 API 凭证，优先级：
    1. 系统环境变量 QWEN_API_KEY
    2. 系统环境变量 DEEPSEEK_API_KEY
    3. 用户设置中的 Qwen API
    4. 用户设置中的 DeepSeek API
    """
    # 系统级 Qwen
    if settings.QWEN_API_KEY and settings.QWEN_API_KEY != "your-qwen-api-key-here":
        return {
            "api_key": settings.QWEN_API_KEY,
            "base_url": settings.QWEN_BASE_URL,
            "model": "qwen-plus",
        }

    # 系统级 DeepSeek
    if settings.DEEPSEEK_API_KEY and "your-deepseek" not in settings.DEEPSEEK_API_KEY:
        return {
            "api_key": settings.DEEPSEEK_API_KEY,
            "base_url": settings.DEEPSEEK_BASE_URL,
            "model": "deepseek-v4-flash",
        }

    # 用户设置
    from app.crud.api_settings import api_settings_crud
    from app.models.user import User

    # 查找测试用户
    user = db.query(User).filter(User.username == "guoketg").first()
    if user:
        for provider, base_url, model in [
            ("qwen", settings.QWEN_BASE_URL, "qwen-plus"),
            ("deepseek", settings.DEEPSEEK_BASE_URL, "deepseek-v4-flash"),
        ]:
            try:
                cfg = api_settings_crud.get_setting_value(db, str(user.id), provider)
                if cfg and cfg.get("api_key"):
                    return {
                        "api_key": cfg["api_key"],
                        "base_url": cfg.get("base_url") or base_url,
                        "model": model,
                    }
            except Exception:
                continue

    return {}


# ═══════════════════════════════════════════════════════════════════
# Qwen / DeepSeek AI 调用
# ═══════════════════════════════════════════════════════════════════

def generate_questions_for_point(
    point: dict,
    existing_stems: list[str],
    per_point: int,
    choice_ratio: float,
    api_creds: dict,
) -> list[dict]:
    """为单个知识点生成题目。"""
    choice_count = max(1, int(per_point * choice_ratio))
    tf_count = max(1, per_point - choice_count)

    existing_text = "\n".join(f"  - {s}" for s in existing_stems[:10]) if existing_stems else "（暂无已有题目）"

    prompt = GENERATE_BATCH_PROMPT.format(
        n=per_point,
        domain_name=point["domain_name"],
        point_name=point["name"],
        point_desc=point["description"],
        choice_count=choice_count,
        tf_count=tf_count,
        existing_stems=existing_text,
    )

    resp = httpx.post(
        f"{api_creds['base_url']}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_creds['api_key']}",
            "Content-Type": "application/json",
        },
        json={
            "model": api_creds['model'],
            "messages": [
                {"role": "system", "content": "你是数据结构出题专家。只输出 JSON 数组，不要任何其他文字。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.8,  # 较高温度增加题目多样性
            "max_tokens": 8192,  # 增大以容纳完整JSON数组
        },
        timeout=120.0,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"Qwen API 返回 {resp.status_code}: {resp.text[:300]}")

    reply = resp.json()["choices"][0]["message"]["content"].strip()

    # 清理回复
    reply = re.sub(r'^```(?:json)?\s*', '', reply)
    reply = re.sub(r'\s*```$', '', reply)

    # 尝试多种解析方式
    # 1. 标准 JSON 数组
    try:
        questions = json.loads(reply)
        if isinstance(questions, list):
            return questions
    except json.JSONDecodeError:
        pass

    # 2. 提取 JSON 数组
    arr_start = reply.find("[")
    arr_end = reply.rfind("]")
    if arr_start != -1 and arr_end != -1:
        try:
            return json.loads(reply[arr_start:arr_end + 1])
        except json.JSONDecodeError:
            pass

    # 3. 处理截断的 JSON: 用 raw_decode 逐个提取完整对象
    if arr_start != -1:
        decoder = json.JSONDecoder()
        idx = arr_start + 1  # 跳过开头的 [
        results = []
        while idx < len(reply):
            # 跳过空白和逗号
            while idx < len(reply) and reply[idx] in ' \t\n\r,':
                idx += 1
            if idx >= len(reply) or reply[idx] == ']':
                break
            if reply[idx] == '{':
                try:
                    obj, end = decoder.raw_decode(reply, idx)
                    if isinstance(obj, dict) and 'content' in obj:
                        results.append(obj)
                    idx = end
                except json.JSONDecodeError:
                    idx += 1
            else:
                idx += 1
        if results:
            return results

    # 4. 尝试逐行解析（每行一个完整 JSON 对象）
    results = []
    for line in reply.split('\n'):
        line = line.strip()
        if line.startswith('{') and line.endswith('}'):
            try:
                q = json.loads(line)
                if isinstance(q, dict) and 'content' in q:
                    results.append(q)
            except json.JSONDecodeError:
                continue
    if results:
        return results

    raise RuntimeError(f"无法解析 AI 返回的题目数据，原始回复: {reply[:300]}")


# ═══════════════════════════════════════════════════════════════════
# 数据验证 & 导入
# ═══════════════════════════════════════════════════════════════════

VALID_TYPES = {"single_choice", "true_false", "multiple_choice"}
VALID_DIFFICULTIES = {"beginner", "basic", "intermediate", "advanced", "competition"}


def validate_and_fix_question(q: dict, point: dict) -> Optional[dict]:
    """验证并修复 AI 生成的题目数据。"""
    # 类型校验
    qtype = q.get("type", "single_choice")
    if qtype not in VALID_TYPES:
        qtype = "single_choice"

    # 内容校验
    content = q.get("content", {})
    if not isinstance(content, dict):
        return None
    stem = content.get("stem", "")
    if not stem or len(stem) < 10:
        return None

    # 选择题必须有选项
    if qtype == "single_choice":
        options = content.get("options", [])
        if not options or len(options) < 2:
            return None

    # 答案校验
    answer = q.get("answer", {})
    if not isinstance(answer, dict):
        answer = {}
    correct = answer.get("correct_answer", [])
    if not correct:
        return None

    # 判断题答案标准化
    if qtype == "true_false":
        normalized = []
        for a in correct:
            a_str = str(a).strip()
            if a_str in ('√', '✓', '✔', '正确', 'True', 'true', '对', '是'):
                normalized.append("对")
            elif a_str in ('×', '✗', '✘', '错误', 'False', 'false', '错', '否'):
                normalized.append("错")
            else:
                normalized.append(a_str)
        correct = normalized

    # 难度校验
    difficulty = q.get("difficulty", "basic")
    if difficulty not in VALID_DIFFICULTIES:
        difficulty = "basic"

    explanation = answer.get("explanation", "")
    if not explanation or len(str(explanation)) < 5:
        explanation = f"本题考察{point['domain_name']}中「{point['name']}」相关知识点。"

    return {
        "type": qtype,
        "content": content,
        "answer": {
            "correct_answer": correct,
            "explanation": str(explanation)[:2000],
        },
        "difficulty": difficulty,
        "knowledge_point_uuids": [point["uuid"]],
        "tags": [point["domain_name"], "AI生成", "dotcpp风格"],
        "status": "published",
        "ai_generated": True,
        "source": "ai_dotcpp",
        "priority": 0,
    }


def import_question(db: Session, neo4j: Neo4jConnection, q_data: dict, bank_id: str):
    """导入单道题目到 PostgreSQL + Neo4j。"""
    question = Question(
        id=_uuid_mod.uuid4(),
        bank_id=bank_id,
        type=q_data["type"],
        difficulty=q_data.get("difficulty", "basic"),
        status=q_data.get("status", "published"),
        priority=q_data.get("priority", 0),
        content=q_data["content"],
        answer=q_data["answer"],
        knowledge_point_uuids=q_data.get("knowledge_point_uuids", []),
        tags=q_data.get("tags", []),
        ai_generated=q_data.get("ai_generated", False),
        source=q_data.get("source", "ai_dotcpp"),
    )
    db.add(question)
    db.commit()
    db.refresh(question)

    # 同步到 Neo4j
    try:
        with neo4j.connect().session() as session:
            session.run("MERGE (q:Question {uuid: $uuid})", uuid=str(question.id))
            for kp_uuid in (question.knowledge_point_uuids or []):
                session.run(
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


# ═══════════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="dotcpp 风格题库批量生成 — 使用 Qwen AI 为数据结构知识点生成选择题和判断题"
    )
    parser.add_argument("--dry-run", action="store_true", help="干跑模式：仅预览不写入数据库")
    parser.add_argument("--per-point", type=int, default=DEFAULT_PER_POINT,
                        help=f"每个知识点生成的题目数（默认 {DEFAULT_PER_POINT}）")
    parser.add_argument("--domain", type=str, default=None, help="只生成指定章节（如：树和二叉树）")
    parser.add_argument("--types", type=str, default="single_choice,true_false",
                        help="题目类型（逗号分隔，默认 single_choice,true_false）")
    parser.add_argument("--target-bank", type=str, default=SEED_BANK_ID, help="目标题库 UUID")
    parser.add_argument("--delay", type=float, default=2.0, help="API 请求间隔（秒）")
    args = parser.parse_args()

    db = SessionLocal()
    neo4j = get_neo4j()

    # 检查 API 配置
    api_creds = resolve_api_credentials(db)
    if not api_creds:
        print("\n❌ 错误: 未找到可用的 API Key")
        print("   请在 .env 中设置 QWEN_API_KEY 或 DEEPSEEK_API_KEY")
        print("   或在「设置」页面配置用户级别的 API Key")
        db.close()
        return
    print(f"   API: {api_creds['base_url']} (model={api_creds['model']})")

    stats = {"generated": 0, "valid": 0, "imported": 0, "failed": 0, "skipped_points": 0}

    print("\n" + "=" * 60)
    print("  dotcpp 风格题库批量生成 (Qwen AI)")
    print("=" * 60)

    try:
        # Step 1: 加载知识点
        print(f"\n📋 加载知识点...")
        points = load_knowledge_points(db, args.domain)
        print(f"  共 {len(points)} 个知识点" + (f"（筛选章节: {args.domain}）" if args.domain else ""))

        if not points:
            print("  ❌ 未找到知识点，请检查学科数据结构是否已初始化")
            return

        # 按章节分组统计
        domain_counts = defaultdict(int)
        for pt in points:
            domain_counts[pt["domain_name"]] += 1
        print(f"  章节分布:")
        for dname, count in domain_counts.items():
            print(f"    {dname}: {count} 个知识点 × {args.per_point} 题 = {count * args.per_point} 题")
        total_expected = len(points) * args.per_point
        print(f"  预计生成: {total_expected} 题")

        # Step 2: 遍历知识点生成题目
        print(f"\n🤖 开始 Qwen AI 生成题目...")

        for i, point in enumerate(points):
            domain_label = f"[{point['domain_name']}] {point['name']}"
            print(f"\n  ({i+1}/{len(points)}) {domain_label}")

            # 获取已有题目（用于去重提示）
            existing_stems = load_existing_stems_for_point(db, point["uuid"])
            if len(existing_stems) >= args.per_point * 3:
                print(f"    ⏭ 该知识点已有很多题目 ({len(existing_stems)} 题)，跳过")
                stats["skipped_points"] += 1
                continue

            try:
                raw_questions = generate_questions_for_point(
                    point, existing_stems, args.per_point, DEFAULT_CHOICE_RATIO, api_creds
                )
                stats["generated"] += len(raw_questions)
                print(f"    AI 生成: {len(raw_questions)} 题")

                # 验证和导入
                valid_count = 0
                for q in raw_questions:
                    q_data = validate_and_fix_question(q, point)
                    if q_data:
                        stats["valid"] += 1
                        if not args.dry_run:
                            try:
                                import_question(db, neo4j, q_data, args.target_bank)
                                stats["imported"] += 1
                                valid_count += 1
                            except Exception as e:
                                logger.error(f"    导入失败: {e}")
                                stats["failed"] += 1
                                db.rollback()

                if valid_count > 0:
                    print(f"    有效 {valid_count}/{len(raw_questions)} 题" +
                          ("" if args.dry_run else f"，已导入"))

            except Exception as e:
                logger.error(f"    生成失败: {e}")
                stats["failed"] += len(raw_questions) if 'raw_questions' in dir() else 0
                continue

            # API 限流控制
            if i < len(points) - 1:
                time.sleep(args.delay)

        # Step 3: 更新题库计数
        if stats["imported"] > 0:
            update_bank_count(db, args.target_bank)

        # Step 4: 汇总
        print("\n" + "=" * 60)
        print(f"  汇总:")
        print(f"    AI 生成: {stats['generated']}  验证通过: {stats['valid']}")
        print(f"    已导入: {stats['imported']}  失败: {stats['failed']}")
        if stats["skipped_points"]:
            print(f"    跳过知识点: {stats['skipped_points']}")
        if args.dry_run:
            print(f"    [干跑模式] 未实际写入数据库")
        print("=" * 60 + "\n")

    finally:
        db.close()


if __name__ == "__main__":
    main()
