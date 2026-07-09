# dotcpp 题库导入脚本 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 dotcpp.com 爬取数据结构选择题和判断题，通过 Qwen AI 进行知识点分类后批量导入种子题库。

**Architecture:** 单文件 Python CLI 脚本，使用 httpx+BeautifulSoup 爬取 dotcpp 9 个考试页面，调用 Qwen API 将每道题映射到已有知识点 UUID，然后写入 PostgreSQL questions 表并同步 Neo4j。

**Tech Stack:** Python 3, httpx, beautifulsoup4, Qwen API (qwen-plus), SQLAlchemy, Neo4j

## Global Constraints

- 所有用户可见的错误信息必须是中文
- 脚本遵循项目现有模式（参考 `app/scripts/import_leetcode.py`）
- 操作幂等：已存在的题目跳过，不重复导入
- 新增依赖必须更新 `requirements.txt`
- 使用 Qwen API（项目已配置 `QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL`）

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `app/scripts/import_dotcpp_questions.py` | 创建 | 主脚本：爬取→分类→导入 |
| `requirements.txt` | 修改 | 添加 beautifulsoup4 |

---

### Task 1: 添加依赖并创建脚本骨架

**Files:**
- Modify: `requirements.txt`
- Create: `app/scripts/import_dotcpp_questions.py`

**Interfaces:**
- Produces: CLI 入口，接受 `--dry-run`, `--target-bank` 等参数

- [ ] **Step 1: 添加 beautifulsoup4 到 requirements.txt**

在 `requirements.txt` 末尾追加：
```
beautifulsoup4>=4.12.0
```

- [ ] **Step 2: 安装依赖**

```bash
pip install beautifulsoup4
```

- [ ] **Step 3: 创建脚本骨架**

```python
#!/usr/bin/env python3
"""
dotcpp 题库导入脚本
从 dotcpp.com/exam/ 爬取数据结构选择题和判断题，经 Qwen AI 知识点分类后导入题库。

用法:
  python app/scripts/import_dotcpp_questions.py                # 全量导入
  python app/scripts/import_dotcpp_questions.py --dry-run      # 干跑（仅爬取+分类，不入库）
  python app/scripts/import_dotcpp_questions.py --skip-ai      # 跳过 AI 分类（使用默认章节映射）
"""

import sys
import os
import time
import argparse
import json
import logging
import re
from typing import Optional
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question,
    QuestionType, QuestionDifficulty, QuestionStatus,
)
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
# 配置常量
# ═══════════════════════════════════════════════════════════════════

SEED_SUBJECT_ID = "d91a4645-ab5f-4819-8379-d9e6524f0937"
SEED_BANK_ID = "2ce6ee7d-ed5a-42a1-8a26-6ad6856afd3e"

# dotcpp 考试页面 → 默认章节名（AI 分类失败时的回退）
DOTCPP_EXAM_PAGES = [
    {"url": "https://www.dotcpp.com/exam/1082/", "domain": "绪论", "label": "基本概念"},
    {"url": "https://www.dotcpp.com/exam/1081/", "domain": "线性表", "label": "线性表"},
    {"url": "https://www.dotcpp.com/exam/1078/", "domain": "栈和队列", "label": "栈和队列"},
    {"url": "https://www.dotcpp.com/exam/1079/", "domain": "串", "label": "串"},
    {"url": "https://www.dotcpp.com/exam/1077/", "domain": "树和二叉树", "label": "二叉树与树"},
    {"url": "https://www.dotcpp.com/exam/1076/", "domain": "图", "label": "图"},
    {"url": "https://www.dotcpp.com/exam/1075/", "domain": "查找", "label": "查找"},
    {"url": "https://www.dotcpp.com/exam/1074/", "domain": "排序", "label": "排序"},
    {"url": "https://www.dotcpp.com/exam/1073/", "domain": None, "label": "期末综合"},
]


@dataclass
class RawQuestion:
    """从 dotcpp 页面解析出的原始题目"""
    exam_label: str          # 来源试卷标签
    default_domain: str      # 默认章节名
    question_type: str       # single_choice / true_false
    stem: str                # 题干
    options: list = field(default_factory=list)  # [{"key": "A", "text": "..."}]
    correct_answer: list = field(default_factory=list)  # ["A"] or ["对"/"错"]
    explanation: str = ""


def main():
    parser = argparse.ArgumentParser(description="dotcpp 题库导入脚本")
    parser.add_argument("--dry-run", action="store_true", help="干跑模式：仅爬取和分类，不入库")
    parser.add_argument("--skip-ai", action="store_true", help="跳过 AI 分类，使用默认章节映射")
    parser.add_argument("--target-bank", type=str, default=SEED_BANK_ID, help="目标题库 UUID")
    parser.add_argument("--delay", type=float, default=1.0, help="请求间隔（秒）")
    args = parser.parse_args()

    db: Session = SessionLocal()
    neo4j = get_neo4j()
    stats = {"scraped": 0, "classified": 0, "imported": 0, "skipped": 0, "errors": 0}

    try:
        # Step 1: 加载知识点映射
        kp_map = load_knowledge_point_map(db)
        logger.info(f"已加载 {len(kp_map)} 个知识点")

        # Step 2: 爬取所有页面
        all_raw_questions = []
        for exam in DOTCPP_EXAM_PAGES:
            raw_qs = scrape_exam_page(exam, args.delay)
            all_raw_questions.extend(raw_qs)
            logger.info(f"  {exam['label']}: 爬取到 {len(raw_qs)} 题")
        stats["scraped"] = len(all_raw_questions)
        logger.info(f"共爬取 {stats['scraped']} 道题目")

        # Step 3: AI 分类（或默认映射）
        if not args.skip_ai:
            classified = classify_with_qwen(all_raw_questions, kp_map)
        else:
            classified = classify_with_default(all_raw_questions, kp_map)
        stats["classified"] = len(classified)

        # Step 4: 去重检查
        existing_stems = load_existing_stems(db, args.target_bank)
        new_questions = [q for q in classified if not is_duplicate(q, existing_stems)]
        stats["skipped"] = len(classified) - len(new_questions)
        logger.info(f"去重：{len(new_questions)} 新题, {stats['skipped']} 重复跳过")

        # Step 5: 导入
        if not args.dry_run:
            for q_data in new_questions:
                try:
                    import_question(db, neo4j, q_data, args.target_bank)
                    stats["imported"] += 1
                except Exception as e:
                    logger.error(f"导入失败: {q_data.get('content', {}).get('stem', '')[:50]}... - {e}")
                    stats["errors"] += 1
            update_bank_count(db, args.target_bank)
            logger.info(f"导入完成: {stats['imported']} 题")

        # Step 6: 打印汇总
        print("\n" + "=" * 60)
        print(f"  爬取: {stats['scraped']}  分类: {stats['classified']}")
        print(f"  导入: {stats['imported']}  跳过: {stats['skipped']}  错误: {stats['errors']}")
        if args.dry_run:
            print("  [干跑模式] 未实际写入数据库")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 验证脚本可导入**

```bash
python -c "import app.scripts.import_dotcpp_questions; print('OK')"
```

- [ ] **Step 5: Commit**

```bash
git add requirements.txt app/scripts/import_dotcpp_questions.py
git commit -m "feat: add dotcpp import script skeleton with dependencies"
```

---

### Task 2: 实现页面爬取函数 `scrape_exam_page`

**Files:**
- Modify: `app/scripts/import_dotcpp_questions.py`

**Interfaces:**
- Consumes: `DOTCPP_EXAM_PAGES` 列表中的 URL
- Produces: `scrape_exam_page(exam: dict, delay: float) -> list[RawQuestion]`

- [ ] **Step 1: 实现爬取函数**

在脚本中添加以下代码（替换骨架中的占位函数）：

```python
def scrape_exam_page(exam: dict, delay: float = 1.0) -> list[RawQuestion]:
    """
    爬取 dotcpp 考试页面，提取选择题和判断题。
    dotcpp 页面结构：
    - 题目在每个 .question-item 或类似的容器中
    - 题干在 .question-stem / .q-content 中
    - 选项在 .options 下的 label 中
    - 正确答案可能隐藏在页面中或需要从 data 属性读取
    """
    url = exam["url"]
    domain = exam["domain"]
    label = exam["label"]
    questions = []

    try:
        time.sleep(delay)
        resp = httpx.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }, timeout=30.0, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        logger.error(f"请求失败 [{label}]: {e}")
        return questions

    soup = BeautifulSoup(resp.text, 'html.parser')

    # dotcpp 页面通常将题目放在 .exam-question 或类似容器中
    # 尝试多种选择器适配不同页面结构
    question_blocks = (
        soup.select('.exam-question') or
        soup.select('.question-item') or
        soup.select('.paper-question') or
        soup.select('[class*="question"]')
    )

    if not question_blocks:
        # 后备方案：查找所有包含题号的元素
        logger.warning(f"[{label}] 未找到标准题目容器，尝试通用解析")
        question_blocks = find_question_blocks_generic(soup)

    for block in question_blocks:
        try:
            q = parse_question_block(block, label, domain)
            if q and q.stem:
                questions.append(q)
        except Exception as e:
            logger.warning(f"[{label}] 解析单题失败: {e}")

    # 如果没解析到题目，尝试从页面 JSON 数据提取
    if not questions:
        questions = try_extract_from_json(soup, label, domain)

    return questions


def find_question_blocks_generic(soup: BeautifulSoup) -> list:
    """通用题目块查找：查找包含"题号+题型标签"的父容器"""
    blocks = []
    # dotcpp 页面常见结构：题目在 <div> 中包含 "第X题" 或数字题号
    for tag in soup.find_all(['div', 'li', 'fieldset']):
        text = tag.get_text(strip=True)
        if re.search(r'(第\s*\d+\s*题|^\d+[\.\、])', text[:50]):
            blocks.append(tag)
    return blocks


def parse_question_block(block, label: str, domain: str) -> Optional[RawQuestion]:
    """解析单个题目块，提取题型、题干、选项、答案"""
    block_text = block.get_text(separator='\n', strip=True)
    lines = [l.strip() for l in block_text.split('\n') if l.strip()]

    # 1. 判断题型
    qtype = detect_question_type(block_text)
    if not qtype:
        return None

    # 2. 提取题干
    stem = extract_stem(block, lines)

    # 3. 提取选项（仅选择题）
    options = []
    if qtype == "single_choice":
        options = extract_options(block)

    # 4. 提取答案
    correct = extract_answer(block, block_text, qtype)

    return RawQuestion(
        exam_label=label,
        default_domain=domain or label,
        question_type=qtype,
        stem=stem,
        options=options,
        correct_answer=correct,
        explanation="",
    )


def detect_question_type(text: str) -> Optional[str]:
    """根据文本特征判断题型"""
    if re.search(r'(判断题|判断|是否正确|说法正确|说法错误)', text[:100]):
        return "true_false"
    if re.search(r'(单选题|单项选择|选择.*最佳|四个选项|A[\.\、].*B[\.\、])', text[:200]):
        return "single_choice"
    # 通过选项模式判断
    if re.search(r'A[\.\、\s]', text) and re.search(r'B[\.\、\s]', text):
        return "single_choice"
    return None


def extract_stem(block, lines: list[str]) -> str:
    """提取题干文本"""
    # 移除题号前缀和选项后的文本
    for line in lines:
        cleaned = re.sub(r'^(第\s*\d+\s*题[：:\s]*|^\d+[\.\、]\s*)', '', line)
        cleaned = cleaned.strip()
        if len(cleaned) > 10 and not re.match(r'^[A-D][\.\、\s]', cleaned):
            return cleaned
    # 后备：使用整个文本
    return lines[0] if lines else ""


def extract_options(block) -> list[dict]:
    """提取选项 A/B/C/D"""
    options = []
    option_pattern = re.compile(r'^([A-D])[\.\、\s\)]\s*(.+)', re.MULTILINE)
    block_html = str(block)
    block_text = block.get_text(separator='\n', strip=True)

    for match in option_pattern.finditer(block_text):
        options.append({"key": match.group(1), "text": match.group(2).strip()})

    # 如果选项不全，尝试从 HTML label 标签提取
    if len(options) < 2:
        for label_tag in block.find_all('label'):
            key_el = label_tag.find(['strong', 'b', 'span'])
            key = key_el.get_text(strip=True).rstrip('.、)') if key_el else ''
            text = label_tag.get_text(strip=True)
            if key and len(key) == 1 and 'A' <= key <= 'D':
                text = text[len(key):].lstrip('.、) ').strip()
                options.append({"key": key, "text": text})

    return options


def extract_answer(block, text: str, qtype: str) -> list[str]:
    """提取正确答案"""
    # 1. 尝试从 data-answer 属性读取
    answer_attr = block.get('data-answer') or block.get('data-correct')
    if answer_attr:
        return [answer_attr.strip()]

    # 2. 查找包含"答案"的标签
    answer_tag = block.find(string=re.compile(r'(答案[：:]\s*|正确答案|【答案】)'))
    if answer_tag:
        answer_text = answer_tag.parent.get_text(strip=True) if answer_tag else ''
        match = re.search(r'答案[：:]\s*([^\s,，。]+)', answer_text)
        if match:
            return [match.group(1).strip()]

    # 3. 判断题：搜索"对"/"错"或"正确"/"错误"标记
    if qtype == "true_false":
        for marker in ['√', '✓', '✔', '对', '正确', 'true', 'True', 'T']:
            if marker in text[-100:]:
                return ["对"]
        return ["错"]

    # 4. 从正确选项的样式标记提取（dotcpp 有时用绿色高亮正确答案）
    correct_el = block.select_one('.correct, .right, .text-success, [style*="color:green"]')
    if correct_el:
        key_match = re.match(r'([A-D])', correct_el.get_text(strip=True))
        if key_match:
            return [key_match.group(1)]

    return []


def try_extract_from_json(soup: BeautifulSoup, label: str, domain: str) -> list[RawQuestion]:
    """尝试从页面内嵌的 JSON 数据中提取题目（部分 dotcpp 页面用 JS 渲染）"""
    questions = []
    for script in soup.find_all('script'):
        script_text = script.string or ''
        # 查找包含题目数据的 JSON
        if 'questions' in script_text.lower() or 'questionList' in script_text.lower():
            try:
                # 尝试提取 JSON 数组
                matches = re.findall(r'(?:questions|questionList|paperData)\s*[:=]\s*(\[.+?\])', script_text, re.DOTALL)
                for match in matches:
                    try:
                        data = json.loads(match)
                        for item in data:
                            q = parse_json_question(item, label, domain)
                            if q:
                                questions.append(q)
                    except json.JSONDecodeError:
                        continue
            except Exception:
                pass
    return questions


def parse_json_question(item: dict, label: str, domain: str) -> Optional[RawQuestion]:
    """从 JSON 对象解析单个题目"""
    stem = item.get('stem') or item.get('title') or item.get('question') or ''
    if not stem:
        return None

    qtype = item.get('type') or item.get('question_type') or ''
    if '判断' in str(qtype):
        qtype = 'true_false'
    else:
        qtype = 'single_choice'

    options = item.get('options') or item.get('choices') or []
    if isinstance(options, dict):
        options = [{"key": k, "text": v} for k, v in options.items()]
    elif isinstance(options, list) and options and isinstance(options[0], str):
        options = [{"key": chr(65 + i), "text": o} for i, o in enumerate(options)]

    answer = item.get('answer') or item.get('correct') or item.get('correct_answer') or ''
    if isinstance(answer, list):
        correct = answer
    elif isinstance(answer, str):
        correct = [answer]
    else:
        correct = []

    return RawQuestion(
        exam_label=label,
        default_domain=domain or label,
        question_type=qtype,
        stem=strip_html(stem),
        options=options,
        correct_answer=correct,
        explanation=strip_html(item.get('explanation') or item.get('analysis') or ''),
    )


def strip_html(html_text: str) -> str:
    """去除 HTML 标签"""
    if not html_text:
        return ""
    return BeautifulSoup(html_text, 'html.parser').get_text(strip=True)
```

- [ ] **Step 2: 添加辅助函数**

```python
def load_knowledge_point_map(db: Session) -> dict[str, dict]:
    """
    从数据库加载学科的所有知识点，构建名称→信息的映射。
    返回: {"知识点名称": {"uuid": "...", "domain_name": "...", "domain_id": "..."}}
    """
    points = (
        db.query(KnowledgePoint)
        .join(KnowledgeDomain)
        .filter(KnowledgeDomain.subject_id == SEED_SUBJECT_ID)
        .all()
    )
    kp_map = {}
    for pt in points:
        kp_map[pt.name] = {
            "uuid": str(pt.id),
            "domain_name": pt.domain.name if pt.domain else "",
            "domain_id": str(pt.domain_id) if pt.domain_id else "",
        }
    return kp_map


def load_existing_stems(db: Session, bank_id: str) -> set[str]:
    """加载已有题目的 stem，用于去重"""
    questions = db.query(Question).filter(Question.bank_id == bank_id).all()
    stems = set()
    for q in questions:
        content = q.content or {}
        stem = content.get("stem", "") if isinstance(content, dict) else ""
        if stem:
            stems.add(stem.strip())
    return stems


def is_duplicate(q_data: dict, existing_stems: set[str]) -> bool:
    """检查题目是否与已有题目重复（简单 stem 包含匹配）"""
    stem = q_data.get("content", {}).get("stem", "")
    if stem in existing_stems:
        return True
    # 检查 stem 是否被已有题目的 stem 包含（≥80% 相似）
    for existing in existing_stems:
        if len(stem) > 20 and len(existing) > 20:
            if stem[:40] == existing[:40]:
                return True
    return False
```

- [ ] **Step 3: Commit**

```bash
git add app/scripts/import_dotcpp_questions.py
git commit -m "feat: implement dotcpp page scraping and parsing"
```

---

### Task 3: 实现 Qwen AI 知识点分类

**Files:**
- Modify: `app/scripts/import_dotcpp_questions.py`

**Interfaces:**
- Consumes: `list[RawQuestion]`, `kp_map`
- Produces: `classify_with_qwen(raw_qs, kp_map) -> list[dict]`

- [ ] **Step 1: 实现 AI 分类函数**

```python

CLASSIFY_SYSTEM_PROMPT = """你是一个数据结构题目的分类专家。你的任务是将题目匹配到最合适的知识点。

可用的知识点列表（含 UUID）：
{knowledge_points}

题目信息：
- 来源章节：{default_domain}
- 题型：{question_type}
- 题干：{stem}
{options_text}

请分析题目内容，选择最匹配的 1-2 个知识点。只输出 JSON 数组（不要其他文字）：
["知识点UUID1", "知识点UUID2"]
"""


def classify_with_qwen(raw_questions: list[RawQuestion], kp_map: dict[str, dict]) -> list[dict]:
    """使用 Qwen API 对题目进行知识点分类"""
    if not settings.QWEN_API_KEY:
        logger.warning("QWEN_API_KEY 未配置，回退到默认章节映射")
        return classify_with_default(raw_questions, kp_map)

    kp_descriptions = "\n".join(
        f"  - {name} ({info['domain_name']}): UUID={info['uuid']}"
        for name, info in sorted(kp_map.items())
    )

    result = []
    batch_size = 10  # 每批处理 10 题，减少 API 调用次数

    for i in range(0, len(raw_questions), batch_size):
        batch = raw_questions[i:i + batch_size]
        logger.info(f"AI 分类: {i+1}-{min(i+batch_size, len(raw_questions))}/{len(raw_questions)}")

        for raw_q in batch:
            try:
                kp_uuids = classify_single_question(raw_q, kp_map, kp_descriptions)
                q_data = raw_question_to_dict(raw_q, kp_uuids)
                result.append(q_data)
            except Exception as e:
                logger.warning(f"AI 分类失败 [{raw_q.stem[:40]}...]: {e}，使用默认映射")
                q_data = raw_question_to_dict(raw_q, default_classify(raw_q, kp_map))
                result.append(q_data)
            time.sleep(0.3)  # 避免 API 限流

    return result


def classify_single_question(
    raw_q: RawQuestion, kp_map: dict[str, dict], kp_descriptions: str
) -> list[str]:
    """调用 Qwen API 对单道题进行分类"""
    options_text = ""
    if raw_q.options:
        options_text = "选项：\n" + "\n".join(
            f"  {o['key']}. {o['text']}" for o in raw_q.options
        )

    user_prompt = f"""请将以下题目分类到合适的知识点：

来源章节：{raw_q.default_domain}
题型：{'判断题' if raw_q.question_type == 'true_false' else '单选题'}
题干：{raw_q.stem}
{options_text}
正确答案：{', '.join(raw_q.correct_answer) if raw_q.correct_answer else '未知'}"""

    system_prompt = CLASSIFY_SYSTEM_PROMPT.format(
        knowledge_points=kp_descriptions,
        default_domain=raw_q.default_domain,
        question_type='判断题' if raw_q.question_type == 'true_false' else '单选题',
        stem=raw_q.stem,
        options_text=options_text,
    )

    resp = httpx.post(
        f"{settings.QWEN_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.QWEN_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "qwen-plus",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 200,
        },
        timeout=30.0,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"Qwen API 返回 {resp.status_code}: {resp.text[:200]}")

    reply = resp.json()["choices"][0]["message"]["content"].strip()
    reply = re.sub(r'^```(?:json)?\s*', '', reply)
    reply = re.sub(r'\s*```$', '', reply)

    uuids = json.loads(reply)
    if not isinstance(uuids, list):
        uuids = []

    # 验证 UUID 有效性
    valid_uuids = []
    all_uuids = {info["uuid"] for info in kp_map.values()}
    for uid in uuids:
        if uid in all_uuids:
            valid_uuids.append(uid)

    if not valid_uuids:
        return default_classify(raw_q, kp_map)

    return valid_uuids


def default_classify(raw_q: RawQuestion, kp_map: dict[str, dict]) -> list[str]:
    """默认分类：根据章节名匹配知识点（AI 不可用时的回退方案）"""
    domain = raw_q.default_domain
    # 找到属于该章节的所有知识点
    matching = [
        info["uuid"] for name, info in kp_map.items()
        if info["domain_name"] == domain
    ]
    return matching[:2] if matching else []


def classify_with_default(raw_questions: list[RawQuestion], kp_map: dict[str, dict]) -> list[dict]:
    """完全不使用 AI，纯按章节映射分类"""
    result = []
    for raw_q in raw_questions:
        kp_uuids = default_classify(raw_q, kp_map)
        result.append(raw_question_to_dict(raw_q, kp_uuids))
    return result


def raw_question_to_dict(raw_q: RawQuestion, kp_uuids: list[str]) -> dict:
    """将 RawQuestion 转换为符合 Question 模型格式的字典"""
    content = {"stem": raw_q.stem}
    if raw_q.options:
        content["options"] = raw_q.options

    answer = {
        "correct_answer": raw_q.correct_answer,
        "explanation": raw_q.explanation,
    }

    difficulty = "basic"  # dotcpp 题目默认为基础难度

    return {
        "type": raw_q.question_type,
        "content": content,
        "answer": answer,
        "difficulty": difficulty,
        "knowledge_point_uuids": kp_uuids,
        "tags": [raw_q.exam_label, "dotcpp"],
        "status": "published",
        "ai_generated": False,
        "source": "dotcpp",
        "priority": 0,
    }
```

- [ ] **Step 2: Commit**

```bash
git add app/scripts/import_dotcpp_questions.py
git commit -m "feat: implement Qwen AI knowledge point classification"
```

---

### Task 4: 实现数据库导入

**Files:**
- Modify: `app/scripts/import_dotcpp_questions.py`

**Interfaces:**
- Consumes: 分类后的题目数据、数据库连接
- Produces: `import_question(db, neo4j, q_data, bank_id)`, `update_bank_count(db, bank_id)`

- [ ] **Step 1: 实现导入函数**

```python
def import_question(db: Session, neo4j: Neo4jConnection, q_data: dict, bank_id: str):
    """导入单道题目到 PostgreSQL + Neo4j"""
    import uuid

    question = Question(
        id=uuid.uuid4(),
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
        source=q_data.get("source", "dotcpp"),
        created_by=None,
    )
    db.add(question)
    db.commit()
    db.refresh(question)

    # 同步到 Neo4j
    try:
        with neo4j.connect().session() as session:
            session.run(
                "MERGE (q:Question {uuid: $uuid})",
                uuid=str(question.id)
            )
            for kp_uuid in (question.knowledge_point_uuids or []):
                session.run(
                    """
                    MATCH (q:Question {uuid: $quid})
                    MATCH (kp:KnowledgePoint {uuid: $kpuuid})
                    MERGE (q)-[:TESTS]->(kp)
                    """,
                    quid=str(question.id), kpuuid=kp_uuid,
                )
    except Exception as e:
        logger.warning(f"Neo4j 同步失败: {e}")


def update_bank_count(db: Session, bank_id: str):
    """更新题库题目计数"""
    count = db.query(Question).filter(Question.bank_id == bank_id).count()
    db.query(QuestionBank).filter(QuestionBank.id == bank_id).update(
        {"total_questions": count}
    )
    db.commit()
    logger.info(f"题库题目计数已更新: {count}")
```

- [ ] **Step 2: Commit**

```bash
git add app/scripts/import_dotcpp_questions.py
git commit -m "feat: implement database import with Neo4j sync"
```

---

### Task 5: 端到端测试

**Files:**
- (无新增，运行脚本验证)

- [ ] **Step 1: 先干跑测试**

```bash
cd E:\code\python\education-agent-test01
python app/scripts/import_dotcpp_questions.py --dry-run --skip-ai
```

预期输出：爬取统计信息（如果 dotcpp 可访问）或请求失败日志

- [ ] **Step 2: 如果干跑成功，运行实际导入**

```bash
python app/scripts/import_dotcpp_questions.py
```

- [ ] **Step 3: 验证数据库中有新题目**

```bash
docker-compose exec backend python -c "
from app.db.database import SessionLocal
from app.models.question_bank import Question
db = SessionLocal()
count = db.query(Question).filter(Question.source == 'dotcpp').count()
print(f'dotcpp 题目数: {count}')
db.close()
"
```

- [ ] **Step 4: Commit (如有调整)**

```bash
git add -A
git commit -m "chore: dotcpp import script verified and tested"
```
