#!/usr/bin/env python3
"""
dotcpp 编程题导入脚本
从 dotcpp.com/oj/ybt-ds/ 爬取信息学一本通数据结构编程题，AI分类后导入题库。

用法:
  python app/scripts/import_coding_problems.py              # 全量导入
  python app/scripts/import_coding_problems.py --dry-run    # 干跑预览
  python app/scripts/import_coding_problems.py --chapter 1081  # 仅指定章节
"""

import sys, os, time, argparse, json, logging, re, uuid as _uuid_mod
from typing import Optional
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question,
)
from app.models.user import User
from app.core.config import settings
from app.crud.api_settings import api_settings_crud

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger(__name__)

SEED_SUBJECT_ID = "d91a4645-ab5f-4819-8379-d9e6524f0937"
SEED_BANK_ID = "2ce6ee7d-ed5a-42a1-8a26-6ad6856afd3e"
HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"}

YBT_DS_CHAPTERS = [
    {"url": "https://www.dotcpp.com/oj/1081/", "domain": "栈和队列", "label": "栈"},
    {"url": "https://www.dotcpp.com/oj/1082/", "domain": "栈和队列", "label": "队列"},
    {"url": "https://www.dotcpp.com/oj/1083/", "domain": "树和二叉树", "label": "树和堆"},
    {"url": "https://www.dotcpp.com/oj/1084/", "domain": "图", "label": "图论"},
    {"url": "https://www.dotcpp.com/oj/1085/", "domain": "查找", "label": "查找与排序"},
]

DEFAULT_CODE_TEMPLATES = {
    "python": "# 请在此编写代码\n\ndef solve():\n    # 读取输入\n    # 处理逻辑\n    # 输出结果\n    pass\n\nif __name__ == '__main__':\n    solve()\n",
    "cpp": "#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nint main() {\n    // 请在此编写代码\n    return 0;\n}\n",
    "java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // 请在此编写代码\n    }\n}\n",
}


def load_kp_map(db: Session) -> dict:
    """加载知识点映射：name → {uuid, domain_name}."""
    points = (
        db.query(KnowledgePoint).join(KnowledgeDomain)
        .filter(KnowledgeDomain.subject_id == SEED_SUBJECT_ID)
        .all()
    )
    return {pt.name: {"uuid": str(pt.id), "domain_name": pt.domain.name} for pt in points}


def load_existing_source_ids(db: Session) -> set:
    """获取已导入的 dotcpp 编程题 source_problem_id。"""
    questions = (
        db.query(Question)
        .filter(Question.source == "dotcpp_coding", Question.type == "programming")
        .all()
    )
    ids = set()
    for q in questions:
        c = q.content or {}
        sid = c.get("source_problem_id", "")
        if sid:
            ids.add(sid)
    return ids


def scrape_chapter_problems(chapter: dict, delay: float = 1.0) -> list[dict]:
    """爬取章节页面的题目列表。"""
    url = chapter["url"]
    logger.info(f"  爬取: {chapter['label']} ({url})")
    try:
        time.sleep(delay)
        resp = httpx.get(url, headers=HTTP_HEADERS, timeout=30, follow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"    请求失败: {e}")
        return []

    soup = BeautifulSoup(resp.text, 'html.parser')
    problems = []

    for tr in soup.find_all('tr'):
        cells = tr.find_all('td')
        if len(cells) >= 3:
            pid = cells[1].get_text(strip=True) if len(cells) > 1 else ""
            title = cells[2].get_text(strip=True) if len(cells) > 2 else ""
            if pid.isdigit() and title and len(title) > 3:
                problems.append({"id": pid, "title": title, "chapter": chapter})

    logger.info(f"    找到 {len(problems)} 题")
    return problems


def scrape_problem_detail(problem: dict, delay: float = 0.5) -> Optional[dict]:
    """爬取题目详情页：描述、输入输出格式、样例。"""
    pid = problem["id"]
    url = f"https://www.dotcpp.com/oj/problem{pid}.html"
    time.sleep(delay)
    try:
        resp = httpx.get(url, headers=HTTP_HEADERS, timeout=30, follow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"    请求失败 [{pid}]: {e}")
        return None

    soup = BeautifulSoup(resp.text, 'html.parser')
    body_text = soup.get_text(separator='\n', strip=True)

    # 提取各部分
    def extract_section(text, start_marker, end_markers=None):
        idx = text.find(start_marker)
        if idx == -1:
            return ""
        start = idx + len(start_marker)
        if end_markers:
            end = len(text)
            for m in end_markers:
                pos = text.find(m, start)
                if pos != -1 and pos < end:
                    end = pos
            return text[start:end].strip()[:2000]
        return text[start:start+800].strip()

    end_markers_all = ["输入格式", "输出格式", "样例输入", "样例输出", "提示", "来源", "标签", "显示知识点"]

    description = extract_section(body_text, "题目描述", end_markers_all)
    input_format = extract_section(body_text, "输入格式", ["输出格式", "样例输入", "样例输出"])
    output_format = extract_section(body_text, "输出格式", ["样例输入", "样例输出"])
    sample_input = extract_section(body_text, "样例输入", ["样例输出", "提示"])
    sample_output = extract_section(body_text, "样例输出", ["提示", "来源", "标签"])

    # 时间/内存限制
    time_match = re.search(r'(\d+)s', body_text[:500])
    mem_match = re.search(r'(\d+)MB', body_text[:500])

    return {
        "source_problem_id": f"dotcpp-{pid}",
        "title": problem["title"],
        "description": description or problem["title"],
        "input_format": input_format or "",
        "output_format": output_format or "",
        "sample_input": sample_input or "",
        "sample_output": sample_output or "",
        "time_limit_ms": int(time_match.group(1)) * 1000 if time_match else 1000,
        "memory_limit_mb": int(mem_match.group(1)) if mem_match else 128,
        "chapter": problem["chapter"],
    }


def _resolve_api_creds(db: Session) -> dict:
    """解析 API 凭证。"""
    if settings.QWEN_API_KEY and "your-qwen" not in settings.QWEN_API_KEY:
        return {"api_key": settings.QWEN_API_KEY, "base_url": settings.QWEN_BASE_URL, "model": "qwen-plus"}
    if settings.DEEPSEEK_API_KEY and "your-deepseek" not in settings.DEEPSEEK_API_KEY:
        return {"api_key": settings.DEEPSEEK_API_KEY, "base_url": settings.DEEPSEEK_BASE_URL, "model": "deepseek-v4-flash"}
    user = db.query(User).filter(User.username == "guoketg").first()
    if user:
        for provider, base_url, model in [
            ("qwen", settings.QWEN_BASE_URL, "qwen-plus"),
            ("deepseek", settings.DEEPSEEK_BASE_URL, "deepseek-v4-flash"),
        ]:
            try:
                cfg = api_settings_crud.get_setting_value(db, str(user.id), provider)
                if cfg and cfg.get("api_key"):
                    return {"api_key": cfg["api_key"], "base_url": cfg.get("base_url") or base_url, "model": model}
            except Exception:
                continue
    return {}


def generate_code_template(detail: dict, api_creds: dict) -> dict:
    """使用 AI 为编程题生成 Python/C++/Java 代码模板。"""
    prompt = f"""为以下编程题生成代码模板框架（起始代码）：

题目：{detail['title']}
描述：{detail.get('description', '')[:400]}
输入格式：{detail.get('input_format', '')[:150]}
输出格式：{detail.get('output_format', '')[:150]}

请生成三种语言的起始模板代码。输出JSON：
{{"python": "含函数签名的Python代码", "cpp": "含main函数的C++代码", "java": "含Main类的Java代码"}}
只输出JSON对象，不要代码块标记。"""

    try:
        resp = httpx.post(
            f"{api_creds['base_url']}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_creds['api_key']}",
                "Content-Type": "application/json",
            },
            json={
                "model": api_creds['model'],
                "messages": [
                    {"role": "system", "content": "只输出JSON对象，不要加代码块标记。"},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 1024,
            },
            timeout=30,
        )
        if resp.status_code == 200:
            reply = resp.json()["choices"][0]["message"]["content"].strip()
            reply = re.sub(r'^```(?:json)?\s*', '', reply)
            reply = re.sub(r'\s*```$', '', reply)
            try:
                templates = json.loads(reply)
                if isinstance(templates, dict):
                    return templates
            except json.JSONDecodeError:
                pass
    except Exception as e:
        logger.debug(f"    代码模板 AI 生成失败: {e}")

    return DEFAULT_CODE_TEMPLATES


def main():
    parser = argparse.ArgumentParser(description="dotcpp 编程题导入脚本")
    parser.add_argument("--dry-run", action="store_true", help="干跑模式：仅预览不写入")
    parser.add_argument("--chapter", type=str, default=None, help="仅处理指定章节URL（如1081）")
    parser.add_argument("--delay", type=float, default=1.0, help="请求间隔（秒）")
    args = parser.parse_args()

    db = SessionLocal()
    neo4j = get_neo4j()
    stats = {"scraped": 0, "imported": 0, "skipped": 0, "errors": 0}

    print("\n" + "=" * 60)
    print("  dotcpp 编程题导入")
    print("=" * 60)

    try:
        # 加载上下文
        kp_map = load_kp_map(db)
        existing_ids = load_existing_source_ids(db)
        print(f"\n  知识点: {len(kp_map)} 个")
        print(f"  已有编程题: {len(existing_ids)} 题")

        api_creds = _resolve_api_creds(db)
        if api_creds:
            print(f"  API: {api_creds['base_url']} (model={api_creds['model']})")
        else:
            print("  WARNING: 未配置 API Key，代码模板将使用默认值")

        # 选择章节
        chapters = YBT_DS_CHAPTERS
        if args.chapter:
            chapters = [c for c in chapters if args.chapter in c["url"]]

        # 爬取
        print(f"\n  爬取 {len(chapters)} 个章节...")
        all_problems = []
        for ch in chapters:
            problems = scrape_chapter_problems(ch, args.delay)
            stats["scraped"] += len(problems)
            for p in problems:
                source_id = f"dotcpp-{p['id']}"
                if source_id in existing_ids:
                    stats["skipped"] += 1
                    continue
                detail = scrape_problem_detail(p, args.delay * 0.5)
                if detail:
                    all_problems.append(detail)

        print(f"\n  爬取汇总: {stats['scraped']} 题, 新增 {len(all_problems)} 题, 跳过 {stats['skipped']} 题")

        # 导入
        for i, detail in enumerate(all_problems):
            domain_name = detail["chapter"]["domain"]
            kp_uuids = [
                info["uuid"] for name, info in kp_map.items()
                if info["domain_name"] == domain_name
            ][:2]

            # AI 生成代码模板
            templates = DEFAULT_CODE_TEMPLATES
            if api_creds:
                try:
                    templates = generate_code_template(detail, api_creds)
                except Exception:
                    pass

            content = {
                "stem": detail["title"],
                "description": detail["description"],
                "input_format": detail.get("input_format", ""),
                "output_format": detail.get("output_format", ""),
                "sample_input": detail.get("sample_input", ""),
                "sample_output": detail.get("sample_output", ""),
                "code_template": templates,
                "time_limit_ms": detail.get("time_limit_ms", 1000),
                "memory_limit_mb": detail.get("memory_limit_mb", 128),
                "source_problem_id": detail["source_problem_id"],
            }
            answer = {
                "correct_answer": [],
                "explanation": f"dotcpp {detail['chapter']['label']} 章节编程题",
            }

            if args.dry_run:
                print(f"  [DRY RUN] {detail['title'][:60]}")
                continue

            try:
                q = Question(
                    id=_uuid_mod.uuid4(),
                    bank_id=SEED_BANK_ID,
                    type="programming",
                    difficulty="basic",
                    status="published",
                    content=content,
                    answer=answer,
                    knowledge_point_uuids=kp_uuids,
                    tags=[detail["chapter"]["label"], "dotcpp", "信息学一本通"],
                    ai_generated=False,
                    source="dotcpp_coding",
                )
                db.add(q)
                db.commit()
                db.refresh(q)

                # Neo4j 同步
                try:
                    with neo4j.connect().session() as session:
                        session.run("MERGE (q:Question {uuid: $uuid})", uuid=str(q.id))
                        for kp_uuid in kp_uuids:
                            session.run(
                                "MATCH (q:Question {uuid: $quid}) MATCH (kp:KnowledgePoint {uuid: $kpuuid}) MERGE (q)-[:TESTS]->(kp)",
                                quid=str(q.id), kpuuid=kp_uuid,
                            )
                except Exception as e:
                    logger.warning(f"    Neo4j 同步失败: {e}")

                stats["imported"] += 1
                if (i + 1) % 5 == 0:
                    print(f"  已导入: {i+1}/{len(all_problems)}")

            except Exception as e:
                logger.error(f"  导入失败 [{detail.get('title', '')}]: {e}")
                stats["errors"] += 1
                db.rollback()

        # 更新题库计数
        if stats["imported"] > 0:
            count = db.query(Question).filter(Question.bank_id == SEED_BANK_ID).count()
            db.query(QuestionBank).filter(QuestionBank.id == SEED_BANK_ID).update(
                {"total_questions": count}
            )
            db.commit()

        # 汇总
        print(f"\n  {'=' * 40}")
        print(f"  爬取: {stats['scraped']}  导入: {stats['imported']}")
        print(f"  跳过: {stats['skipped']}  错误: {stats['errors']}")
        if args.dry_run:
            print(f"  [干跑模式] 未实际写入数据库")
        print(f"  {'=' * 40}\n")

    finally:
        db.close()


if __name__ == "__main__":
    main()
