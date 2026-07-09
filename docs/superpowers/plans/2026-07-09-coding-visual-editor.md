# 编程题可视化推演系统 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为数据结构题库新增编程题类型，提供 Monaco 代码编辑器 + AI 可视化推演面板，题目来自 dotcpp ybt-ds。

**Architecture:** 后端新增 `/coding` API 端点 + Qwen AI 代码分析服务；前端新增 CodingPracticePage 三栏布局页面（目录树/编辑器+可视化/步骤控制）；导入脚本爬取 dotcpp 编程题并 AI 分类入库。

**Tech Stack:** FastAPI + SQLAlchemy + httpx, React + Monaco Editor + Canvas API, Qwen/DeepSeek API

## Global Constraints

- 所有用户可见文字必须是中文
- API 需要 JWT 认证（复用 `get_current_active_user`）
- 页面必须有返回导航按钮
- 加载/处理状态需要反馈
- 题目导入幂等（跳过已存在）
- 使用 Qwen/DeepSeek API（`resolve_api_credentials` 模式）
- 遵循项目现有代码风格

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `app/scripts/import_coding_problems.py` | 创建 | dotcpp 编程题爬取 + AI分类 + 导入 |
| `app/schemas/coding.py` | 创建 | Pydantic 请求/响应模型 |
| `app/services/code_analyzer.py` | 创建 | Qwen AI 代码分析（SSE流式） |
| `app/api/endpoints/coding.py` | 创建 | 4 个 REST API 端点 |
| `app/main.py` | 修改 | 注册 coding router |
| `frontend/src/api/coding.ts` | 创建 | 前端 API 客户端 |
| `frontend/src/components/coding/ProblemTree.tsx` | 创建 | 知识点目录树 |
| `frontend/src/components/coding/VisualizationCanvas.tsx` | 创建 | Canvas 数据结构动画 |
| `frontend/src/components/coding/StepController.tsx` | 创建 | 步骤前进/后退/播放 |
| `frontend/src/components/coding/CodePlayground.tsx` | 创建 | 代码编辑器 + 可视化面板 |
| `frontend/src/pages/CodingPracticePage.tsx` | 创建 | 编程练习主页面 |
| `frontend/src/App.tsx` | 修改 | 添加路由 /coding-practice |

---

### Task 1: 后端 Schema 和 AI 分析服务

**Files:**
- Create: `app/schemas/coding.py`
- Create: `app/services/code_analyzer.py`

**Interfaces:**
- Produces: `CodingTreeResponse`, `CodingProblemResponse`, `AnalyzeRequest`, `SubmitResultRequest`
- Produces: `CodeAnalyzer.analyze_stream(code, problem_desc, language) -> AsyncGenerator[str]`

- [ ] **Step 1: 创建 app/schemas/coding.py**

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# ── 目录树 ──

class ProblemSummary(BaseModel):
    id: str
    title: str
    difficulty: str
    status: str = "not_started"  # not_started / attempted / completed


class PointNode(BaseModel):
    point_id: str
    point_name: str
    problems: List[ProblemSummary] = []


class DomainNode(BaseModel):
    domain_id: str
    domain_name: str
    sort_order: int = 0
    total_problems: int = 0
    completed_count: int = 0
    points: List[PointNode] = []


class CodingTreeResponse(BaseModel):
    domains: List[DomainNode]


# ── 题目详情 ──

class CodingProblemResponse(BaseModel):
    id: str
    title: str
    type: str = "programming"
    content: Dict[str, Any]
    difficulty: str
    knowledge_point_uuids: List[str] = []
    tags: List[str] = []
    user_last_code: Optional[str] = None


# ── AI 分析 ──

class AnalyzeRequest(BaseModel):
    problem_id: str = Field(..., description="题目ID")
    code: str = Field(..., min_length=1, description="学生代码")
    language: str = Field(default="python", description="编程语言")


# ── 提交结果 ──

class SubmitResultRequest(BaseModel):
    problem_id: str
    code: str
    language: str = "python"
    is_correct: bool
    time_spent_seconds: Optional[int] = None


class SubmitResultResponse(BaseModel):
    success: bool
    answer_id: str
```

- [ ] **Step 2: 创建 app/services/code_analyzer.py**

```python
import json
import re
import httpx
import logging
from typing import AsyncGenerator, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

CODE_ANALYZE_PROMPT = """你是一个代码可视化推演引擎。请分析以下代码，生成逐步执行追踪JSON。

【题目】
{problem_description}

【代码】
```{language}
{code}
```

【要求】
1. 推理代码执行过程，每步包含：行号、变量状态、数据结构状态
2. 数据结构类型从以下选择：array, stack, queue, linked_list, tree, graph, heap, hash_table
3. 每步都要解释，最终给出运行结果和评价
4. 严格输出JSON，不要加代码块标记
5. 数据结构状态的elements字段用简化表示（如数组用[...]，栈用列表，树用{val, left, right}）

输出格式：
{{
  "steps": [
    {{
      "step": 1,
      "line": 3,
      "line_code": "stack = []",
      "action": "创建空栈",
      "variables": {{"stack": []}},
      "data_structure": {{
        "type": "stack",
        "elements": [],
        "top": -1
      }},
      "explanation": "初始化空栈"
    }}
  ],
  "result": {{"output": "-47"}},
  "summary": "代码评价"
}}"""


class CodeAnalyzer:
    """使用 Qwen/DeepSeek API 分析代码并生成执行追踪（SSE流式）。"""

    def __init__(self, api_key: str, base_url: str, model: str):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    async def analyze_stream(
        self,
        code: str,
        problem_description: str,
        language: str = "python",
    ) -> AsyncGenerator[str, None]:
        """流式返回 SSE 事件字符串（不含 "data: " 前缀和 "\n\n" 后缀）。"""
        prompt = CODE_ANALYZE_PROMPT.format(
            problem_description=problem_description[:2000],
            code=code[:3000],
            language=language,
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "你是代码推演引擎，只输出JSON，不要加代码块标记。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 4096,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            )

            if response.status_code != 200:
                yield json.dumps({"type": "error", "content": f"AI 调用失败: {response.status_code}"})
                return

            result = response.json()
            content = result["choices"][0]["message"]["content"]
            trace = self._parse_trace(content)

            if not trace:
                yield json.dumps({"type": "error", "content": "AI 返回数据解析失败，请重试"})
                return

            # 发送状态
            yield json.dumps({"type": "status", "content": "代码结构分析完成，开始推演执行过程..."})

            # 逐步发送
            for step in trace.get("steps", []):
                yield json.dumps({"type": "step", "data": step})

            # 发送完成
            yield json.dumps({
                "type": "complete",
                "result": trace.get("result", {}),
                "summary": trace.get("summary", ""),
            })

    def _parse_trace(self, content: str) -> Optional[dict]:
        """解析 AI 返回的 JSON 追踪数据。"""
        content = content.strip()
        content = re.sub(r'^```(?:json)?\s*', '', content)
        content = re.sub(r'\s*```$', '', content)

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # 尝试提取 JSON 对象
        obj_start = content.find("{")
        obj_end = content.rfind("}")
        if obj_start != -1 and obj_end != -1:
            try:
                return json.loads(content[obj_start:obj_end + 1])
            except json.JSONDecodeError:
                pass

        return None

    async def analyze_sync(
        self, code: str, problem_description: str, language: str = "python"
    ) -> Optional[dict]:
        """同步版：直接返回完整追踪数据。"""
        prompt = CODE_ANALYZE_PROMPT.format(
            problem_description=problem_description[:2000],
            code=code[:3000],
            language=language,
        )

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "你是代码推演引擎，只输出JSON，不要加代码块标记。"},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 4096,
                },
            )

            if response.status_code != 200:
                return None

            content = response.json()["choices"][0]["message"]["content"]
            return self._parse_trace(content)
```

- [ ] **Step 3: Commit**

```bash
git add app/schemas/coding.py app/services/code_analyzer.py
git commit -m "feat: add coding schemas and AI code analyzer service"
```

---

### Task 2: 后端 API 端点

**Files:**
- Create: `app/api/endpoints/coding.py`
- Modify: `app/main.py`

**Interfaces:**
- Consumes: `CodingTreeResponse`, `CodingProblemResponse`, `AnalyzeRequest`, `SubmitResultRequest` (from Task 1 schemas)
- Consumes: `CodeAnalyzer` class (from Task 1 service)
- Produces: Router with 4 endpoints registered at `/coding`

- [ ] **Step 1: 创建 app/api/endpoints/coding.py**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID
from typing import Optional
from collections import defaultdict
import json
import logging

from app.db.database import get_db
from app.db.neo4j import get_neo4j, Neo4jConnection
from app.models.question_bank import (
    Subject, KnowledgeDomain, KnowledgePoint, QuestionBank, Question,
    StudentAnswer,
)
from app.models.user import User
from app.schemas.coding import (
    CodingTreeResponse, CodingProblemResponse, DomainNode, PointNode, ProblemSummary,
    AnalyzeRequest, SubmitResultRequest, SubmitResultResponse,
)
from app.services.code_analyzer import CodeAnalyzer
from app.api.dependencies import get_current_active_user
from app.crud.api_settings import api_settings_crud
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/coding", tags=["Coding Practice"])

SEED_SUBJECT_ID = "d91a4645-ab5f-4819-8379-d9e6524f0937"
SEED_BANK_ID = "2ce6ee7d-ed5a-42a1-8a26-6ad6856afd3e"


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


# ── GET /coding/tree ──

@router.get("/tree", response_model=CodingTreeResponse)
async def get_coding_tree(
    subject_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取编程题知识点目录树（含用户完成状态）。"""
    sid = subject_id or SEED_SUBJECT_ID

    # 获取所有编程题
    all_problems = (
        db.query(Question)
        .filter(
            Question.type == "programming",
            Question.status == "published",
        )
        .all()
    )

    # 获取该学科的知识点结构
    domains = (
        db.query(KnowledgeDomain)
        .filter(KnowledgeDomain.subject_id == sid)
        .order_by(KnowledgeDomain.sort_order)
        .all()
    )

    # 获取用户完成状态
    completed = set()
    attempted = set()
    if all_problems:
        problem_ids = [q.id for q in all_problems]
        answers = (
            db.query(StudentAnswer)
            .filter(
                StudentAnswer.user_id == current_user.student_id,
                StudentAnswer.question_id.in_(problem_ids),
            )
            .all()
        )
        for a in answers:
            if a.is_correct:
                completed.add(str(a.question_id))
            else:
                attempted.add(str(a.question_id))

    # 构建目录树
    domain_nodes = []
    for domain in domains:
        points = (
            db.query(KnowledgePoint)
            .filter(KnowledgePoint.domain_id == domain.id)
            .order_by(KnowledgePoint.sort_order)
            .all()
        )

        point_nodes = []
        domain_total = 0
        domain_completed = 0

        for pt in points:
            pt_problems = [
                q for q in all_problems
                if str(pt.id) in (q.knowledge_point_uuids or [])
            ]
            if not pt_problems:
                continue

            problem_summaries = []
            for q in pt_problems:
                qid = str(q.id)
                content = q.content or {}
                status = "completed" if qid in completed else ("attempted" if qid in attempted else "not_started")
                problem_summaries.append(ProblemSummary(
                    id=qid,
                    title=content.get("stem", "") or content.get("description", "")[:60] or "未命名",
                    difficulty=q.difficulty,
                    status=status,
                ))
                domain_total += 1
                if status == "completed":
                    domain_completed += 1

            point_nodes.append(PointNode(
                point_id=str(pt.id),
                point_name=pt.name,
                problems=problem_summaries,
            ))

        if point_nodes:
            domain_nodes.append(DomainNode(
                domain_id=str(domain.id),
                domain_name=domain.name,
                sort_order=domain.sort_order,
                total_problems=domain_total,
                completed_count=domain_completed,
                points=point_nodes,
            ))

    return CodingTreeResponse(domains=domain_nodes)


# ── GET /coding/problems/{id} ──

@router.get("/problems/{problem_id}", response_model=CodingProblemResponse)
async def get_coding_problem(
    problem_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """获取编程题详情（含用户上次代码）。"""
    question = db.query(Question).filter(Question.id == problem_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    # 获取用户上次代码
    last_code = None
    last_answer = (
        db.query(StudentAnswer)
        .filter(
            StudentAnswer.user_id == current_user.student_id,
            StudentAnswer.question_id == problem_id,
        )
        .order_by(StudentAnswer.created_at.desc())
        .first()
    )
    if last_answer and last_answer.answer_content:
        last_code = last_answer.answer_content.get("code")

    return CodingProblemResponse(
        id=str(question.id),
        title=(question.content or {}).get("stem", "") or "未命名",
        type=question.type,
        content=question.content or {},
        difficulty=question.difficulty,
        knowledge_point_uuids=question.knowledge_point_uuids or [],
        tags=question.tags or [],
        user_last_code=last_code,
    )


# ── POST /coding/analyze (SSE) ──

@router.post("/analyze")
async def analyze_code(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """AI 分析代码并 SSE 流式返回执行追踪。"""
    # 获取题目描述
    question = db.query(Question).filter(Question.id == request.problem_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    content = question.content or {}
    desc_parts = []
    for key in ["description", "stem", "input_format", "output_format"]:
        val = content.get(key, "")
        if val:
            desc_parts.append(f"{key}: {val}")
    problem_desc = "\n".join(desc_parts) if desc_parts else str(content)

    # 获取 API 凭证
    creds = _resolve_api_creds(db)
    if not creds:
        raise HTTPException(status_code=400, detail="AI 分析需要 API Key，请在设置中配置")

    analyzer = CodeAnalyzer(
        api_key=creds["api_key"],
        base_url=creds["base_url"],
        model=creds["model"],
    )

    async def event_stream():
        try:
            async for event_str in analyzer.analyze_stream(
                code=request.code,
                problem_description=problem_desc,
                language=request.language,
            ):
                yield f"data: {event_str}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── POST /coding/submit-result ──

@router.post("/submit-result", response_model=SubmitResultResponse)
async def submit_coding_result(
    request: SubmitResultRequest,
    db: Session = Depends(get_db),
    neo4j: Neo4jConnection = Depends(get_neo4j),
    current_user=Depends(get_current_active_user),
):
    """保存编程题作答结果。"""
    from datetime import datetime
    import uuid as _uuid_mod

    question = db.query(Question).filter(Question.id == request.problem_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    answer = StudentAnswer(
        user_id=current_user.student_id,
        question_id=request.problem_id,
        bank_id=question.bank_id,
        answer_content={"code": request.code, "language": request.language},
        is_correct=request.is_correct,
        time_spent_seconds=request.time_spent_seconds,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)

    return SubmitResultResponse(
        success=True,
        answer_id=str(answer.id),
    )
```

- [ ] **Step 2: 注册路由到 app/main.py**

在 `app/main.py` 中，找到其他 router 注册位置，添加：

```python
from app.api.endpoints.coding import router as coding_router
app.include_router(coding_router, prefix=settings.API_V1_STR)
```

- [ ] **Step 3: Commit**

```bash
git add app/api/endpoints/coding.py app/main.py
git commit -m "feat: add coding practice API endpoints"
```

---

### Task 3: 编程题导入脚本

**Files:**
- Create: `app/scripts/import_coding_problems.py`

**Interfaces:**
- Produces: CLI 脚本，`--dry-run` 参数
- Consumes: 现有 `resolve_api_credentials` 模式、`import_question` 模式

- [ ] **Step 1: 创建脚本**

```python
#!/usr/bin/env python3
"""
dotcpp 编程题导入脚本
从 dotcpp.com/oj/ybt-ds/ 爬取信息学一本通数据结构编程题，AI分类后导入题库。

用法:
  python app/scripts/import_coding_problems.py           # 全量导入
  python app/scripts/import_coding_problems.py --dry-run # 干跑预览
  python app/scripts/import_coding_problems.py --chapter 1081  # 指定章节
"""

import sys, os, time, argparse, json, logging, re, uuid as _uuid_mod
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
HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

YBT_DS_CHAPTERS = [
    {"url": "https://www.dotcpp.com/oj/1081/", "domain": "栈和队列", "label": "栈"},
    {"url": "https://www.dotcpp.com/oj/1082/", "domain": "栈和队列", "label": "队列"},
    {"url": "https://www.dotcpp.com/oj/1083/", "domain": "树和二叉树", "label": "树和堆"},
    {"url": "https://www.dotcpp.com/oj/1084/", "domain": "图", "label": "图论"},
]


def load_kp_map(db: Session) -> dict:
    points = db.query(KnowledgePoint).join(KnowledgeDomain).filter(
        KnowledgeDomain.subject_id == SEED_SUBJECT_ID
    ).all()
    return {pt.name: {"uuid": str(pt.id), "domain_name": pt.domain.name} for pt in points}


def load_existing_source_ids(db: Session) -> set:
    questions = db.query(Question).filter(Question.source == "dotcpp_coding").all()
    return {q.content.get("source_problem_id", "") for q in questions if q.content}


def scrape_chapter_problems(chapter: dict, delay: float = 1.0) -> list[dict]:
    """爬取章节页面的题目列表。"""
    url = chapter["url"]
    logger.info(f"  爬取: {chapter['label']} ({url})")
    time.sleep(delay)
    resp = httpx.get(url, headers=HTTP_HEADERS, timeout=30, follow_redirects=True)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, 'html.parser')
    problems = []
    for tr in soup.find_all('tr'):
        cells = tr.find_all('td')
        if len(cells) >= 3:
            pid = cells[1].get_text(strip=True) if len(cells) > 1 else ""
            title = cells[2].get_text(strip=True) if len(cells) > 2 else ""
            if pid.isdigit() and title:
                problems.append({"id": pid, "title": title, "chapter": chapter})
    logger.info(f"    找到 {len(problems)} 题")
    return problems


def scrape_problem_detail(problem: dict, delay: float = 0.5) -> Optional[dict]:
    """爬取题目详情页。"""
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
            return text[start:end].strip()
        return text[start:start+500].strip()

    description = extract_section(body_text, "题目描述", ["输入格式", "输入"])
    input_format = extract_section(body_text, "输入格式", ["输出格式", "输出"])
    output_format = extract_section(body_text, "输出格式", ["样例输入", "样例"])
    sample_input = extract_section(body_text, "样例输入", ["样例输出"])
    sample_output = extract_section(body_text, "样例输出", ["提示", "来源", "标签"])
    time_limit_match = re.search(r'(\d+)s', body_text)
    mem_limit_match = re.search(r'(\d+)MB', body_text)

    return {
        "source_problem_id": f"dotcpp-{pid}",
        "title": problem["title"],
        "description": description or problem["title"],
        "input_format": input_format,
        "output_format": output_format,
        "sample_input": sample_input,
        "sample_output": sample_output,
        "time_limit_ms": int(time_limit_match.group(1)) * 1000 if time_limit_match else 1000,
        "memory_limit_mb": int(mem_limit_match.group(1)) if mem_limit_match else 128,
        "chapter": problem["chapter"],
    }


def generate_code_template(detail: dict, kp_map: dict, api_creds: dict) -> dict:
    """使用 AI 生成 Python/C++/Java 代码模板。"""
    prompt = f"""为以下编程题生成代码模板（函数签名框架）：

题目：{detail['title']}
描述：{detail['description'][:500]}
输入格式：{detail.get('input_format', '')[:200]}
输出格式：{detail.get('output_format', '')[:200]}

请生成三种语言的起始代码模板。输出JSON：
{{"python": "def solve():\\n    pass", "cpp": "int main() {{\\n    return 0;\\n}}", "java": "public class Main {{\\n    public static void main(String[] args) {{\\n    }}\\n}}"}}
只输出JSON对象，不要其他文字。"""

    try:
        resp = httpx.post(
            f"{api_creds['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {api_creds['api_key']}", "Content-Type": "application/json"},
            json={"model": api_creds['model'], "messages": [
                {"role": "system", "content": "只输出JSON对象，不要加代码块标记。"},
                {"role": "user", "content": prompt},
            ], "temperature": 0.2, "max_tokens": 1024},
            timeout=30,
        )
        if resp.status_code == 200:
            reply = resp.json()["choices"][0]["message"]["content"].strip()
            reply = re.sub(r'^```(?:json)?\s*', '', reply)
            reply = re.sub(r'\s*```$', '', reply)
            return json.loads(reply)
    except Exception as e:
        logger.warning(f"    代码模板生成失败: {e}")

    return {
        "python": "# 请在此编写代码\ndef solve():\n    pass\n",
        "cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    // 请在此编写代码\n    return 0;\n}\n",
        "java": "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // 请在此编写代码\n    }\n}\n",
    }


def main():
    parser = argparse.ArgumentParser(description="dotcpp 编程题导入")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--chapter", type=str, default=None, help="指定章节URL（如1081）")
    args = parser.parse_args()

    db = SessionLocal()
    neo4j = get_neo4j()
    stats = {"scraped": 0, "imported": 0, "skipped": 0, "errors": 0}

    print("\n" + "=" * 60)
    print("  dotcpp 编程题导入")
    print("=" * 60)

    try:
        kp_map = load_kp_map(db)
        existing_ids = load_existing_source_ids(db)
        print(f"  知识点: {len(kp_map)} | 已有编程题: {len(existing_ids)}")

        api_creds = _resolve_api_creds()
        if not api_creds:
            print("  WARNING: 无 API Key，代码模板将使用默认值")

        chapters = YBT_DS_CHAPTERS
        if args.chapter:
            chapters = [c for c in chapters if args.chapter in c["url"]]

        all_detail = []
        for ch in chapters:
            problems = scrape_chapter_problems(ch)
            stats["scraped"] += len(problems)
            for p in problems:
                pid = p["id"]
                if f"dotcpp-{pid}" in existing_ids:
                    stats["skipped"] += 1
                    continue
                detail = scrape_problem_detail(p)
                if detail:
                    if api_creds:
                        templates = generate_code_template(detail, kp_map, api_creds)
                    else:
                        templates = {}
                    detail["code_template"] = templates
                    all_detail.append(detail)
            print(f"  {ch['label']}: {len(problems)} 题, 新增 {len(all_detail) - stats['skipped']} 题")

        # 导入
        for detail in all_detail:
            if args.dry_run:
                print(f"  [DRY] {detail['title'][:60]}")
                continue
            try:
                # 匹配知识点
                domain_name = detail["chapter"]["domain"]
                kp_uuids = [info["uuid"] for name, info in kp_map.items() if info["domain_name"] == domain_name][:2]

                content = {
                    "stem": detail["title"],
                    "description": detail["description"],
                    "input_format": detail.get("input_format", ""),
                    "output_format": detail.get("output_format", ""),
                    "sample_input": detail.get("sample_input", ""),
                    "sample_output": detail.get("sample_output", ""),
                    "code_template": detail.get("code_template", {}),
                    "time_limit_ms": detail.get("time_limit_ms", 1000),
                    "memory_limit_mb": detail.get("memory_limit_mb", 128),
                    "source_problem_id": detail["source_problem_id"],
                }
                answer = {
                    "correct_answer": [],
                    "explanation": f"来自 dotcpp {detail['chapter']['label']} 章节",
                }

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
                stats["imported"] += 1
            except Exception as e:
                logger.error(f"  导入失败 [{detail.get('title', '')}]: {e}")
                stats["errors"] += 1
                db.rollback()

        print(f"\n  汇总: 爬取 {stats['scraped']} | 导入 {stats['imported']} | 跳过 {stats['skipped']} | 错误 {stats['errors']}")

    finally:
        db.close()


def _resolve_api_creds():
    if settings.QWEN_API_KEY and "your-qwen" not in settings.QWEN_API_KEY:
        return {"api_key": settings.QWEN_API_KEY, "base_url": settings.QWEN_BASE_URL, "model": "qwen-plus"}
    if settings.DEEPSEEK_API_KEY and "your-deepseek" not in settings.DEEPSEEK_API_KEY:
        return {"api_key": settings.DEEPSEEK_API_KEY, "base_url": settings.DEEPSEEK_BASE_URL, "model": "deepseek-v4-flash"}
    try:
        db = SessionLocal()
        user = db.query(User).filter(User.username == "guoketg").first()
        db.close()
        if user:
            return {"api_key": "from_settings", "base_url": settings.DEEPSEEK_BASE_URL, "model": "deepseek-v4-flash"}
    except Exception:
        pass
    return {}


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 测试脚本**

```bash
docker-compose exec backend python app/scripts/import_coding_problems.py --dry-run --chapter 1081
```

- [ ] **Step 3: Commit**

```bash
git add app/scripts/import_coding_problems.py
git commit -m "feat: add dotcpp coding problem import script"
```

---

### Task 4: 前端 API 客户端

**Files:**
- Create: `frontend/src/api/coding.ts`

- [ ] **Step 1: 创建 frontend/src/api/coding.ts**

```typescript
import api from './auth'

export interface ProblemSummary {
  id: string
  title: string
  difficulty: string
  status: 'not_started' | 'attempted' | 'completed'
}

export interface PointNode {
  point_id: string
  point_name: string
  problems: ProblemSummary[]
}

export interface DomainNode {
  domain_id: string
  domain_name: string
  sort_order: number
  total_problems: number
  completed_count: number
  points: PointNode[]
}

export interface CodingTreeResponse {
  domains: DomainNode[]
}

export interface CodingProblemResponse {
  id: string
  title: string
  type: string
  content: Record<string, any>
  difficulty: string
  knowledge_point_uuids: string[]
  tags: string[]
  user_last_code: string | null
}

export interface AnalyzeStep {
  step: number
  line: number
  line_code: string
  action: string
  variables: Record<string, any>
  data_structure: {
    type: string
    elements: any[]
    [key: string]: any
  }
  explanation: string
}

export const codingApi = {
  getTree: (subjectId?: string) =>
    api.get<CodingTreeResponse>('/coding/tree', { params: subjectId ? { subject_id: subjectId } : {} }),

  getProblem: (id: string) =>
    api.get<CodingProblemResponse>(`/coding/problems/${id}`),

  analyzeCode: (
    data: { problem_id: string; code: string; language: string },
    callbacks: {
      onStatus: (msg: string) => void
      onStep: (step: AnalyzeStep) => void
      onComplete: (result: { output: string }, summary: string) => void
      onError: (msg: string) => void
    }
  ) => {
    const token = localStorage.getItem('access_token')
    return fetch('/api/v1/coding/analyze', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }).then(async (response) => {
      if (!response.ok) {
        callbacks.onError(`请求失败: ${response.status}`)
        return
      }
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          try {
            const event = JSON.parse(trimmed.slice(6))
            switch (event.type) {
              case 'status':
                callbacks.onStatus(event.content)
                break
              case 'step':
                callbacks.onStep(event.data)
                break
              case 'complete':
                callbacks.onComplete(event.result, event.summary)
                break
              case 'error':
                callbacks.onError(event.content)
                break
            }
          } catch { /* skip malformed */ }
        }
      }
    }).catch((err) => {
      callbacks.onError(err.message || '网络错误')
    })
  },

  submitResult: (data: {
    problem_id: string
    code: string
    language: string
    is_correct: boolean
    time_spent_seconds?: number
  }) => api.post<{ success: boolean; answer_id: string }>('/coding/submit-result', data),
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/coding.ts
git commit -m "feat: add coding practice frontend API client"
```

---

### Task 5: 前端可视化组件

**Files:**
- Create: `frontend/src/components/coding/VisualizationCanvas.tsx`
- Create: `frontend/src/components/coding/StepController.tsx`

- [ ] **Step 1: 创建 VisualizationCanvas.tsx**

```tsx
import { useRef, useEffect } from 'react'

interface VizCanvasProps {
  dataStructure: {
    type: string
    elements: any[]
    top?: number
    head?: any
    [key: string]: any
  } | null
  width?: number
  height?: number
}

const COLORS = {
  bg: '#1a1a2e',
  node: '#4a9eff',
  nodeHover: '#6ab4ff',
  text: '#e0e0e0',
  line: '#556',
  highlight: '#ff6b6b',
}

export default function VisualizationCanvas({ dataStructure, width = 500, height = 300 }: VizCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !dataStructure) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, width, height)

    const { type, elements } = dataStructure

    if (type === 'array' || type === 'stack' || type === 'queue') {
      drawLinearDS(ctx, dataStructure, width, height)
    } else if (type === 'linked_list') {
      drawLinkedList(ctx, dataStructure, width, height)
    } else if (type === 'tree' || type === 'heap') {
      drawTree(ctx, dataStructure, width, height)
    } else if (type === 'graph') {
      drawGraph(ctx, dataStructure, width, height)
    }
  }, [dataStructure, width, height])

  if (!dataStructure) {
    return (
      <div style={{
        width, height, background: COLORS.bg, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: COLORS.text, fontSize: 14,
      }}>
        点击「运行分析」查看数据结构推演
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ borderRadius: 8 }}
    />
  )
}

/* ── 线性结构渲染（数组/栈/队列）── */
function drawLinearDS(ctx: CanvasRenderingContext2D, ds: any, w: number, h: number) {
  const elements = ds.elements || []
  const n = elements.length
  const boxW = Math.min(60, (w - 40) / Math.max(n, 1))
  const boxH = 40
  const startX = (w - n * boxW) / 2
  const startY = h / 2 - boxH / 2

  ctx.font = '14px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < n; i++) {
    const x = startX + i * boxW
    const isTop = ds.top !== undefined && i === ds.top

    ctx.fillStyle = isTop ? COLORS.highlight : COLORS.node
    ctx.strokeStyle = COLORS.line
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x + 2, startY + 2, boxW - 4, boxH - 4, 6)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.fillText(String(elements[i]), x + boxW / 2, startY + boxH / 2)
  }

  if (ds.type === 'stack' && ds.top !== undefined) {
    ctx.fillStyle = COLORS.text
    ctx.font = '12px sans-serif'
    ctx.fillText(`栈顶: ${ds.top}`, w / 2, startY - 15)
  }
}

/* ── 链表渲染 ── */
function drawLinkedList(ctx: CanvasRenderingContext2D, ds: any, w: number, h: number) {
  const elements = ds.elements || []
  const nodeR = 20
  const gap = 60
  const startX = Math.max(30, (w - elements.length * gap) / 2)
  const y = h / 2

  ctx.font = '12px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < elements.length; i++) {
    const x = startX + i * gap
    ctx.fillStyle = COLORS.node
    ctx.beginPath()
    ctx.arc(x, y, nodeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(String(elements[i]), x, y)

    if (i < elements.length - 1) {
      ctx.strokeStyle = COLORS.line
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x + nodeR, y)
      ctx.lineTo(x + gap - nodeR, y)
      // arrow
      ctx.lineTo(x + gap - nodeR - 6, y - 5)
      ctx.moveTo(x + gap - nodeR, y)
      ctx.lineTo(x + gap - nodeR - 6, y + 5)
      ctx.stroke()
    }
  }
}

/* ── 树渲染（简化版）── */
function drawTree(ctx: CanvasRenderingContext2D, ds: any, w: number, h: number) {
  // 将 elements 中的树形结构转为可绘制节点
  const nodes: { val: any; x: number; y: number; children: number[] }[] = []
  // 如果 elements 本身就是节点数组
  if (Array.isArray(ds.elements)) {
    drawLinearDS(ctx, { ...ds, type: 'array' }, w, h)
  } else {
    ctx.fillStyle = COLORS.text
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('树形结构', w / 2, h / 2)
  }
}

/* ── 图渲染（简化版）── */
function drawGraph(ctx: CanvasRenderingContext2D, ds: any, w: number, h: number) {
  ctx.fillStyle = COLORS.text
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('图结构', w / 2, h / 2)
}
```

- [ ] **Step 2: 创建 StepController.tsx**

```tsx
import { PlayIcon, ArrowLeftIcon, ArrowRightIcon } from '../Icons'

interface StepControllerProps {
  currentStep: number
  totalSteps: number
  onPrev: () => void
  onNext: () => void
  onAutoPlay: () => void
  isAutoPlaying: boolean
  disabled?: boolean
}

export default function StepController({
  currentStep, totalSteps, onPrev, onNext, onAutoPlay, isAutoPlaying, disabled,
}: StepControllerProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '10px 0',
      borderTop: '1px solid var(--app-border)',
    }}>
      <button onClick={onPrev} disabled={disabled || currentStep <= 1}
        style={{
          background: 'var(--app-bg-card)', border: '1px solid var(--app-border)',
          borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
          opacity: currentStep <= 1 ? 0.4 : 1,
        }}>
        <ArrowLeftIcon size={14} /> 上一步
      </button>

      <span style={{ fontSize: 13, color: 'var(--app-text-secondary)', minWidth: 80, textAlign: 'center' }}>
        步骤 {currentStep}/{totalSteps}
      </span>

      <button onClick={onNext} disabled={disabled || currentStep >= totalSteps}
        style={{
          background: 'var(--app-bg-card)', border: '1px solid var(--app-border)',
          borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
          opacity: currentStep >= totalSteps ? 0.4 : 1,
        }}>
        下一步 <ArrowRightIcon size={14} />
      </button>

      <button onClick={onAutoPlay} disabled={disabled || totalSteps === 0}
        style={{
          background: isAutoPlaying ? 'var(--app-danger)' : 'var(--app-primary)',
          color: '#fff', border: 'none', borderRadius: 6,
          padding: '6px 14px', cursor: 'pointer', fontWeight: 500,
        }}>
        {isAutoPlaying ? '停止' : '自动播放'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/coding/
git commit -m "feat: add visualization canvas and step controller components"
```

---

### Task 6: 前端 ProblemTree + CodePlayground 组件

**Files:**
- Create: `frontend/src/components/coding/ProblemTree.tsx`
- Create: `frontend/src/components/coding/CodePlayground.tsx`

- [ ] **Step 1: 创建 ProblemTree.tsx**

```tsx
import { useState } from 'react'
import type { DomainNode, PointNode, ProblemSummary } from '../../api/coding'

interface ProblemTreeProps {
  domains: DomainNode[]
  selectedId: string | null
  onSelect: (problemId: string) => void
  searchText: string
}

export default function ProblemTree({ domains, selectedId, onSelect, searchText }: ProblemTreeProps) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set(domains.map(d => d.domain_id)))

  const toggleDomain = (id: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filterText = searchText.toLowerCase()

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '4px 0' }}>
      <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: 14, color: 'var(--app-text-heading)' }}>
        知识点目录
      </div>
      {domains.map(domain => {
        const visiblePoints = domain.points.filter(p =>
          p.problems.some(pr => pr.title.toLowerCase().includes(filterText))
        )
        if (visiblePoints.length === 0 && filterText) return null

        return (
          <div key={domain.domain_id}>
            <div
              onClick={() => toggleDomain(domain.domain_id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                color: 'var(--app-text-heading)',
                userSelect: 'none',
              }}
            >
              <span>{expandedDomains.has(domain.domain_id) ? '▾' : '▸'}</span>
              <span>{domain.domain_name}</span>
              <span style={{ fontSize: 11, color: 'var(--app-text-secondary)' }}>
                ({domain.completed_count}/{domain.total_problems})
              </span>
            </div>

            {expandedDomains.has(domain.domain_id) && visiblePoints.map(point => (
              <div key={point.point_id} style={{ paddingLeft: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--app-text-secondary)', padding: '2px 8px' }}>
                  {point.point_name}
                </div>
                {point.problems
                  .filter(p => p.title.toLowerCase().includes(filterText))
                  .map(problem => {
                    const isSelected = problem.id === selectedId
                    const statusColor =
                      problem.status === 'completed' ? 'var(--app-success)' :
                      problem.status === 'attempted' ? 'var(--app-warning)' :
                      'var(--app-text-secondary)'
                    return (
                      <div
                        key={problem.id}
                        onClick={() => onSelect(problem.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '4px 8px 4px 24px', cursor: 'pointer',
                          fontSize: 12,
                          background: isSelected ? 'var(--app-bg-active)' : 'transparent',
                          color: isSelected ? 'var(--app-primary)' : 'var(--app-text)',
                          borderRadius: 4,
                        }}
                      >
                        <span style={{ color: statusColor, fontSize: 10 }}>●</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {problem.title}
                        </span>
                        <span style={{
                          fontSize: 10, padding: '1px 4px', borderRadius: 3,
                          background: 'var(--app-bg-page)',
                          color: 'var(--app-text-secondary)',
                        }}>
                          {problem.difficulty === 'basic' ? '基础' :
                           problem.difficulty === 'intermediate' ? '进阶' : problem.difficulty}
                        </span>
                      </div>
                    )
                  })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 创建 CodePlayground.tsx**

```tsx
import { useState, useCallback } from 'react'
import CodeEditor from '../CodeEditor'
import VisualizationCanvas from './VisualizationCanvas'
import StepController from './StepController'
import type { AnalyzeStep, CodingProblemResponse } from '../../api/coding'
import { codingApi } from '../../api/coding'

interface CodePlaygroundProps {
  problem: CodingProblemResponse | null
}

const LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
]

export default function CodePlayground({ problem }: CodePlaygroundProps) {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('python')
  const [analyzing, setAnalyzing] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [steps, setSteps] = useState<AnalyzeStep[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [autoPlayTimer, setAutoPlayTimer] = useState<ReturnType<typeof setInterval> | null>(null)

  // 加载题目时初始化代码
  useState(() => {
    if (problem) {
      const template = problem.content?.code_template?.[language] || ''
      setCode(template || problem.user_last_code || '# 请在此编写代码\n')
      setSteps([])
      setCurrentStep(0)
      setStatusMsg('')
    }
  })

  const handleAnalyze = useCallback(() => {
    if (!problem || !code.trim()) return
    setAnalyzing(true)
    setSteps([])
    setCurrentStep(0)
    setStatusMsg('正在分析代码结构...')

    codingApi.analyzeCode(
      { problem_id: problem.id, code, language },
      {
        onStatus: (msg) => setStatusMsg(msg),
        onStep: (step) => {
          setSteps(prev => [...prev, step])
          setCurrentStep(prev => prev + 1)
        },
        onComplete: (result, summary) => {
          setStatusMsg(summary || `运行结果: ${result?.output || '完成'}`)
          setAnalyzing(false)
        },
        onError: (msg) => {
          setStatusMsg(`分析失败: ${msg}`)
          setAnalyzing(false)
        },
      }
    )
  }, [problem, code, language])

  const currentData = steps.length > 0 && currentStep > 0
    ? steps[Math.min(currentStep - 1, steps.length - 1)]
    : null

  const handlePrev = () => setCurrentStep(prev => Math.max(1, prev - 1))
  const handleNext = () => setCurrentStep(prev => Math.min(steps.length, prev + 1))

  const handleAutoPlay = () => {
    if (isAutoPlaying) {
      if (autoPlayTimer) clearInterval(autoPlayTimer)
      setIsAutoPlaying(false)
    } else {
      setIsAutoPlaying(true)
      const timer = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= steps.length) {
            clearInterval(timer)
            setIsAutoPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, 1000)
      setAutoPlayTimer(timer)
    }
  }

  if (!problem) {
    return <div style={{ padding: 20, color: 'var(--app-text-secondary)' }}>请从左侧目录选择题目</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      {/* 题目描述 */}
      <div style={{ padding: '8px 0', borderBottom: '1px solid var(--app-border)' }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          {problem.content?.stem || problem.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--app-text-secondary)', lineHeight: 1.6, maxHeight: 120, overflow: 'auto' }}>
          {problem.content?.description?.slice(0, 500)}
        </div>
        {(problem.content?.sample_input || problem.content?.sample_output) && (
          <div style={{ marginTop: 8, fontSize: 12 }}>
            {problem.content.sample_input && (
              <span>样例输入: <code>{problem.content.sample_input}</code></span>
            )}
            {problem.content.sample_output && (
              <span style={{ marginLeft: 16 }}>样例输出: <code>{problem.content.sample_output}</code></span>
            )}
          </div>
        )}
      </div>

      {/* 语言选择 + 运行按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select value={language} onChange={e => setLanguage(e.target.value)}
          style={{
            padding: '4px 8px', borderRadius: 4, border: '1px solid var(--app-border)',
            background: 'var(--app-bg-card)', color: 'var(--app-text)', fontSize: 13,
          }}>
          {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <button onClick={handleAnalyze} disabled={analyzing || !code.trim()}
          style={{
            padding: '6px 16px', borderRadius: 6, border: 'none',
            background: analyzing ? 'var(--app-border)' : 'var(--app-primary)',
            color: '#fff', cursor: analyzing ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 500,
          }}>
          {analyzing ? '分析中...' : '运行分析'}
        </button>
        {statusMsg && (
          <span style={{ fontSize: 12, color: 'var(--app-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {statusMsg}
          </span>
        )}
      </div>

      {/* 编辑器 + 可视化 */}
      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CodeEditor
            code={code}
            language={language}
            onChange={setCode}
            height="100%"
          />
        </div>
        <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 变量状态 */}
          {currentData && (
            <div style={{
              background: 'var(--app-bg-card)', borderRadius: 6, padding: 8,
              fontSize: 12, maxHeight: 100, overflow: 'auto',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>变量状态</div>
              {Object.entries(currentData.variables || {}).map(([k, v]) => (
                <div key={k}>
                  <code>{k}</code> = {JSON.stringify(v)}
                </div>
              ))}
            </div>
          )}
          <VisualizationCanvas
            dataStructure={currentData?.data_structure || null}
            width={360}
            height={220}
          />
          {currentData && (
            <div style={{ fontSize: 12, color: 'var(--app-text-secondary)', padding: '4px 8px' }}>
              {currentData.explanation}
            </div>
          )}
        </div>
      </div>

      {/* 步骤控制 */}
      <StepController
        currentStep={currentStep}
        totalSteps={steps.length}
        onPrev={handlePrev}
        onNext={handleNext}
        onAutoPlay={handleAutoPlay}
        isAutoPlaying={isAutoPlaying}
        disabled={analyzing || steps.length === 0}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/coding/
git commit -m "feat: add problem tree and code playground components"
```

---

### Task 7: 前端主页面 + 路由

**Files:**
- Create: `frontend/src/pages/CodingPracticePage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 创建 CodingPracticePage.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProblemTree from '../components/coding/ProblemTree'
import CodePlayground from '../components/coding/CodePlayground'
import { codingApi, type DomainNode, type CodingProblemResponse } from '../api/coding'

export default function CodingPracticePage() {
  const [searchParams] = useSearchParams()
  const [domains, setDomains] = useState<DomainNode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('problem'))
  const [problem, setProblem] = useState<CodingProblemResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    codingApi.getTree().then(res => {
      setDomains(res.domains || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedId) {
      codingApi.getProblem(selectedId).then(res => {
        setProblem(res)
      }).catch(() => setProblem(null))
    }
  }, [selectedId])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', background: 'var(--app-bg-page)' }}>
      {/* 左侧目录树 */}
      <div style={{
        width: 260, minWidth: 260, borderRight: '1px solid var(--app-border)',
        background: 'var(--app-bg-card)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '8px 12px' }}>
          <input
            type="text"
            placeholder="搜索题目..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px', borderRadius: 6,
              border: '1px solid var(--app-border)',
              background: 'var(--app-bg-page)', color: 'var(--app-text)',
              fontSize: 13, outline: 'none',
            }}
          />
        </div>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--app-text-secondary)', fontSize: 13 }}>
            加载中...
          </div>
        ) : (
          <ProblemTree
            domains={domains}
            selectedId={selectedId}
            onSelect={setSelectedId}
            searchText={searchText}
          />
        )}
      </div>

      {/* 右侧编辑区 */}
      <div style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
        <CodePlayground problem={problem} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 在 App.tsx 添加路由**

在 `frontend/src/App.tsx` 中找到路由定义区域，添加：

```tsx
import CodingPracticePage from './pages/CodingPracticePage'

// 在 Routes 内添加:
<Route path="/coding-practice" element={<CodingPracticePage />} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CodingPracticePage.tsx frontend/src/App.tsx
git commit -m "feat: add coding practice page with routing"
```

---

### Task 8: 端到端测试

- [ ] **Step 1: 重启服务**

```bash
docker-compose restart backend frontend
```

- [ ] **Step 2: 验证后端 API 可访问**

```bash
curl http://localhost:8000/api/v1/coding/tree -H "Authorization: Bearer <token>"
```

- [ ] **Step 3: 访问前端页面**

打开 http://localhost:3000/coding-practice

- [ ] **Step 4: 导入编程题**

```bash
docker-compose exec backend python app/scripts/import_coding_problems.py --dry-run --chapter 1081
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: final adjustments and verification"
```
